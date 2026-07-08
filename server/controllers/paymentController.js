import Registration, { PAYMENT_STATUS } from '../models/Registration.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { nextRegistrationNumber } from '../utils/registrationNumber.js';
import { sendConfirmationWhatsApp } from '../utils/whatsapp.js';
import { sendUserConfirmationEmail, sendOrganizerNotification } from '../utils/email.js';
import {
  buildPaymentRequest,
  parseHdfcResponse,
  buildMockCallback,
  fetchOrderStatus,
  isMockMode,
} from '../utils/hdfc.js';

/**
 * Idempotently confirm a payment. Shared by callback + webhook so either path
 * can finalise a registration even if the other never arrives.
 *
 * @param {object} parsed result of parseHdfcResponse()
 * @returns {Promise<{ registration: object|null, changed: boolean, reason: string }>}
 */
const applyPaymentResult = async (parsed) => {
  const { orderId, status, txnId, raw } = parsed;
  if (!orderId) return { registration: null, changed: false, reason: 'missing orderId' };

  // Callback, webhook, and the status-poll safety net can all race to
  // finalise the same order. Atomically claim it first so only one of them
  // proceeds — otherwise two racing callers could both allocate a
  // registration number and both fire the confirmation WhatsApp/email.
  const lockStaleBefore = new Date(Date.now() - 30 * 1000);
  const registration = await Registration.findOneAndUpdate(
    {
      orderId,
      paymentStatus: { $nin: Registration.SEAT_HOLDING_STATUSES },
      $or: [{ processingLock: { $ne: true } }, { processingLockAt: { $lt: lockStaleBefore } }],
    },
    { $set: { processingLock: true, processingLockAt: new Date() } },
    { new: true }
  );

  if (!registration) {
    const existing = await Registration.findOne({ orderId });
    if (!existing) return { registration: null, changed: false, reason: 'order not found' };
    if (Registration.SEAT_HOLDING_STATUSES.includes(existing.paymentStatus)) {
      return { registration: existing, changed: false, reason: 'already confirmed' };
    }
    return { registration: existing, changed: false, reason: 'processing in progress' };
  }

  registration.hdfc_txn_id = txnId || registration.hdfc_txn_id;
  registration.hdfc_response = raw;

  if (status === 'SUCCESS') {
    // Duplicate-payment guard: never give a second seat to a mobile that
    // already holds a confirmed registration (e.g. the user registered twice
    // and paid both). The duplicate payment is recorded but not seated.
    const dupe = await Registration.findOne({
      _id: { $ne: registration._id },
      mobileNumber: registration.mobileNumber,
      paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
    });
    if (dupe) {
      registration.paymentStatus = PAYMENT_STATUS.FAILED;
      registration.processingLock = false;
      registration.notes = [
        registration.notes,
        `Auto-failed: mobile already confirmed under ${dupe.registrationNumber || dupe.orderId}. Possible duplicate payment — review for refund.`,
      ]
        .filter(Boolean)
        .join(' | ');
      await registration.save();
      return { registration, changed: true, reason: 'duplicate mobile' };
    }

    // Allocate the next sequential registration code atomically (the counter is
    // race-safe, so concurrent confirmations each get a distinct number).
    if (!registration.registrationNumber) {
      registration.registrationNumber = await nextRegistrationNumber();
    }
    registration.paymentStatus = PAYMENT_STATUS.CONFIRMED;
    registration.confirmedAt = new Date();
    registration.processingLock = false;
    await registration.save();

    // Send the confirmation + QR via WhatsApp. Fire-and-forget so the user's
    // redirect/poll is never delayed by Meta's API; it never throws.
    sendConfirmationWhatsApp(registration).catch((err) =>
      console.error(`[whatsapp] unexpected send error: ${err?.message || err}`)
    );

    // Backup confirmation email to the registrant (only sends if they gave an
    // email) + organizer notification of the completed payment. Fire-and-forget.
    sendUserConfirmationEmail(registration).catch((err) =>
      console.error(`[email] unexpected user send error: ${err?.message || err}`)
    );
    sendOrganizerNotification(registration).catch((err) =>
      console.error(`[email] unexpected organizer send error: ${err?.message || err}`)
    );

    return { registration, changed: true, reason: 'confirmed' };
  }

  // FAILURE / ABORTED / UNKNOWN
  registration.paymentStatus = PAYMENT_STATUS.FAILED;
  registration.processingLock = false;
  await registration.save();
  return { registration, changed: true, reason: 'failed' };
};

