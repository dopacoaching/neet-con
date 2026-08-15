/**
 * One-off: send today's (2026-08-15) event reminder — with the poster image
 * header, 7:30 PM IST start time, tonight's Zoom link/ID/passcode, and the
 * WhatsApp group link — to every confirmed CareerX registrant, via the
 * approved WHATSAPP_EVENT_TODAY_TEMPLATE_NAME template
 * (careerx_event_today_v1). Tracked per-registration in eventTodaySentAt so
 * this script is safe to re-run.
 *
 * Usage:
 *   cd server
 *   node scripts/sendEventToday.js --dry-run          # preview recipients, sends nothing
 *   node scripts/sendEventToday.js --test=9876543210  # send ONE real message to this number only
 *   node scripts/sendEventToday.js                     # actually sends to every unsent registrant
 */
import { config as loadEnv } from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

import connectDB from '../config/db.js';
import Registration, { CURRENT_EVENT } from '../models/Registration.js';

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const GRAPH = 'https://graph.facebook.com';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const TEMPLATE_NAME = process.env.WHATSAPP_EVENT_TODAY_TEMPLATE_NAME || 'careerx_event_today_v1';
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
const COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE || '91';
const ZOOM_LINK =
  process.env.EVENT_TODAY_ZOOM_LINK ||
  'https://us06web.zoom.us/j/82204853317?pwd=9S01oY7e9sZsgsI9tnCgT5OXWteVrg.1';
const POSTER_PATH = join(__dirname, '..', '..', 'WhatsApp Image 2026-08-15 at 11.22.28 AM.jpeg');

const dryRun = process.argv.includes('--dry-run');
const testArg = process.argv.find((a) => a.startsWith('--test='));
const testNumber = testArg ? testArg.slice('--test='.length) : null;
const DELAY_MS = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toWhatsAppNumber = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length === 10 ? `${COUNTRY_CODE}${digits}` : digits;
};

/** Upload the poster once via the phone number's media endpoint; the
 *  returned media id is reused across every send in this run. */
async function uploadMedia() {
  const bytes = await readFile(POSTER_PATH);
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'poster.jpg');
  const res = await fetch(`${GRAPH}/${API_VERSION}/${PHONE_NUMBER_ID}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: form,
  });
  const data = await res.json();
  if (!data?.id) throw new Error(`Media upload failed: ${JSON.stringify(data)}`);
  return data.id;
}

async function sendEventTodayTo(reg, mediaId) {
  const payload = {
    messaging_product: 'whatsapp',
    to: toWhatsAppNumber(reg.mobileNumber),
    type: 'template',
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANG },
      components: [
        { type: 'header', parameters: [{ type: 'image', image: { id: mediaId } }] },
        {
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'full_name', text: String(reg.fullName) },
            { type: 'text', parameter_name: 'ticket_id', text: String(reg.registrationNumber) },
            { type: 'text', parameter_name: 'zoom_link', text: ZOOM_LINK },
          ],
        },
      ],
    },
  };
  const res = await fetch(`${GRAPH}/${API_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { sent: !!data?.messages?.[0]?.id, reason: data?.error?.message || '' };
}

const run = async () => {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.error('Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID in .env');
    process.exit(1);
  }

  if (testNumber) {
    console.log(`[event-today] TEST MODE — sending one real message to ${testNumber} (sample data, DB untouched).`);
    console.log('[event-today] Uploading poster image...');
    const mediaId = await uploadMedia();
    const result = await sendEventTodayTo(
      { fullName: 'Test User', registrationNumber: 'TEST 000', mobileNumber: testNumber },
      mediaId
    );
    console.log(result.sent ? `[event-today] Test message sent.` : `[event-today] Test send FAILED: ${result.reason}`);
    process.exit(result.sent ? 0 : 1);
  }

  await connectDB();

  const targets = await Registration.find({
    event: CURRENT_EVENT,
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
    registrationNumber: { $ne: null },
    eventTodaySentAt: null,
  }).sort({ createdAt: 1 });

  console.log(`[event-today] ${targets.length} confirmed CareerX registrant(s) to notify.`);

  if (dryRun) {
    targets.forEach((r) =>
      console.log(`  - ${r.registrationNumber}  ${r.fullName}  ${r.mobileNumber}`)
    );
    console.log(`\n[event-today] Dry run — nothing sent.`);
    await mongoose.connection.close();
    process.exit(0);
  }

  console.log('[event-today] Uploading poster image...');
  const mediaId = await uploadMedia();

  let sent = 0;
  let failed = 0;

  for (const reg of targets) {
    const result = await sendEventTodayTo(reg, mediaId);
    if (result.sent) {
      await Registration.updateOne({ _id: reg._id }, { $set: { eventTodaySentAt: new Date() } });
      sent += 1;
    } else {
      console.warn(`[event-today] failed ${reg.fullName} ${reg.mobileNumber}: ${result.reason}`);
      failed += 1;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n[event-today] Done. Sent: ${sent}, failed: ${failed}.`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[event-today] Failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
