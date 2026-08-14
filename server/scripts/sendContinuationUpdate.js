/**
 * One-off: send the "CareeRx continues on Aug 15-16" update to every
 * confirmed CareerX registrant (from the original Aug 13 session), via the
 * approved WHATSAPP_CONTINUATION_UPDATE_TEMPLATE_NAME template
 * (careerx_continuation_update_v1). Tracked per-registration in
 * continuationUpdateSentAt so this script is safe to re-run.
 *
 * The event_date wording is time-sensitive: if Saturday 15 Aug 7:30 PM IST
 * has already passed when this runs, only Sunday 16 Aug is mentioned (no
 * point telling someone to join a Saturday session that's over).
 *
 * Usage:
 *   cd server
 *   node scripts/sendContinuationUpdate.js --dry-run          # preview recipients, sends nothing
 *   node scripts/sendContinuationUpdate.js --test=9876543210  # send ONE real message to this number only
 *   node scripts/sendContinuationUpdate.js                     # actually sends to every unsent registrant
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
const TEMPLATE_NAME = process.env.WHATSAPP_CONTINUATION_UPDATE_TEMPLATE_NAME || 'careerx_continuation_update_v1';
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
const COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE || '91';

// Saturday 15 Aug 2026, 7:30 PM IST == 14:00:00 UTC.
const SATURDAY_CUTOFF_UTC_MS = Date.parse('2026-08-15T14:00:00Z');
const EVENT_TIME = process.env.EVENT_TIME || '7:30 PM';

const eventDateForNow = () =>
  Date.now() > SATURDAY_CUTOFF_UTC_MS ? 'Sunday, 16 August 2026' : 'Saturday & Sunday, 15–16 August 2026';

const dryRun = process.argv.includes('--dry-run');
const testArg = process.argv.find((a) => a.startsWith('--test='));
const testNumber = testArg ? testArg.slice('--test='.length) : null;
const DELAY_MS = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toWhatsAppNumber = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length === 10 ? `${COUNTRY_CODE}${digits}` : digits;
};

async function sendContinuationUpdateTo(reg) {
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
            { type: 'text', parameter_name: 'event_date', text: eventDateForNow() },
            { type: 'text', parameter_name: 'event_time', text: EVENT_TIME },
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

  console.log(`[continuation-update] event_date wording for right now: "${eventDateForNow()}"`);

  if (testNumber) {
    console.log(`[continuation-update] TEST MODE — sending one real message to ${testNumber} (sample data, DB untouched).`);
    const result = await sendContinuationUpdateTo({
      fullName: 'Test User',
      registrationNumber: 'TEST 000',
      mobileNumber: testNumber,
    });
    console.log(result.sent ? `[continuation-update] Test message sent.` : `[continuation-update] Test send FAILED: ${result.reason}`);
    process.exit(result.sent ? 0 : 1);
  }

  await connectDB();

  const targets = await Registration.find({
    event: CURRENT_EVENT,
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
    registrationNumber: { $ne: null },
    continuationUpdateSentAt: null,
  }).sort({ createdAt: 1 });

  console.log(`[continuation-update] ${targets.length} confirmed CareerX registrant(s) to notify.`);

  if (dryRun) {
    targets.forEach((r) =>
      console.log(`  - ${r.registrationNumber}  ${r.fullName}  ${r.mobileNumber}`)
    );
    console.log(`\n[continuation-update] Dry run — nothing sent.`);
    await mongoose.connection.close();
    process.exit(0);
  }

  let sent = 0;
  let failed = 0;

  for (const reg of targets) {
    const result = await sendContinuationUpdateTo(reg);
    if (result.sent) {
      await Registration.updateOne({ _id: reg._id }, { $set: { continuationUpdateSentAt: new Date() } });
      sent += 1;
    } else {
      console.warn(`[continuation-update] failed ${reg.fullName} ${reg.mobileNumber}: ${result.reason}`);
      failed += 1;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n[continuation-update] Done. Sent: ${sent}, failed: ${failed}.`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[continuation-update] Failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
