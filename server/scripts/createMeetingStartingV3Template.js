/**
 * One-off: submit the "meeting starts in 15 minutes" reminder template for
 * tonight's (2026-08-15) session to Meta WhatsApp Manager for approval.
 *
 * NOTE: a v2 attempt with meeting_id/passcode as separate variables was
 * REJECTED by Meta as INCORRECT_CATEGORY (their classifier apparently reads
 * that pattern as promotional). This v3 reverts to v1's proven pattern —
 * meeting ID/passcode baked into the body as static text — which is the
 * only variant Meta has approved as UTILITY so far. Bump the version
 * suffix and hardcode the new numbers for each future occurrence.
 *
 * Usage: node scripts/createMeetingStartingV3Template.js
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
const TEMPLATE_NAME = process.env.WHATSAPP_MEETING_STARTING_V3_TEMPLATE_NAME || 'careerx_meeting_starting_v3';
const GROUP_LINK = 'https://chat.whatsapp.com/GfMbkxj71ym8gNDpuEe7Es';
const ZOOM_LINK_EXAMPLE = 'https://us06web.zoom.us/j/82204853317?pwd=9S01oY7e9sZsgsI9tnCgT5OXWteVrg.1';

if (!ACCESS_TOKEN || !WABA_ID) {
  console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_WABA_ID in .env');
  process.exit(1);
}

const BODY_TEXT = [
  'Hi *{{full_name}}*, the CareeRx meeting starts in *15 minutes* (Ticket ID: {{ticket_id}})!',
  'Join now via Zoom:\n{{zoom_link}}\nMeeting ID: 822 0485 3317\nPasscode: 823792',
  `Stay updated via our WhatsApp group:\n${GROUP_LINK}`,
  'See you there!',
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
            { param_name: 'zoom_link', example: ZOOM_LINK_EXAMPLE },
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