/**
 * POST /api/payment/initiate
 * Build the HDFC payment request for an existing PENDING order.
 */
export const initiatePayment = asyncHandler(async (req, res) => {
  const { orderId } = req.body || {};
  if (!orderId) {
    res.status(400);
    throw new Error('orderId is required');
  }

  const registration = await Registration.findOne({ orderId });
  if (!registration) {
    res.status(404);
    throw new Error('Registration not found for this order');
  }

  if (Registration.SEAT_HOLDING_STATUSES.includes(registration.paymentStatus)) {
    res.status(409);
    throw new Error('This registration is already confirmed.');
  }

  // Duplicate-payment guard: another confirmed reg for this mobile.
  const dupe = await Registration.findOne({
    mobileNumber: registration.mobileNumber,
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
  });
  if (dupe) {
    res.status(409);
    throw new Error('This mobile number is already registered.');
  }

  registration.paymentAttempts += 1;
  await registration.save();

  let payment;
  try {
    payment = await buildPaymentRequest({
      orderId: registration.orderId,
      amount: registration.amount,
      customerName: registration.fullName,
      customerMobile: registration.mobileNumber,
      customerEmail: registration.emailAddress,
    });
  } catch (err) {
    // Don't leak gateway internals to the client; log the detail server-side.
    console.error(`[payment] initiate failed for ${registration.orderId}: ${err.message}`);
    res.status(502);
    throw new Error('Could not start payment right now. Please try again in a moment.');
  }

  res.json({
    success: true,
    data: {
      mock: payment.mock,
      paymentUrl: payment.paymentUrl,
      fields: payment.fields,
      method: payment.method,
    },
  });
});

/**
 * POST or GET /api/payment/callback
 * Browser redirect target after payment. Verifies signature, finalises the
 * registration, then redirects the user to the appropriate frontend page.
 */
export const paymentCallback = asyncHandler(async (req, res) => {
  const body = { ...req.query, ...req.body };
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  // HMAC-verify (live) / hash-verify (mock) before any DB mutation.
  const parsed = parseHdfcResponse(body);

  let toApply = parsed;
  if (!parsed.verified) {
    // The return-URL signature didn't verify. Rather than failing a possibly-
    // paid order outright (e.g. a signature-format edge case), reconcile against
    // the AUTHORITATIVE Order Status API — a server-to-server call signed with
    // our secret key. A forged callback still can't fake a paid status here, so
    // this stays secure while being resilient to redirect-signature quirks.
    console.warn(
      `[payment] callback signature unverified for ${parsed.orderId}; reconciling via Order Status API`
    );
    const gwStatus = parsed.orderId ? await fetchOrderStatus(parsed.orderId) : null;
    if (!gwStatus || gwStatus === 'UNKNOWN') {
      return res.redirect(
        `${clientUrl}/payment-failed?orderId=${encodeURIComponent(parsed.orderId || '')}&reason=signature`
      );
    }
    toApply = {
      orderId: parsed.orderId,
      status: gwStatus,
      txnId: parsed.txnId,
      raw: { source: 'callback-reconciled', status: gwStatus, original: parsed.raw },
    };
  }

  const result = await applyPaymentResult(toApply);
  const confirmed =
    result.registration &&
    (result.registration.paymentStatus === PAYMENT_STATUS.CONFIRMED ||
      result.registration.paymentStatus === PAYMENT_STATUS.MANUAL);

  const target = confirmed ? 'thank-you' : 'payment-failed';
  let redirectUrl = `${clientUrl}/${target}?orderId=${encodeURIComponent(parsed.orderId || '')}`;
  // A payment that succeeded at the gateway but was auto-failed because the
  // mobile already holds a seat is a real charge needing a manual refund — flag
  // it so the failed page shows the correct "refund on review" message rather
  // than the generic "auto-reversed" copy.
  if (!confirmed && result.reason === 'duplicate mobile') {
    redirectUrl += '&reason=duplicate';
  }
  return res.redirect(redirectUrl);
});

