/**
 * One-off: send the "event moved to online mode" update to every confirmed
 * CareerX registrant (event=careerx, paymentStatus FREE/MANUAL — i.e. has a
 * registrationNumber), via the approved WHATSAPP_MODE_UPDATE_TEMPLATE_NAME
 * template (careerx_mode_update_v1). Tracked per-registration in
 * modeUpdateSentAt so this script is safe to re-run (only unsent ones go out).
 *
 * Usage:
 *   cd server
 *   node scripts/sendModeUpdate.js --dry-run          # preview recipients, sends nothing
 *   node scripts/sendModeUpdate.js --test=9876543210  # send ONE real message to this number only (sample data, not tracked in DB)
 *   node scripts/sendModeUpdate.js                     # actually sends to every unsent registrant
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
const TEMPLATE_NAME = process.env.WHATSAPP_MODE_UPDATE_TEMPLATE_NAME || 'careerx_mode_update_v1';
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
const COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE || '91';

const EVENT = {
  date: process.env.EVENT_DATE || 'Thursday, 13 August 2026',
  time: process.env.EVENT_TIME || '10:00 AM',
};

const dryRun = process.argv.includes('--dry-run');
const testArg = process.argv.find((a) => a.startsWith('--test='));
const testNumber = testArg ? testArg.slice('--test='.length) : null;
const DELAY_MS = 300; // spread sends out a little; avoid hammering the Graph API

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toWhatsAppNumber = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length === 10 ? `${COUNTRY_CODE}${digits}` : digits;
};

async function sendUpdateTo(reg) {
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
            { type: 'text', parameter_name: 'event_date', text: EVENT.date },
            { type: 'text', parameter_name: 'event_time', text: EVENT.time },
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
    console.log(`[mode-update] TEST MODE — sending one real message to ${testNumber} (sample data, DB untouched).`);
    const result = await sendUpdateTo({
      fullName: 'Test User',
      registrationNumber: 'TEST 000',
      mobileNumber: testNumber,
    });
    console.log(result.sent ? `[mode-update] Test message sent.` : `[mode-update] Test send FAILED: ${result.reason}`);
    process.exit(result.sent ? 0 : 1);
  }

  await connectDB();

  const targets = await Registration.find({
    event: CURRENT_EVENT,
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
    registrationNumber: { $ne: null },
    modeUpdateSentAt: null,
  }).sort({ createdAt: 1 });

  console.log(`[mode-update] ${targets.length} confirmed CareerX registrant(s) to notify.`);

  if (dryRun) {
    targets.forEach((r) =>
      console.log(`  - ${r.registrationNumber}  ${r.fullName}  ${r.mobileNumber}`)
    );
    console.log(`\n[mode-update] Dry run — nothing sent.`);
    await mongoose.connection.close();
    process.exit(0);
  }

  let sent = 0;
  let failed = 0;

  for (const reg of targets) {
    const result = await sendUpdateTo(reg);
    if (result.sent) {
      await Registration.updateOne({ _id: reg._id }, { $set: { modeUpdateSentAt: new Date() } });
      sent += 1;
    } else {
      console.warn(`[mode-update] failed ${reg.fullName} ${reg.mobileNumber}: ${result.reason}`);
      failed += 1;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n[mode-update] Done. Sent: ${sent}, failed: ${failed}.`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[mode-update] Failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
