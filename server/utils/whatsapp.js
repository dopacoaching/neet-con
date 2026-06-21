import { generateQrBuffer } from './qrcode.js';

/**
 * WhatsApp confirmation sender — Meta WhatsApp Cloud API.
 *
 * ------------------------------------------------------------------------
 *  Business-initiated WhatsApp messages must use a PRE-APPROVED template.
 *  We send one template message whose HEADER is the entry QR (image) and
 *  whose BODY carries the registration details.
 *
 *  You must create + get approved (in Meta WhatsApp Manager) a template with:
 *    - Name:     matches WHATSAPP_TEMPLATE_NAME (e.g. neetcon_confirmation)
 *    - Category: UTILITY
 *    - Header:   IMAGE
 *    - Body with 7 NAMED variables (Meta's current editor requires named, not
 *      numbered, parameters — lowercase + underscores):
 *        {{full_name}} {{registration_code}} {{preparing_for}}
 *        {{event_date}} {{event_time}} {{venue}} {{amount}}
 *      Example body text:
 *        "Hi {{full_name}}, your NEET CON 2026 seat is CONFIRMED ✅
 *         Registration Code: {{registration_code}}
 *         Preparing For: {{preparing_for}}
 *         Date: {{event_date}}, Time: {{event_time}}
 *         Venue: {{venue}}
 *         Amount Paid: ₹{{amount}}
 *         Show the QR above at the entry desk. See you there!"
 *    - Optional buttons: a STATIC URL button "Get Directions" -> Google Maps
 *      link for the venue. Static-URL buttons need NO code change (only dynamic
 *      {{n}} URL buttons would). The QR is always the image header (top).
 *
 *  ENV (server/.env, never commit):
 *    WHATSAPP_PHONE_NUMBER_ID   the Cloud API phone number id
 *    WHATSAPP_ACCESS_TOKEN      a permanent/system-user access token
 *    WHATSAPP_TEMPLATE_NAME     approved template name
 *    WHATSAPP_TEMPLATE_LANG     template language code (default 'en')
 *    WHATSAPP_COUNTRY_CODE      default '91' (prepended to 10-digit numbers)
 *    WHATSAPP_API_VERSION       Graph API version (default 'v21.0')
 *    WHATSAPP_MOCK              true = simulate locally (no real send)
 * ------------------------------------------------------------------------
 */

const GRAPH = 'https://graph.facebook.com';

const API_VERSION = () => process.env.WHATSAPP_API_VERSION || 'v21.0';
const PHONE_NUMBER_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const ACCESS_TOKEN = () => process.env.WHATSAPP_ACCESS_TOKEN || '';
const TEMPLATE_NAME = () => process.env.WHATSAPP_TEMPLATE_NAME || '';
const TEMPLATE_LANG = () => process.env.WHATSAPP_TEMPLATE_LANG || 'en';
const COUNTRY_CODE = () => process.env.WHATSAPP_COUNTRY_CODE || '91';

export const isWhatsAppMock = () => String(process.env.WHATSAPP_MOCK).toLowerCase() === 'true';

const isConfigured = () => !!(PHONE_NUMBER_ID() && ACCESS_TOKEN() && TEMPLATE_NAME());

const EVENT = {
  date: process.env.EVENT_DATE || '12 July 2026',
  time: process.env.EVENT_TIME || '9:30 AM - 5:00 PM',
  venue: process.env.EVENT_VENUE || 'Yamaniya Hall, Kuttikattor',
};

/**
 * Convert a stored mobile number to WhatsApp's E.164-without-plus form.
 * 9876543210 -> 919876543210 ; leaves already-prefixed numbers untouched.
 * @param {string} mobile
 * @returns {string}
 */
export const toWhatsAppNumber = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length === 10) return `${COUNTRY_CODE()}${digits}`;
  return digits;
};

/**
 * Upload the QR PNG to Meta and return a reusable media id.
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {Promise<string>}
 */
const uploadQrMedia = async (buffer, filename) => {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'image/png');
  form.append('file', new Blob([buffer], { type: 'image/png' }), filename);

  const res = await fetch(`${GRAPH}/${API_VERSION()}/${PHONE_NUMBER_ID()}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN()}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) {
    throw new Error(`media upload failed (${res.status}): ${JSON.stringify(json.error || json).slice(0, 200)}`);
  }
  return json.id;
};

/**
 * Send the confirmation + QR to the registrant's WhatsApp.
 * Never throws — returns a result object the caller can log.
 *
 * @param {object} reg  the confirmed registration document
 * @returns {Promise<{ sent: boolean, reason?: string, messageId?: string }>}
 */
export const sendConfirmationWhatsApp = async (reg) => {
  if (!reg?.mobileNumber) {
    return { sent: false, reason: 'no mobile number on record' };
  }
  const to = toWhatsAppNumber(reg.mobileNumber);

  if (isWhatsAppMock()) {
    console.log(
      `[whatsapp] MOCK — would send confirmation to ${to} (${reg.registrationNumber}). ` +
        'Set WHATSAPP_MOCK=false + WHATSAPP_* envs for real delivery.'
    );
    return { sent: true, reason: 'mock' };
  }

  if (!isConfigured()) {
    console.warn(
      `[whatsapp] not configured — skipped ${to} (${reg.registrationNumber}). ` +
        'Set WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN / WHATSAPP_TEMPLATE_NAME.'
    );
    return { sent: false, reason: 'not configured' };
  }

  try {
    const qrBuffer = await generateQrBuffer(reg.registrationNumber);
    const mediaId = await uploadQrMedia(
      qrBuffer,
      `${String(reg.registrationNumber).replace(/\s+/g, '-')}-qr.png`
    );

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: TEMPLATE_NAME(),
        language: { code: TEMPLATE_LANG() },
        components: [
          { type: 'header', parameters: [{ type: 'image', image: { id: mediaId } }] },
          {
            type: 'body',
            parameters: [
              { type: 'text', parameter_name: 'full_name', text: String(reg.fullName) },
              {
                type: 'text',
                parameter_name: 'registration_code',
                text: String(reg.registrationNumber),
              },
              { type: 'text', parameter_name: 'preparing_for', text: String(reg.preparingFor) },
              { type: 'text', parameter_name: 'event_date', text: EVENT.date },
              { type: 'text', parameter_name: 'event_time', text: EVENT.time },
              { type: 'text', parameter_name: 'venue', text: EVENT.venue },
              { type: 'text', parameter_name: 'amount', text: String(reg.amount) },
            ],
          },
        ],
      },
    };

    const res = await fetch(`${GRAPH}/${API_VERSION()}/${PHONE_NUMBER_ID()}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ACCESS_TOKEN()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`send failed (${res.status}): ${JSON.stringify(json.error || json).slice(0, 250)}`);
    }

    const messageId = json?.messages?.[0]?.id;
    console.log(`[whatsapp] confirmation sent to ${to} (${reg.registrationNumber}) id=${messageId}`);
    return { sent: true, messageId };
  } catch (err) {
    console.error(`[whatsapp] failed to send to ${to}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
};
