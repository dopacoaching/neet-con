/**
 * One-off: send the "meeting starts in 15 minutes" reminder to every
 * confirmed CareerX registrant, via the approved
 * WHATSAPP_MEETING_STARTING_TEMPLATE_NAME template (careerx_meeting_starting_v1).
 * Tracked per-registration in meetingStartingSentAt so this script is safe to
 * re-run (only unsent ones go out). Meant to fire at 7:15 PM IST, 2026-08-13.
 *
 * Usage:
 *   cd server
 *   node scripts/sendMeetingStarting.js --dry-run          # preview recipients, sends nothing
 *   node scripts/sendMeetingStarting.js --test=9876543210  # send ONE real message to this number only (sample data, not tracked in DB)
 *   node scripts/sendMeetingStarting.js                     # actually sends to every unsent registrant
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
const TEMPLATE_NAME = process.env.WHATSAPP_MEETING_STARTING_TEMPLATE_NAME || 'careerx_meeting_starting_v1';
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
const COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE || '91';
const ZOOM_LINK =
  process.env.MEETING_STARTING_ZOOM_LINK ||
  'https://us06web.zoom.us/j/84104668901?pwd=MTNBItV4sbuiOUzQ1u7WWueG1DwNfG.1';

const dryRun = process.argv.includes('--dry-run');
const testArg = process.argv.find((a) => a.startsWith('--test='));
const testNumber = testArg ? testArg.slice('--test='.length) : null;
const DELAY_MS = 300; // spread sends out a little; avoid hammering the Graph API

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toWhatsAppNumber = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length === 10 ? `${COUNTRY_CODE}${digits}` : digits;
};

async function sendBroadcastReport({ total, sent, failed }) {
  const adminNumber = process.env.BROADCAST_REPORT_NUMBER;
  if (!adminNumber) return;
  const templateName = process.env.WHATSAPP_BROADCAST_REPORT_TEMPLATE_NAME || 'careerx_broadcast_report_v1';
  const payload = {
    messaging_product: 'whatsapp',
    to: toWhatsAppNumber(adminNumber),
    type: 'template',
    template: {
      name: templateName,
      language: { code: TEMPLATE_LANG },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'broadcast_name', text: 'meeting-starting' },
            { type: 'text', parameter_name: 'total', text: String(total) },
            { type: 'text', parameter_name: 'sent', text: String(sent) },
            { type: 'text', parameter_name: 'failed', text: String(failed) },
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
  if (!data?.messages?.[0]?.id) {
    console.warn(`[meeting-starting] report send failed: ${data?.error?.message || 'unknown error'}`);
  }
}

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
    console.log(`[meeting-starting] TEST MODE — sending one real message to ${testNumber} (sample data, DB untouched).`);
    const result = await sendMeetingStartingTo({
      fullName: 'Test User',
      registrationNumber: 'TEST 000',
      mobileNumber: testNumber,
    });
    console.log(result.sent ? `[meeting-starting] Test message sent.` : `[meeting-starting] Test send FAILED: ${result.reason}`);
    process.exit(result.sent ? 0 : 1);
  }

  await connectDB();

  const targets = await Registration.find({
    event: CURRENT_EVENT,
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
    registrationNumber: { $ne: null },
    meetingStartingSentAt: null,
  }).sort({ createdAt: 1 });

  console.log(`[meeting-starting] ${targets.length} confirmed CareerX registrant(s) to notify.`);

  if (dryRun) {
    targets.forEach((r) =>
      console.log(`  - ${r.registrationNumber}  ${r.fullName}  ${r.mobileNumber}`)
    );
    console.log(`\n[meeting-starting] Dry run — nothing sent.`);
    await mongoose.connection.close();
    process.exit(0);
  }

  let sent = 0;
  let failed = 0;

  for (const reg of targets) {
    const result = await sendMeetingStartingTo(reg);
    if (result.sent) {
      await Registration.updateOne({ _id: reg._id }, { $set: { meetingStartingSentAt: new Date() } });
      sent += 1;
    } else {
      console.warn(`[meeting-starting] failed ${reg.fullName} ${reg.mobileNumber}: ${result.reason}`);
      failed += 1;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n[meeting-starting] Done. Sent: ${sent}, failed: ${failed}.`);
  await sendBroadcastReport({ total: targets.length, sent, failed });
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[meeting-starting] Failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