/**
 * POST /api/payment/webhook
 * Server-to-server notification. Independent confirmation path.
 *
 * Live (SmartGateway/Juspay): the webhook body shape/auth differs from the
 * return-URL params and is not something we can trust blindly, so we treat the
 * webhook purely as a "wake up and reconcile" trigger — we extract the order id
 * and re-query the AUTHORITATIVE Order Status API. A forged webhook therefore
 * cannot confirm an unpaid order (the gateway would report it as not paid).
 *
 * Mock: the mock webhook carries our self-consistent hash, so verify it directly.
 */
export const paymentWebhook = asyncHandler(async (req, res) => {
  const body = req.body || {};

  if (isMockMode()) {
    const parsed = parseHdfcResponse(body);
    if (!parsed.verified) {
      console.warn(`[payment] mock webhook verification failed for order ${parsed.orderId}`);
      return res.status(200).json({ success: false, message: 'verification failed' });
    }
    const result = await applyPaymentResult(parsed);
    return res.status(200).json({ success: true, changed: result.changed, reason: result.reason });
  }

  // Live: pull the order id from the common Juspay webhook locations.
  const orderId =
    body.order_id ||
    body.content?.order?.order_id ||
    body.data?.order?.order_id ||
    body.order?.order_id ||
    '';
  if (!orderId) {
    return res.status(200).json({ success: false, message: 'no order id in webhook' });
  }

  const status = await fetchOrderStatus(orderId);
  if (!status) {
    console.warn(`[payment] webhook could not fetch authoritative status for ${orderId}`);
    // 200 so the gateway doesn't hammer retries; nothing recorded.
    return res.status(200).json({ success: false, message: 'status unavailable' });
  }

  const result = await applyPaymentResult({
    orderId,
    status,
    txnId: '',
    raw: { source: 'webhook', status },
  });
  return res.status(200).json({ success: true, changed: result.changed, reason: result.reason });
});

/**
 * Background sweep for orders stuck at PENDING because neither the browser
 * redirect nor the webhook ever reached us (user closed the tab, webhook
 * misfired, etc.) and no one has since polled /status to trigger the
 * reconciliation fallback there. Without this, an order that HDFC already
 * finalised (declined or charged) can sit as PENDING in our DB forever.
 * Only looks at orders past HDFC's own ~15min session expiry, so it never
 * fights with an attempt that's still genuinely in progress.
 */
export const reconcileStalePendingPayments = async () => {
  if (isMockMode()) return;

  const staleBefore = new Date(Date.now() - 20 * 60 * 1000);
  const stale = await Registration.find({
    paymentStatus: PAYMENT_STATUS.PENDING,
    createdAt: { $lt: staleBefore },
  })
    .limit(50)
    .lean();

  for (const reg of stale) {
    try {
      const gwStatus = await fetchOrderStatus(reg.orderId);
      if (gwStatus === 'SUCCESS' || gwStatus === 'FAILURE' || gwStatus === 'ABORTED') {
        await applyPaymentResult({
          orderId: reg.orderId,
          status: gwStatus,
          txnId: reg.hdfc_txn_id,
          raw: { source: 'stale-sweep', status: gwStatus },
        });
      }
    } catch (err) {
      console.error(`[payment] stale-sweep failed for ${reg.orderId}: ${err?.message || err}`);
    }
  }
};

/**
 * GET /api/payment/status/:orderId
 * Polled by the Thank You / Payment Failed pages.
 */
