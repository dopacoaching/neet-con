/**
 * One-off: send tonight's (2026-08-15) "meeting starts in 15 minutes"
 * reminder to every confirmed CareerX registrant, via the approved
 * WHATSAPP_MEETING_STARTING_V3_TEMPLATE_NAME template
 * (careerx_meeting_starting_v3). Tracked per-registration in
 * meetingStartingV3SentAt (a new field, since meetingStartingSentAt from
 * the Aug 13 occurrence would otherwise wrongly skip repeat registrants).
 * Meant to fire at 7:15 PM IST, 2026-08-15.
 *
 * Usage:
 *   cd server
 *   node scripts/sendMeetingStartingV3.js --dry-run          # preview recipients, sends nothing
 *   node scripts/sendMeetingStartingV3.js --test=9876543210  # send ONE real message to this number only
 *   node scripts/sendMeetingStartingV3.js                     # actually sends to every unsent registrant
 */
import { config as loadEnv } from 'dotenv';
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
const TEMPLATE_NAME = process.env.WHATSAPP_MEETING_STARTING_V3_TEMPLATE_NAME || 'careerx_meeting_starting_v3';
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
const COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE || '91';
const ZOOM_LINK =
  process.env.MEETING_STARTING_V3_ZOOM_LINK ||
  'https://us06web.zoom.us/j/82204853317?pwd=9S01oY7e9sZsgsI9tnCgT5OXWteVrg.1';

const dryRun = process.argv.includes('--dry-run');
const testArg = process.argv.find((a) => a.startsWith('--test='));
const testNumber = testArg ? testArg.slice('--test='.length) : null;
const DELAY_MS = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toWhatsAppNumber = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length === 10 ? `${COUNTRY_CODE}${digits}` : digits;
};

async function sendMeetingStartingTo(reg) {
  const payload = {
    messaging_product: 'whatsapp',
    to: toWhatsAppNumber(reg.mobileNumber),
    type: 'template',
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANG },
      components: [
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
    console.log(`[meeting-starting-v3] TEST MODE — sending one real message to ${testNumber} (sample data, DB untouched).`);
    const result = await sendMeetingStartingTo({
      fullName: 'Test User',
      registrationNumber: 'TEST 000',
      mobileNumber: testNumber,
    });
    console.log(result.sent ? `[meeting-starting-v3] Test message sent.` : `[meeting-starting-v3] Test send FAILED: ${result.reason}`);
    process.exit(result.sent ? 0 : 1);
  }

  await connectDB();

  const targets = await Registration.find({
    event: CURRENT_EVENT,
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
    registrationNumber: { $ne: null },
    meetingStartingV3SentAt: null,
  }).sort({ createdAt: 1 });

  console.log(`[meeting-starting-v3] ${targets.length} confirmed CareerX registrant(s) to notify.`);

  if (dryRun) {
    targets.forEach((r) =>
      console.log(`  - ${r.registrationNumber}  ${r.fullName}  ${r.mobileNumber}`)
    );
    console.log(`\n[meeting-starting-v3] Dry run — nothing sent.`);
    await mongoose.connection.close();
    process.exit(0);
  }

  let sent = 0;
  let failed = 0;

  for (const reg of targets) {
    const result = await sendMeetingStartingTo(reg);
    if (result.sent) {
      await Registration.updateOne({ _id: reg._id }, { $set: { meetingStartingV3SentAt: new Date() } });
      sent += 1;
    } else {
      console.warn(`[meeting-starting-v3] failed ${reg.fullName} ${reg.mobileNumber}: ${result.reason}`);
      failed += 1;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n[meeting-starting-v3] Done. Sent: ${sent}, failed: ${failed}.`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[meeting-starting-v3] Failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
