import Registration, { PAYMENT_STATUS } from '../models/Registration.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getSeatStats } from '../utils/seats.js';
import { nextRegistrationNumber } from '../utils/registrationNumber.js';
import { sendConfirmationWhatsApp } from '../utils/whatsapp.js';
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

  const registration = await Registration.findOne({ orderId });
  if (!registration) return { registration: null, changed: false, reason: 'order not found' };

  // Already finalised — do not overwrite a CONFIRMED/MANUAL record.
  if (
    registration.paymentStatus === PAYMENT_STATUS.CONFIRMED ||
    registration.paymentStatus === PAYMENT_STATUS.MANUAL
  ) {
    return { registration, changed: false, reason: 'already confirmed' };
  }

  registration.hdfc_txn_id = txnId || registration.hdfc_txn_id;
  registration.hdfc_response = raw;

  if (status === 'SUCCESS') {
    // Enforce seat cap at confirmation time (the real authority).
    const seats = await getSeatStats();
    if (seats.isFull) {
      registration.paymentStatus = PAYMENT_STATUS.FAILED;
      registration.notes = [registration.notes, 'Auto-failed: seats full at confirmation time.']
        .filter(Boolean)
        .join(' | ');
      await registration.save();
      return { registration, changed: true, reason: 'seats full' };
    }

    if (!registration.registrationNumber) {
      registration.registrationNumber = await nextRegistrationNumber();
    }
    registration.paymentStatus = PAYMENT_STATUS.CONFIRMED;
    registration.confirmedAt = new Date();
    await registration.save();

    // Send the confirmation + QR via WhatsApp. Best-effort: never blocks/fails
    // the confirmation if WhatsApp is down or unconfigured.
    await sendConfirmationWhatsApp(registration);

    return { registration, changed: true, reason: 'confirmed' };
  }

  // FAILURE / ABORTED / UNKNOWN
  registration.paymentStatus = PAYMENT_STATUS.FAILED;
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

  if (
    registration.paymentStatus === PAYMENT_STATUS.CONFIRMED ||
    registration.paymentStatus === PAYMENT_STATUS.MANUAL
  ) {
    res.status(409);
    throw new Error('This registration is already confirmed.');
  }

  // Duplicate-payment guard: another confirmed reg for this mobile.
  const dupe = await Registration.findOne({
    mobileNumber: registration.mobileNumber,
    paymentStatus: { $in: [PAYMENT_STATUS.CONFIRMED, PAYMENT_STATUS.MANUAL] },
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
  if (!parsed.verified) {
    console.warn(`[payment] callback verification failed for order ${parsed.orderId}`);
    return res.redirect(
      `${clientUrl}/payment-failed?orderId=${encodeURIComponent(parsed.orderId || '')}&reason=signature`
    );
  }

  const result = await applyPaymentResult(parsed);
  const confirmed =
    result.registration &&
    (result.registration.paymentStatus === PAYMENT_STATUS.CONFIRMED ||
      result.registration.paymentStatus === PAYMENT_STATUS.MANUAL);

  const target = confirmed ? 'thank-you' : 'payment-failed';
  return res.redirect(`${clientUrl}/${target}?orderId=${encodeURIComponent(parsed.orderId || '')}`);
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

  res.json({
    success: true,
    data: {
      orderId: registration.orderId,
      paymentStatus: registration.paymentStatus,
      registrationNumber: registration.registrationNumber || null,
      fullName: registration.fullName,
      emailAddress: registration.emailAddress,
      mobileNumber: registration.mobileNumber,
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

  // Build each callback payload ONCE so the rendered hidden fields are exactly
  // the fields the hash was computed over (otherwise signature verification on
  // the callback would mismatch — e.g. a freshly regenerated tracking_id).
  const success = buildMockCallback(orderId, 'CHARGED');
  const failure = buildMockCallback(orderId, 'FAILURE');
  const hiddenInputs = (payload) =>
    Object.entries(payload)
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v)}"/>`)
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
  <div class="row"><span>Name</span><strong>${registration.fullName}</strong></div>
  <div class="row"><span>Mobile</span><strong>${registration.mobileNumber}</strong></div>
  <div class="row"><span>Order</span><strong>${orderId}</strong></div>
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
