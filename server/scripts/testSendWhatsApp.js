/**
 * Send ONE real test message for a given template to a single number, using
 * sample data. Nothing is read from or written to the database — safe to run
 * repeatedly while iterating on template wording/approval. Use this before
 * ever running the mass-send scripts (sendModeUpdate.js,
 * sendNeetconCorrection.js) or switching WHATSAPP_TEMPLATE_NAME to v6.
 *
 * Usage:
 *   cd server
 *   node scripts/testSendWhatsApp.js --template=mode-update --to=7306540341
 *   node scripts/testSendWhatsApp.js --template=confirmation-v7 --to=7306540341
 *   node scripts/testSendWhatsApp.js --template=neetcon-correction --to=7306540341
 */
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const GRAPH = 'https://graph.facebook.com';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
const COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE || '91';

const EVENT = {
  date: process.env.EVENT_DATE || 'Thursday, 13 August 2026',
  time: process.env.EVENT_TIME || '10:00 AM',
  venue: process.env.EVENT_VENUE || 'Online',
};

const arg = (name) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : null;
};

const templateKey = arg('template');
const to = arg('to');

if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
  console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID in .env');
  process.exit(1);
}
if (!templateKey || !to) {
  console.error('Usage: node scripts/testSendWhatsApp.js --template=<mode-update|confirmation-v6|neetcon-correction> --to=<number>');
  process.exit(1);
}

const toWhatsAppNumber = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length === 10 ? `${COUNTRY_CODE}${digits}` : digits;
};

async function buildPayload() {
  if (templateKey === 'mode-update') {
    return {
      messaging_product: 'whatsapp',
      to: toWhatsAppNumber(to),
      type: 'template',
      template: {
        name: process.env.WHATSAPP_MODE_UPDATE_TEMPLATE_NAME || 'careerx_mode_update_v1',
        language: { code: TEMPLATE_LANG },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', parameter_name: 'full_name', text: 'Test User' },
              { type: 'text', parameter_name: 'ticket_id', text: 'TEST 000' },
              { type: 'text', parameter_name: 'event_date', text: EVENT.date },
              { type: 'text', parameter_name: 'event_time', text: EVENT.time },
            ],
          },
        ],
      },
    };
  }

  if (templateKey === 'confirmation-v7') {
    return {
      messaging_product: 'whatsapp',
      to: toWhatsAppNumber(to),
      type: 'template',
      template: {
        name: process.env.WHATSAPP_CONFIRMATION_V7_TEMPLATE_NAME || 'careerx_confirmation_v7',
        language: { code: TEMPLATE_LANG },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', parameter_name: 'full_name', text: 'Test User' },
              { type: 'text', parameter_name: 'ticket_id', text: 'TEST 000' },
              { type: 'text', parameter_name: 'event_date', text: EVENT.date },
              { type: 'text', parameter_name: 'event_time', text: EVENT.time },
              { type: 'text', parameter_name: 'venue', text: EVENT.venue },
            ],
          },
        ],
      },
    };
  }

  if (templateKey === 'neetcon-correction') {
    return {
      messaging_product: 'whatsapp',
      to: toWhatsAppNumber(to),
      type: 'template',
      template: {
        name: process.env.WHATSAPP_NEETCON_CORRECTION_TEMPLATE_NAME || 'careerx_neetcon_correction_v1',
        language: { code: TEMPLATE_LANG },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', parameter_name: 'event_date', text: EVENT.date },
              { type: 'text', parameter_name: 'event_time', text: EVENT.time },
            ],
          },
        ],
      },
    };
  }

  throw new Error(`Unknown --template=${templateKey}`);
}

async function run() {
  const payload = await buildPayload();
  console.log(`Sending "${templateKey}" test to ${toWhatsAppNumber(to)}...`);
  const res = await fetch(`${GRAPH}/${API_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
  if (!res.ok) {
    console.error('\nSend FAILED — see error above (template may not be approved yet).');
    process.exit(1);
  }
  console.log('\nTest message sent — check the phone to verify rendering before any mass send.');
}

run().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
