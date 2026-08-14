/**
 * One-off: submit the "CareeRx continues on Aug 15-16" update template to
 * Meta WhatsApp Manager for approval. Sent to everyone who registered for
 * the original Aug 13 session, now that the event has continued onto two
 * more nights (this is explicitly a continuation, not a reschedule).
 *
 * Usage: node scripts/createContinuationUpdateTemplate.js
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
const TEMPLATE_NAME = process.env.WHATSAPP_CONTINUATION_UPDATE_TEMPLATE_NAME || 'careerx_continuation_update_v1';
const GROUP_LINK = 'https://chat.whatsapp.com/GfMbkxj71ym8gNDpuEe7Es';

if (!ACCESS_TOKEN || !WABA_ID) {
  console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_WABA_ID in .env');
  process.exit(1);
}

const BODY_TEXT = [
  'Hi *{{full_name}}*, an update on your CareeRx registration (Ticket ID: {{ticket_id}}).',
  'Following up on the August 13 session, CareeRx *continues* on *{{event_date}}*, at *{{event_time}}*, via Zoom (online).',
  `Join our official WhatsApp group — the Zoom link will be shared there closer to the date:\n${GROUP_LINK}`,
  'See you then!',
].join('\n\n');

async function createTemplate() {
  const payload = {
    name: TEMPLATE_NAME,
    language: 'en',
    category: 'UTILITY',
    parameter_format: 'NAMED',
    components: [
      {
        type: 'BODY',
        text: BODY_TEXT,
        example: {
          body_text_named_params: [
            { param_name: 'full_name', example: 'Anjali Menon' },
            { param_name: 'ticket_id', example: 'CAREERX 001' },
            { param_name: 'event_date', example: 'Saturday & Sunday, 15–16 August 2026' },
            { param_name: 'event_time', example: '7:30 PM' },
          ],
        },
      },
      { type: 'FOOTER', text: 'DOPA Coaching, Calicut' },
    ],
  };

  const res = await fetch(`${GRAPH}/${API_VERSION}/${WABA_ID}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function run() {
  console.log(`Submitting template "${TEMPLATE_NAME}"...`);
  const result = await createTemplate();
  console.log(JSON.stringify(result, null, 2));

  if (result.id) {
    console.log(`\nTemplate submitted. Status: ${result.status || 'PENDING'}.`);
    console.log('Check approval status in Meta WhatsApp Manager before sending.');
  } else {
    console.error('\nTemplate submission FAILED — see error above.');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
