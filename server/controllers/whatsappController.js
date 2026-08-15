import crypto from 'crypto';
import Registration, { CURRENT_EVENT } from '../models/Registration.js';

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

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const WHATSAPP_GRAPH = 'https://graph.facebook.com';

const toWhatsAppNumber = (mobile) => {
  const countryCode = process.env.WHATSAPP_COUNTRY_CODE || '91';
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length === 10 ? `${countryCode}${digits}` : digits;
};

/**
 * Send one "meeting starts in 15 minutes" reschedule-day reminder to a single
 * registrant, via the approved WHATSAPP_MEETING_STARTING_TEMPLATE_NAME
 * template. Shared by the one-off script (server/scripts/sendMeetingStarting.js)
 * and the /trigger-meeting-starting endpoint below, so both stay in sync.
 */
const sendMeetingStartingTo = async (reg) => {
  const templateName = process.env.WHATSAPP_MEETING_STARTING_TEMPLATE_NAME || 'careerx_meeting_starting_v1';
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
  const zoomLink =
    process.env.MEETING_STARTING_ZOOM_LINK ||
    'https://us06web.zoom.us/j/84104668901?pwd=MTNBItV4sbuiOUzQ1u7WWueG1DwNfG.1';

  const payload = {
    messaging_product: 'whatsapp',
    to: toWhatsAppNumber(reg.mobileNumber),
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'full_name', text: String(reg.fullName) },
            { type: 'text', parameter_name: 'ticket_id', text: String(reg.registrationNumber) },
            { type: 'text', parameter_name: 'zoom_link', text: zoomLink },
          ],
        },
      ],
    },
  };
  const res = await fetch(
    `${WHATSAPP_GRAPH}/${WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json();
  return { sent: !!data?.messages?.[0]?.id, reason: data?.error?.message || '' };
};

/**
 * Send one "meeting starts in 15 minutes" reminder for the Aug 15 occurrence,
 * via the approved WHATSAPP_MEETING_STARTING_V3_TEMPLATE_NAME template
 * (meeting ID/passcode are static text baked into that template's body — a
 * v2 attempt with them as separate variables was REJECTED by Meta as
 * INCORRECT_CATEGORY, so each occurrence needs its own template + script).
 */
const sendMeetingStartingV3To = async (reg) => {
  const templateName = process.env.WHATSAPP_MEETING_STARTING_V3_TEMPLATE_NAME || 'careerx_meeting_starting_v3';
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
  const zoomLink =
    process.env.MEETING_STARTING_V3_ZOOM_LINK ||
    'https://us06web.zoom.us/j/82204853317?pwd=9S01oY7e9sZsgsI9tnCgT5OXWteVrg.1';

  const payload = {
    messaging_product: 'whatsapp',
    to: toWhatsAppNumber(reg.mobileNumber),
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'full_name', text: String(reg.fullName) },
            { type: 'text', parameter_name: 'ticket_id', text: String(reg.registrationNumber) },
            { type: 'text', parameter_name: 'zoom_link', text: zoomLink },
          ],
        },
      ],
    },
  };
  const res = await fetch(
    `${WHATSAPP_GRAPH}/${WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json();
  return { sent: !!data?.messages?.[0]?.id, reason: data?.error?.message || '' };
};

/**
 * Send the automatic "broadcast finished" status report to the admin's own
 * WhatsApp number, via the approved careerx_broadcast_report_v1 template.
 * Never throws — a report failure shouldn't mask the broadcast's own result
 * in the HTTP response.
 */
const sendBroadcastReport = async (broadcastName, { total, sent, failed }) => {
  const adminNumber = process.env.BROADCAST_REPORT_NUMBER;
  if (!adminNumber) return;
  const templateName = process.env.WHATSAPP_BROADCAST_REPORT_TEMPLATE_NAME || 'careerx_broadcast_report_v1';
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || 'en';

  const payload = {
    messaging_product: 'whatsapp',
    to: toWhatsAppNumber(adminNumber),
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'broadcast_name', text: broadcastName },
            { type: 'text', parameter_name: 'total', text: String(total) },
            { type: 'text', parameter_name: 'sent', text: String(sent) },
            { type: 'text', parameter_name: 'failed', text: String(failed) },
          ],
        },
      ],
    },
  };
  try {
    const res = await fetch(
      `${WHATSAPP_GRAPH}/${WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    if (!data?.messages?.[0]?.id) {
      console.error(`[broadcast-report] failed to send: ${data?.error?.message || 'unknown error'}`);
    }
  } catch (err) {
    console.error(`[broadcast-report] failed to send: ${err.message}`);
  }
};

/**
 * POST /api/whatsapp/trigger-meeting-starting?token=... — one-off, gated by
 * CRON_TRIGGER_SECRET (not admin login) so an external scheduler — GitHub
 * Actions cron, since this Render service has no built-in scheduler and the
 * free plan can be asleep — can fire it at 7:15 PM IST 2026-08-13 without a
 * browser session. Broadcasts the "meeting starts in 15 minutes" WhatsApp
 * reminder to every confirmed CareerX registrant not yet sent one
 * (meetingStartingSentAt null), querying fresh at call time so it also
 * covers anyone who registers between now and the trigger.
 */
export const triggerMeetingStarting = async (req, res) => {
  const secret = process.env.CRON_TRIGGER_SECRET;
  const provided = req.query.token || req.get('x-cron-secret');
  if (!secret || !safeEqual(provided, secret)) {
    return res.sendStatus(403);
  }

  const targets = await Registration.find({
    event: CURRENT_EVENT,
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
    registrationNumber: { $ne: null },
    meetingStartingSentAt: null,
  }).sort({ createdAt: 1 });

  // Verifies the secret + eligible-recipient count without sending anything —
  // use this to confirm CRON_TRIGGER_SECRET is wired up on Render before 7:15 PM.
  if (req.query.dryRun === 'true') {
    return res.json({ success: true, dryRun: true, eligible: targets.length });
  }

  let sent = 0;
  const failures = [];
  for (const reg of targets) {
    const result = await sendMeetingStartingTo(reg);
    if (result.sent) {
      await Registration.updateOne({ _id: reg._id }, { $set: { meetingStartingSentAt: new Date() } });
      sent += 1;
    } else {
      failures.push({ registrationNumber: reg.registrationNumber, reason: result.reason });
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[meeting-starting] triggered via HTTP: sent=${sent} failed=${failures.length}`);
  await sendBroadcastReport('meeting-starting', { total: targets.length, sent, failed: failures.length });
  return res.json({ success: true, total: targets.length, sent, failed: failures.length, failures });
};

