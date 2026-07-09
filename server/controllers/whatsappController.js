import crypto from 'crypto';
import Registration from '../models/Registration.js';

/** Reduce a WhatsApp "from" number (E.164, no +) to its 10-digit Indian core. */
const normalizeMobileFromWhatsApp = (from) => {
  const digits = String(from || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/** Parse a free-text guest-count reply into a clamped 0-20 integer, or null if unparseable. */
const parseGuestReply = (text) => {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return null;
  if (/^(no|none|nobody|no ?one|alone|solo|myself|just me)$/.test(t)) return 0;
  const match = t.match(/\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(n, 20);
};

/**
 * If this inbound text is a reply to the "how many guests?" follow-up (i.e.
 * from a mobile we asked, who hasn't answered yet), capture it into
 * Registration.guestCount. No-op for anything else — never throws.
 */
const handleInboundGuestCountReply = async (msg) => {
  if (msg.type !== 'text') return;
  const mobile = normalizeMobileFromWhatsApp(msg.from);
  if (mobile.length !== 10) return;

  const reg = await Registration.findOne({
    mobileNumber: mobile,
    guestCountAskedAt: { $ne: null },
    guestCount: { $exists: false },
  }).sort({ guestCountAskedAt: -1 });
  if (!reg) return; // not something we asked, or already answered

  const guestCount = parseGuestReply(msg.text?.body);
  if (guestCount === null) {
    // Couldn't parse it — stash the raw text on the record itself (survives a
    // server restart, unlike the in-memory debug buffer) so an admin can read
    // it and set guestCount manually via the dashboard.
    reg.guestCountReplyRaw = String(msg.text?.body || '').slice(0, 500);
    reg.guestCountReplyAt = new Date();
    await reg.save();
    console.warn(
      `[whatsapp-webhook] unparsed guest-count reply from ${mobile}: "${msg.text?.body || ''}"`
    );
    remember({ kind: 'guest_count_unparsed', from: msg.from, text: msg.text?.body || '' });
    return;
  }

  reg.guestCount = guestCount;
  reg.guestCountReplyRaw = '';
  reg.guestCountReplyAt = new Date();
  await reg.save();
  console.log(
    `[whatsapp-webhook] captured guestCount=${guestCount} for ${reg.registrationNumber} (${mobile})`
  );
  remember({
    kind: 'guest_count_captured',
    from: msg.from,
    registrationNumber: reg.registrationNumber,
    guestCount,
  });
};

/** Constant-time string comparison that never throws on length mismatch. */
const safeEqual = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

/**
 * Verify Meta's X-Hub-Signature-256 over the raw body using the app secret.
 * If WHATSAPP_APP_SECRET isn't configured, we can't verify — return true so
 * behaviour is unchanged (webhook only logs; it never mutates data).
 */
const verifyMetaSignature = (req) => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  const received = req.get('x-hub-signature-256') || '';
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(req.rawBody || Buffer.from('')).digest('hex');
  return safeEqual(received, expected);
};

// In-memory ring buffer of the most recent webhook events, for quick debugging
// via GET /api/whatsapp/debug (gated by WHATSAPP_VERIFY_TOKEN). Not persisted.
const RECENT = [];
const remember = (evt) => {
  RECENT.unshift({ at: new Date().toISOString(), ...evt });
  if (RECENT.length > 50) RECENT.length = 50;
};

/**
 * Meta WhatsApp webhook.
 *
 * GET  — verification handshake. Meta calls this once with hub.* query params
 *        when you save the callback URL; echo back hub.challenge if the token
 *        matches WHATSAPP_VERIFY_TOKEN.
 * POST — delivery/status + inbound message events. We log message *status*
 *        callbacks (sent / delivered / read / failed) so deliverability — and
 *        the exact failure reason/code — is visible in the server logs.
 *
 * Subscribe the WABA to the "messages" field in the app's Webhooks config.
 */

/** GET /api/whatsapp/webhook — verification handshake. */
export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[whatsapp-webhook] verified');
    return res.status(200).send(challenge);
  }
  console.warn('[whatsapp-webhook] verification failed (token mismatch)');
  return res.sendStatus(403);
};

/**
 * GET /api/whatsapp/debug?token=... — recent webhook events for debugging.
 * Gated by WHATSAPP_VERIFY_TOKEN so it isn't world-readable.
 */
export const debugRecent = (req, res) => {
  if (!process.env.WHATSAPP_VERIFY_TOKEN || !safeEqual(req.query.token, process.env.WHATSAPP_VERIFY_TOKEN)) {
    return res.sendStatus(403);
  }
  // Events contain recipient phone numbers — never cache.
  res.set('Cache-Control', 'no-store');
  return res.json({ success: true, count: RECENT.length, events: RECENT });
};

/** POST /api/whatsapp/webhook — status + inbound message events. */
export const receiveWebhook = (req, res) => {
  // Always 200 fast so Meta doesn't retry. Parsing is best-effort and must never
  // throw back to Express (headers are already sent), so it's wrapped in try/catch.
  res.sendStatus(200);

  try {
    // Reject forged events when an app secret is configured (log-poisoning guard).
    if (!verifyMetaSignature(req)) {
      console.warn('[whatsapp-webhook] signature verification failed — ignoring payload');
      return;
    }
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};

        // Delivery/read/failure status callbacks for messages we sent.
        for (const status of value.statuses || []) {
          const errors = (status.errors || []).map((e) => ({
            code: e.code,
            title: e.title,
            details: e.error_data?.details || e.message || '',
          }));
          const errs = errors
            .map((e) => `${e.code} ${e.title}${e.details ? ` — ${e.details}` : ''}`)
            .join('; ');
          console.log(
            `[whatsapp-webhook] status=${status.status} to=${status.recipient_id} ` +
              `id=${status.id}${errs ? ` ERROR: ${errs}` : ''}`
          );
          remember({
            kind: 'status',
            status: status.status,
            to: status.recipient_id,
            id: status.id,
            errors,
          });
        }

        // Inbound messages from users (not needed for confirmations, but useful).
        for (const msg of value.messages || []) {
          console.log(
            `[whatsapp-webhook] inbound from=${msg.from} type=${msg.type} ` +
              `text=${msg.text?.body || ''}`
          );
          remember({ kind: 'inbound', from: msg.from, type: msg.type, text: msg.text?.body || '' });

          // Fire-and-forget: capture a guest-count reply if this mobile is
          // one we asked. Never blocks/throws back into the webhook handler.
          handleInboundGuestCountReply(msg).catch((err) =>
            console.error(`[whatsapp-webhook] guest-count capture failed: ${err.message}`)
          );
        }
      }
    }
  } catch (err) {
    console.error(`[whatsapp-webhook] failed to parse event: ${err.message}`);
  }
};
