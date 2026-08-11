/**
 * One-off: submit the venue-correction template to Meta WhatsApp Manager for
 * approval. Sent once to everyone who already received the original NEET CON
 * invite (careerx_neetcon_invite_v1), whose approved body text still says
 * "📍 Bhatia Hall, Kuttikatoor, Kozhikode" — a physical venue that's no
 * longer accurate now that CareerX moved to online mode.
 *
 * Submitted as UTILITY first (plain-text link, no button). If Meta rejects
 * this as UTILITY or reclassifies it anyway, re-run with
 * WHATSAPP_NEETCON_CORRECTION_USE_BUTTON=true to fall back to a URL button
 * under the footer.
 *
 * Usage: node scripts/createNeetconCorrectionTemplate.js
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
const TEMPLATE_NAME = process.env.WHATSAPP_NEETCON_CORRECTION_TEMPLATE_NAME || 'careerx_neetcon_correction_v1';
const USE_BUTTON = String(process.env.WHATSAPP_NEETCON_CORRECTION_USE_BUTTON).toLowerCase() === 'true';
const GROUP_LINK = 'https://chat.whatsapp.com/GfMbkxj71ym8gNDpuEe7Es';

if (!ACCESS_TOKEN || !WABA_ID) {
  console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_WABA_ID in .env');
  process.exit(1);
}

const BODY_TEXT = [
  'Quick correction to our earlier CareerX message — the venue info was outdated.',
  '💻 CareerX will be held in *ONLINE mode* — there is no physical venue.',
  '📅 {{event_date}}, {{event_time}}',
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
          { param_name: 'event_date', example: 'Thursday, 13 August 2026' },
          { param_name: 'event_time', example: '10:00 AM' },
        ],
      },
    },
    { type: 'FOOTER', text: 'DOPA Coaching' },
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