export const getPaymentStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  let registration = await Registration.findOne({ orderId });
  if (!registration) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Live reconciliation safety net: if the order is still PENDING, ask the
  // gateway directly. Covers the case where BOTH the browser redirect and the
  // webhook were missed (e.g. the user closed the tab right after paying).
  // fetchOrderStatus fails closed (returns null) so this never blocks the poll.
  if (!isMockMode() && registration.paymentStatus === PAYMENT_STATUS.PENDING) {
    const gwStatus = await fetchOrderStatus(orderId);
    if (gwStatus === 'SUCCESS' || gwStatus === 'FAILURE' || gwStatus === 'ABORTED') {
      await applyPaymentResult({
        orderId,
        status: gwStatus,
        txnId: registration.hdfc_txn_id,
        raw: { source: 'status-poll', status: gwStatus },
      });
      registration = await Registration.findOne({ orderId });
    }
  }

  // This endpoint is public (polled by the Thank-You page with just an orderId),
  // so return only what that page renders and avoid leaking full PII. The mobile
  // is masked to its last 4 digits and the email is omitted entirely.
  const maskMobile = (m) => {
    const d = String(m || '');
    return d.length >= 4 ? `••••••${d.slice(-4)}` : d;
  };

  // Public PII (name, masked mobile, amount): never cache anywhere.
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    data: {
      orderId: registration.orderId,
      paymentStatus: registration.paymentStatus,
      registrationNumber: registration.registrationNumber || null,
      fullName: registration.fullName,
      mobileNumber: maskMobile(registration.mobileNumber),
      preparingFor: registration.preparingFor,
      confirmedAt: registration.confirmedAt,
      amount: registration.amount,
    },
  });
});

/**
 * GET /api/payment/mock-pay?orderId=...
 * MOCK ONLY. A tiny self-contained page that simulates the HDFC hosted
 * checkout so the full flow is testable without real credentials.
 */
export const mockPayPage = asyncHandler(async (req, res) => {
  if (!isMockMode()) {
    res.status(404);
    throw new Error('Not found');
  }
  const orderId = String(req.query.orderId || '');
  const registration = await Registration.findOne({ orderId });
  if (!registration) {
    res.status(404).send('Order not found');
    return;
  }

  // Escape values interpolated into the HTML below. The registrant's name/mobile
  // and the order id are user-influenced, so they must never be rendered raw
  // (XSS) — even on this mock-only page, which is reachable in the live mock-mode
  // deploy.
  const esc = (v) =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // Build each callback payload ONCE so the rendered hidden fields are exactly
  // the fields the hash was computed over (otherwise signature verification on
  // the callback would mismatch — e.g. a freshly regenerated tracking_id).
  const success = buildMockCallback(orderId, 'CHARGED');
  const failure = buildMockCallback(orderId, 'FAILURE');
  const hiddenInputs = (payload) =>
    Object.entries(payload)
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}"/>`)
      .join('');

  res.set('Content-Type', 'text/html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>HDFC Mock Checkout — NEET CON 2026</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;background:#001e5f;color:#fff;display:flex;
    align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#08296f;padding:32px;border-radius:16px;max-width:380px;width:90%;
    box-shadow:0 20px 60px rgba(0,0,0,.4)}
  h1{font-size:18px;margin:0 0 4px}.muted{color:#a8b6e0;font-size:13px;margin:0 0 20px}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #123a8a;font-size:14px}
  .amount{font-size:28px;font-weight:700;color:#4063fa;margin:18px 0}
  button{width:100%;padding:14px;border:0;border-radius:10px;font-size:15px;font-weight:600;
    cursor:pointer;margin-top:10px}
  .pay{background:#002ef4;color:#fff}.fail{background:transparent;color:#ff8a8a;border:1px solid #ff8a8a}
  .tag{display:inline-block;background:#002ef4;color:#fff;font-size:11px;padding:2px 8px;border-radius:999px;margin-bottom:12px}
</style></head>
<body><div class="card">
  <span class="tag">MOCK GATEWAY</span>
  <h1>NEET CON 2026 — Payment</h1>
  <p class="muted">HDFC credentials not configured. Simulating checkout.</p>
  <div class="row"><span>Name</span><strong>${esc(registration.fullName)}</strong></div>
  <div class="row"><span>Mobile</span><strong>${esc(registration.mobileNumber)}</strong></div>
  <div class="row"><span>Order</span><strong>${esc(orderId)}</strong></div>
  <div class="amount">₹${Number(registration.amount).toFixed(2)}</div>
  <form method="GET" action="/api/payment/callback">
    ${hiddenInputs(success)}
    <button class="pay" type="submit">Pay ₹${Number(registration.amount).toFixed(2)} (Simulate Success)</button>
  </form>
  <form method="GET" action="/api/payment/callback">
    ${hiddenInputs(failure)}
    <button class="fail" type="submit">Simulate Failure</button>
  </form>
</div></body></html>`);
});
