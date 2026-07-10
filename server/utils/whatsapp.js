import { generateQrBuffer } from './qrcode.js';
import { generateEventPass } from './eventPass.js';
import Registration from '../models/Registration.js';

/** Persist the outcome of a confirmation send so admins can see/resend failures
 *  instead of it only ever being logged to the server console. Never throws. */
const trackResult = async (reg, result) => {
  if (!reg?._id) return;
  const isMock = result.reason === 'mock';
  const status = isMock ? 'skipped' : result.sent ? 'sent' : 'failed';
  try {
    await Registration.updateOne(
      { _id: reg._id },
      {
        $set: {
          whatsappStatus: status,
          whatsappMessageId: result.messageId || '',
          whatsappError: status === 'failed' ? result.reason || '' : '',
          whatsappSentAt: status === 'sent' ? new Date() : null,
        },
      }
    );
  } catch (err) {
    console.error(`[whatsapp] failed to record send status for ${reg.registrationNumber}: ${err.message}`);
  }
};

/**
 * WhatsApp confirmation sender — Meta WhatsApp Cloud API.
 *
 * ------------------------------------------------------------------------
 *  Business-initiated WhatsApp messages must use a PRE-APPROVED template.
 *  We send one template message whose HEADER is the entry QR (image) and
 *  whose BODY carries the registration details.
 *
 *  You must create + get approved (in Meta WhatsApp Manager) a template with:
 *    - Name:     matches WHATSAPP_TEMPLATE_NAME (e.g. neetcon_confirmation_free)
 *    - Category: UTILITY
 *    - Header:   IMAGE
 *    - Body with 7 NAMED variables (Meta's current editor requires named, not
 *      numbered, parameters — lowercase + underscores):
 *        {{full_name}} {{registration_code}} {{preparing_for}}
 *        {{event_date}} {{event_time}} {{venue}} {{guest_count}}
 *      Example body text (event is FREE — no amount variable):
 *        "Hi {{full_name}}, your NEET CON 2026 seat is CONFIRMED ✅ (Free Entry)
 *         Registration Code: {{registration_code}}
 *         Preparing For: {{preparing_for}}
 *         Date: {{event_date}}, Time: {{event_time}}
 *         Venue: {{venue}}
 *         Guests joining you: {{guest_count}}
 *         Show the QR above at the entry desk. See you there!"
 *    - Optional buttons: a STATIC URL button "Get Directions" -> Google Maps
 *      link for the venue. Static-URL buttons need NO code change (only dynamic
 *      {{n}} URL buttons would). The QR is always the image header (top).
 *
 *  NOTE: Meta template text is fixed once approved — this code's body
 *  parameters below must match whatever template WHATSAPP_TEMPLATE_NAME
 *  actually points to. If you change the wording/variables in Meta, update
 *  this file's `components` array to match, and vice versa.
 *
 *  A SEPARATE template is used for the one-off "how many guests?" follow-up
 *  sent to registrants who registered before the guest-count question
 *  existed (see server/scripts/sendGuestCountAsk.js). It needs its own
 *  approval:
 *    - Name:     matches WHATSAPP_GUESTCOUNT_TEMPLATE_NAME (e.g. neetcon_guest_count_ask)
 *    - Category: UTILITY
 *    - Header:   none
 *    - Body with 2 NAMED variables: {{full_name}} {{registration_code}}
 *      Example body text:
 *        "Hi {{full_name}}, quick update needed for your NEET CON 2026
 *         registration (Code: {{registration_code}}).
 *         How many family members or friends will be joining you at the
 *         event? Please reply with just a number (e.g. 0, 1, 2, 3).
 *         This helps us plan seating. Thank you!"
 *
 *  ENV (server/.env, never commit):
 *    WHATSAPP_PHONE_NUMBER_ID          the Cloud API phone number id
 *    WHATSAPP_ACCESS_TOKEN             a permanent/system-user access token
 *    WHATSAPP_TEMPLATE_NAME            approved confirmation template name
 *    WHATSAPP_TEMPLATE_LANG            template language code (default 'en')
 *    WHATSAPP_GUESTCOUNT_TEMPLATE_NAME approved guest-count-ask template name
 *    WHATSAPP_COUNTRY_CODE             default '91' (prepended to 10-digit numbers)
 *    WHATSAPP_API_VERSION              Graph API version (default 'v21.0')
 *    WHATSAPP_MOCK                     true = simulate locally (no real send)
 * ------------------------------------------------------------------------
 */

const GRAPH = 'https://graph.facebook.com';