/**
 * POST /api/whatsapp/trigger-meeting-starting-v3?token=... — same pattern as
 * triggerMeetingStarting above, for the Aug 15 occurrence (7:15 PM IST
 * 2026-08-15). Uses meetingStartingV3SentAt so repeat registrants who
 * already got the Aug 13 reminder still get this one.
 */
export const triggerMeetingStartingV3 = async (req, res) => {
  const secret = process.env.CRON_TRIGGER_SECRET;
  const provided = req.query.token || req.get('x-cron-secret');
  if (!secret || !safeEqual(provided, secret)) {
    return res.sendStatus(403);
  }

  const targets = await Registration.find({
    event: CURRENT_EVENT,
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
    registrationNumber: { $ne: null },
    meetingStartingV3SentAt: null,
  }).sort({ createdAt: 1 });

  if (req.query.dryRun === 'true') {
    return res.json({ success: true, dryRun: true, eligible: targets.length });
  }

  let sent = 0;
  const failures = [];
  for (const reg of targets) {
    const result = await sendMeetingStartingV3To(reg);
    if (result.sent) {
      await Registration.updateOne({ _id: reg._id }, { $set: { meetingStartingV3SentAt: new Date() } });
      sent += 1;
    } else {
      failures.push({ registrationNumber: reg.registrationNumber, reason: result.reason });
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`[meeting-starting-v3] triggered via HTTP: sent=${sent} failed=${failures.length}`);
  await sendBroadcastReport('meeting-starting-v3', { total: targets.length, sent, failed: failures.length });
  return res.json({ success: true, total: targets.length, sent, failed: failures.length, failures });
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
