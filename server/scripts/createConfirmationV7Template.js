/**
 * One-off: submit the v7 confirmation template to Meta WhatsApp Manager for
 * approval. Supersedes v6 (approved, but still had an IMAGE header carrying
 * the QR/entry-pass — no longer needed since the event has no physical gate
 * to scan at). v7 drops the header entirely (plain text, like the
 * mode-update template) and keeps the WhatsApp-group join line.
 *
 * Submitted as UTILITY first (plain-text link, no button). If Meta rejects
 * this as UTILITY or reclassifies it anyway, re-run with
 * WHATSAPP_CONFIRMATION_V7_USE_BUTTON=true to fall back to a URL button
 * under the footer.
 *
 * Once approved, point WHATSAPP_TEMPLATE_NAME at it (careerx_confirmation_v7)
 * — server/utils/whatsapp.js already sends the matching 5 NAMED body params
 * (full_name, ticket_id, event_date, event_time, venue), no header.
 *
 * Usage: node scripts/createConfirmationV7Template.js
 *
 * Requires WHATSAPP_WABA_ID + WHATSAPP_ACCESS_TOKEN (template creation only,
 * not needed for normal sends).
 */
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const GRAPH = 'https://graph.facebook.com';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WABA_ID = process.env.WHATSAPP_WABA_ID;
const TEMPLATE_NAME = process.env.WHATSAPP_CONFIRMATION_V7_TEMPLATE_NAME || 'careerx_confirmation_v7';
const USE_BUTTON = String(process.env.WHATSAPP_CONFIRMATION_V7_USE_BUTTON).toLowerCase() === 'true';
const GROUP_LINK = 'https://chat.whatsapp.com/GfMbkxj71ym8gNDpuEe7Es';

if (!ACCESS_TOKEN || !WABA_ID) {
  console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_WABA_ID in .env');
  process.exit(1);
}

const BODY_TEXT = [
  'Hi *{{full_name}}*, your CareeRx seat is *CONFIRMED*',
  '*Ticket ID:* {{ticket_id}}',
  '*Date:* {{event_date}}',
  '*Time:* {{event_time}}',
  '*Mode:* {{venue}}',
  USE_BUTTON
    ? 'Join our official WhatsApp group for the event link and updates using the button below.'
    : `Join our official WhatsApp group for the event link and updates:\n${GROUP_LINK}`,
].join('\n');

async function createTemplate() {
  const components = [
    {
      type: 'BODY',
      text: BODY_TEXT,
      example: {
        body_text_named_params: [
          { param_name: 'full_name', example: 'Anjali Menon' },
          { param_name: 'ticket_id', example: 'CAREERX 001' },
          { param_name: 'event_date', example: 'Thursday, 13 August 2026' },
          { param_name: 'event_time', example: '10:00 AM' },
          { param_name: 'venue', example: 'Online' },
        ],
      },
    },
    { type: 'FOOTER', text: 'DOPA Coaching, Calicut' },
  ];

  if (USE_BUTTON) {
    components.push({
      type: 'BUTTONS',
      buttons: [{ type: 'URL', text: 'Join WhatsApp Group', url: GROUP_LINK }],
    });
  }

  const payload = {
    name: TEMPLATE_NAME,
    language: 'en',
    category: 'UTILITY',
    parameter_format: 'NAMED',
    components,
  };

  const res = await fetch(`${GRAPH}/${API_VERSION}/${WABA_ID}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function run() {
  console.log(`Submitting template "${TEMPLATE_NAME}" (${USE_BUTTON ? 'with URL button' : 'plain-text link'})...`);
  const result = await createTemplate();
  console.log(JSON.stringify(result, null, 2));

  if (result.id) {
    console.log(`\nTemplate submitted. Status: ${result.status || 'PENDING'}.`);
    console.log('Once APPROVED: set WHATSAPP_TEMPLATE_NAME=careerx_confirmation_v7 in .env / Render.');
  } else {
    console.error('\nTemplate submission FAILED — see error above.');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