const API_VERSION = () => process.env.WHATSAPP_API_VERSION || 'v21.0';
const PHONE_NUMBER_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const ACCESS_TOKEN = () => process.env.WHATSAPP_ACCESS_TOKEN || '';
const TEMPLATE_NAME = () => process.env.WHATSAPP_TEMPLATE_NAME || '';
const TEMPLATE_LANG = () => process.env.WHATSAPP_TEMPLATE_LANG || 'en';
const GUESTCOUNT_TEMPLATE_NAME = () => process.env.WHATSAPP_GUESTCOUNT_TEMPLATE_NAME || '';
const COUNTRY_CODE = () => process.env.WHATSAPP_COUNTRY_CODE || '91';

export const isWhatsAppMock = () => String(process.env.WHATSAPP_MOCK).toLowerCase() === 'true';

const isConfigured = () => !!(PHONE_NUMBER_ID() && ACCESS_TOKEN() && TEMPLATE_NAME());
const isGuestCountAskConfigured = () =>
  !!(PHONE_NUMBER_ID() && ACCESS_TOKEN() && GUESTCOUNT_TEMPLATE_NAME());

const EVENT = {
  date: process.env.EVENT_DATE || '12 July 2026',
  time: process.env.EVENT_TIME || '10:00 AM – 4:30 PM',
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
 * Send the confirmation + QR to the registrant's WhatsApp, and persist the
 * outcome onto the registration (whatsappStatus/whatsappError/etc.) so a
 * failure is visible/resendable from the admin dashboard instead of only
 * ever being logged to the server console. Never throws.
 *
 * @param {object} reg  the confirmed registration document
 * @returns {Promise<{ sent: boolean, reason?: string, messageId?: string }>}
 */
export const sendConfirmationWhatsApp = async (reg) => {
  const result = await sendConfirmationWhatsAppRaw(reg);
  await trackResult(reg, result);
  return result;
};

const sendConfirmationWhatsAppRaw = async (reg) => {
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
    // The header image is the branded entry pass (QR + details). If pass
    // rendering ever fails, fall back to the bare QR so confirmations are never
    // blocked by a rendering issue.
    let imageBuffer;
    try {
      imageBuffer = await generateEventPass(reg);
    } catch (err) {
      console.warn(`[whatsapp] pass render failed, falling back to plain QR: ${err.message}`);
      imageBuffer = await generateQrBuffer(reg.registrationNumber);
    }
    const mediaId = await uploadQrMedia(
      imageBuffer,
      `${String(reg.registrationNumber).replace(/\s+/g, '-')}-pass.png`
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
              {
                type: 'text',
                parameter_name: 'preparing_for',
                text: String(reg.preparingFor || reg.currentStatus || 'NEET Aspirant'),
              },
              { type: 'text', parameter_name: 'event_date', text: EVENT.date },
              { type: 'text', parameter_name: 'event_time', text: EVENT.time },
              { type: 'text', parameter_name: 'venue', text: EVENT.venue },
              {
                type: 'text',
                parameter_name: 'guest_count',
                text: String(Math.max(0, Math.trunc(Number(reg.guestCount) || 0))),
              },
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

/**
 * Ask a pre-guest-count registrant how many people are joining them.
 * Never throws — returns a result object the caller can log.
 *
 * @param {object} reg  the registration document (must have fullName, mobileNumber, registrationNumber)
 * @returns {Promise<{ sent: boolean, reason?: string, messageId?: string }>}
 */
export const sendGuestCountAsk = async (reg) => {
  if (!reg?.mobileNumber) {
    return { sent: false, reason: 'no mobile number on record' };
  }
  const to = toWhatsAppNumber(reg.mobileNumber);

  if (isWhatsAppMock()) {
    console.log(`[whatsapp] MOCK — would ask ${to} (${reg.registrationNumber}) for guest count.`);
    return { sent: true, reason: 'mock' };
  }

  if (!isGuestCountAskConfigured()) {
    console.warn(
      `[whatsapp] guest-count-ask not configured — skipped ${to} (${reg.registrationNumber}). ` +
        'Set WHATSAPP_GUESTCOUNT_TEMPLATE_NAME.'
    );
    return { sent: false, reason: 'not configured' };
  }

  try {
    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: GUESTCOUNT_TEMPLATE_NAME(),
        language: { code: TEMPLATE_LANG() },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', parameter_name: 'full_name', text: String(reg.fullName) },
              {
                type: 'text',
                parameter_name: 'registration_code',
                text: String(reg.registrationNumber || reg.orderId),
              },
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
    console.log(`[whatsapp] guest-count ask sent to ${to} (${reg.registrationNumber}) id=${messageId}`);
    return { sent: true, messageId };
  } catch (err) {
    console.error(`[whatsapp] failed to send guest-count ask to ${to}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
};
