/**
 * One-off: submit today's (2026-08-17) event-reminder template to Meta
 * WhatsApp Manager for approval. Has an IMAGE header (the "What's Right for
 * You?" panel-discussion poster), plus body text with the 7:30 PM IST start
 * time, tonight's Zoom link/ID/passcode, and the WhatsApp group link.
 *
 * Usage: node scripts/createEventTodayV2Template.js
 *
 * Requires WHATSAPP_WABA_ID + WHATSAPP_ACCESS_TOKEN (template creation only,
 * not needed for normal sends).
 */
import { config as loadEnv } from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const GRAPH = 'https://graph.facebook.com';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WABA_ID = process.env.WHATSAPP_WABA_ID;
const TEMPLATE_NAME = process.env.WHATSAPP_EVENT_TODAY_V2_TEMPLATE_NAME || 'careerx_event_today_v2';
const GROUP_LINK = 'https://chat.whatsapp.com/GfMbkxj71ym8gNDpuEe7Es';
const POSTER_PATH = join(__dirname, '..', '..', 'WhatsApp Image 2026-08-17 at 11.14.23 AM.jpeg');
const ZOOM_LINK_EXAMPLE = 'https://us06web.zoom.us/j/89112710120?pwd=FGv6atcI0h3YhtXCtn0s1lLUU3v2SV.1';

if (!ACCESS_TOKEN || !WABA_ID) {
  console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_WABA_ID in .env');
  process.exit(1);
}

const BODY_TEXT = [
  'Hi *{{full_name}}* (Ticket ID: {{ticket_id}}),',
  '🎓 TODAY | CareerX Online Conclave',
  '🤔 Govt MBBS, Private MBBS, MBBS Abroad or BDS — What\'s Right for You?',
  'Join our LIVE panel discussion with doctors & medical students and get clarity on your medical career choices. 🩺✨',
  '📅 Today | August 17\n⏰ 7:30 PM\n💻 Live on Zoom',
  `🔗 Join:\n{{zoom_link}}`,
  '🆔 Meeting ID: 891 1271 0120\n🔐 Passcode: 078405',
  `💬 WhatsApp Group:\n${GROUP_LINK}`,
  '📞 For registration: 9645202200',
].join('\n\n');

async function getAppId() {
  const res = await fetch(
    `${GRAPH}/${API_VERSION}/debug_token?input_token=${ACCESS_TOKEN}&access_token=${ACCESS_TOKEN}`
  );
  const data = await res.json();
  const appId = data?.data?.app_id;
  if (!appId) throw new Error(`Could not resolve app id: ${JSON.stringify(data)}`);
  return appId;
}

async function uploadHeaderImage(appId) {
  const bytes = await readFile(POSTER_PATH);
  const startRes = await fetch(
    `${GRAPH}/${API_VERSION}/${appId}/uploads?file_length=${bytes.length}&file_type=image/jpeg&access_token=${ACCESS_TOKEN}`,
    { method: 'POST' }
  );
  const startData = await startRes.json();
  const uploadSessionId = startData?.id;
  if (!uploadSessionId) throw new Error(`Upload session start failed: ${JSON.stringify(startData)}`);

  const uploadRes = await fetch(`${GRAPH}/${API_VERSION}/${uploadSessionId}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${ACCESS_TOKEN}`,
      file_offset: '0',
      'Content-Type': 'application/octet-stream',
    },
    body: bytes,
  });
  const uploadData = await uploadRes.json();
  if (!uploadData?.h) throw new Error(`Upload finish failed: ${JSON.stringify(uploadData)}`);
  return uploadData.h;
}

async function createTemplate(headerHandle) {
  const payload = {
    name: TEMPLATE_NAME,
    language: 'en',
    category: 'UTILITY',
    parameter_format: 'NAMED',
    components: [
      { type: 'HEADER', format: 'IMAGE', example: { header_handle: [headerHandle] } },
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
  console.log('Resolving app id...');
  const appId = await getAppId();
  console.log(`App id: ${appId}`);

  console.log(`Uploading header image (${POSTER_PATH})...`);
  const headerHandle = await uploadHeaderImage(appId);
  console.log('Header handle acquired.');

  console.log(`Submitting template "${TEMPLATE_NAME}"...`);
  const result = await createTemplate(headerHandle);
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
