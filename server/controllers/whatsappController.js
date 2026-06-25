import { asyncHandler } from '../middleware/errorHandler.js';

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
  if (!process.env.WHATSAPP_VERIFY_TOKEN || req.query.token !== process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.sendStatus(403);
  }
  return res.json({ success: true, count: RECENT.length, events: RECENT });
};

/** POST /api/whatsapp/webhook — status + inbound message events. */
export const receiveWebhook = asyncHandler(async (req, res) => {
  // Always 200 fast so Meta doesn't retry; do the logging after.
  res.sendStatus(200);

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
      }
    }
  }
});
