/**
 * One-off: submit the CareerX invite template (for old NEET CON 2026
 * registrants) to Meta WhatsApp Manager for approval.
 *
 * This is a template-CREATION script, unlike everything else in this
 * folder which only sends already-approved templates. Run once; if Meta
 * rejects it, tweak the body/header below and re-run with a bumped
 * template name (Meta does not allow re-submitting the same name while a
 * previous version is PENDING/REJECTED for some states — bump the version
 * suffix, e.g. _v2, if a re-run is needed).
 *
 * Usage: node scripts/createNeetconInviteTemplate.js
 *
 * Requires WHATSAPP_WABA_ID (not needed for normal sends, only for
 * template creation) in addition to the usual WHATSAPP_PHONE_NUMBER_ID /
 * WHATSAPP_ACCESS_TOKEN.
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
const TEMPLATE_NAME = process.env.WHATSAPP_NEETCON_INVITE_TEMPLATE_NAME || 'careerx_neetcon_invite_v2';
const POSTER_PATH = join(__dirname, '..', '..', 'WhatsApp Image 2026-08-08 at 3.06.53 PM.jpeg');

if (!ACCESS_TOKEN || !WABA_ID) {
  console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_WABA_ID in .env');
  process.exit(1);
}

const BODY_TEXT = [
  'NEET കഴിഞ്ഞു... ഇനി ശരിയായ തീരുമാനം എടുക്കേണ്ട സമയമാണ്! 🎯',
  'CAREERX – Your Complete Roadmap After NEET 2026',
  '✅ MBBS Admission Guidance',
  '✅ College Selection & Counselling Strategy',
  '✅ Allotment Process Explained',
  '✅ Career Options After NEET',
  '📅 August 13 (Thursday), 10:00 AM',
  '💻 Online Conclave — no physical venue',
  '🎟️ Register Now:',
  'https://careerx.dopacoaching.com',
  '📞 96452 02200',
].join('\n');

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
    category: 'MARKETING',
    components: [
      { type: 'HEADER', format: 'IMAGE', example: { header_handle: [headerHandle] } },
      { type: 'BODY', text: BODY_TEXT },
      { type: 'FOOTER', text: 'DOPA Coaching' },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'URL', text: 'Register Now', url: 'https://careerx.dopacoaching.com' }],
      },
    ],
  };

  const res = await fetch(`${GRAPH}/${API_VERSION}/${WABA_ID}/message_templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function run() {
  console.log(`Resolving app id...`);
  const appId = await getAppId();
  console.log(`App id: ${appId}`);

  console.log(`Uploading header image (${POSTER_PATH})...`);
  const headerHandle = await uploadHeaderImage(appId);
  console.log(`Header handle acquired.`);

  console.log(`Submitting template "${TEMPLATE_NAME}"...`);
  const result = await createTemplate(headerHandle);
  console.log(JSON.stringify(result, null, 2));

  if (result.id) {
    console.log(`\nTemplate submitted. Status: ${result.status || 'PENDING'}.`);
    console.log(`Check approval status in Meta WhatsApp Manager, or re-run a status-check script.`);
  } else {
    console.error(`\nTemplate submission FAILED — see error above.`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
