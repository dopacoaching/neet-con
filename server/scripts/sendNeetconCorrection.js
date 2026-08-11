/**
 * One-off: send the venue-correction message to everyone who already
 * received the original NEET CON invite (careerx_neetcon_invite_v1), whose
 * approved text incorrectly said "📍 Bhatia Hall, Kuttikatoor, Kozhikode".
 * Uses the approved WHATSAPP_NEETCON_CORRECTION_TEMPLATE_NAME template
 * (careerx_neetcon_correction_v1).
 *
 * Two target groups (mirrors sendNeetconInvite.js's grouping), each sent
 * exactly once:
 *  1. Registration docs with neetconInviteSentAt set (got v1 via the DB
 *     group) and neetconCorrectionSentAt still null.
 *  2. The extraSentLog.json list from the original run (numbers with no
 *     Registration doc) — reused here, tracked separately in
 *     neetconCorrectionSentLog.json so re-runs are safe.
 *  Anyone who has since registered for CareerX is skipped — they already
 *  get the accurate online-mode info via their confirmation/mode-update.
 *
 * Usage:
 *   cd server
 *   node scripts/sendNeetconCorrection.js --dry-run   # preview both lists, sends nothing
 *   node scripts/sendNeetconCorrection.js              # actually sends
 */
import { config as loadEnv } from 'dotenv';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
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
const TEMPLATE_NAME = process.env.WHATSAPP_NEETCON_CORRECTION_TEMPLATE_NAME || 'careerx_neetcon_correction_v1';
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en';
const COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE || '91';
const CORRECTION_SENT_LOG_PATH = join(__dirname, 'neetconCorrectionSent.json');

const EVENT = {
  date: process.env.EVENT_DATE || 'Thursday, 13 August 2026',
  time: process.env.EVENT_TIME || '10:00 AM',
};

const dryRun = process.argv.includes('--dry-run');
const DELAY_MS = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toWhatsAppNumber = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length === 10 ? `${COUNTRY_CODE}${digits}` : digits;
};

async function loadExtraOriginalList() {
  const path = join(__dirname, 'neetconExtraSent.json');
  if (!existsSync(path)) return [];
  return JSON.parse(await readFile(path, 'utf8'));
}

async function loadCorrectionSentLog() {
  if (!existsSync(CORRECTION_SENT_LOG_PATH)) return new Set();
  return new Set(JSON.parse(await readFile(CORRECTION_SENT_LOG_PATH, 'utf8')));
}

async function saveCorrectionSentLog(set) {
  await writeFile(CORRECTION_SENT_LOG_PATH, JSON.stringify([...set], null, 2));
}

async function sendCorrectionTo(mobileNumber) {
  const payload = {
    messaging_product: 'whatsapp',
    to: toWhatsAppNumber(mobileNumber),
    type: 'template',
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANG },
      components: [
        {
          type: 'body',
          parameters: [
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

  await connectDB();

  const careerxMobiles = new Set(
    await Registration.distinct('mobileNumber', { event: CURRENT_EVENT })
  );

  const dbTargets = await Registration.find({
    neetconInviteSentAt: { $ne: null },
    neetconCorrectionSentAt: null,
  }).sort({ createdAt: 1 });
  const dbFiltered = dbTargets.filter((r) => !careerxMobiles.has(r.mobileNumber));

  const originalExtraList = await loadExtraOriginalList();
  const correctionAlreadySent = await loadCorrectionSentLog();
  const extraTargets = originalExtraList.filter(
    (n) => !careerxMobiles.has(n) && !correctionAlreadySent.has(n)
  );

  console.log(
    `[neetcon-correction] DB group: ${dbTargets.length} raw candidate(s), ${dbFiltered.length} after excluding CareerX registrants.`
  );
  console.log(
    `[neetcon-correction] Extra list group: ${originalExtraList.length} originally sent, ${extraTargets.length} to send now.`
  );

  if (dryRun) {
    dbFiltered.forEach((r) =>
      console.log(`  - [db] ${r.registrationNumber || r.orderId || r._id}  ${r.fullName}  ${r.mobileNumber}`)
    );
    extraTargets.forEach((n) => console.log(`  - [extra] ${n}`));
    console.log(
      `\n[neetcon-correction] Total to send: ${dbFiltered.length + extraTargets.length}. Dry run — nothing sent.`
    );
    await mongoose.connection.close();
    process.exit(0);
  }

  let sent = 0;
  let failed = 0;

  for (const reg of dbFiltered) {
    const result = await sendCorrectionTo(reg.mobileNumber);
    if (result.sent) {
      await Registration.updateOne({ _id: reg._id }, { $set: { neetconCorrectionSentAt: new Date() } });
      sent += 1;
    } else {
      console.warn(`[neetcon-correction] failed ${reg.fullName} ${reg.mobileNumber}: ${result.reason}`);
      failed += 1;
    }
    await sleep(DELAY_MS);
  }

  for (const mobileNumber of extraTargets) {
    const result = await sendCorrectionTo(mobileNumber);
    if (result.sent) {
      correctionAlreadySent.add(mobileNumber);
      await saveCorrectionSentLog(correctionAlreadySent);
      sent += 1;
    } else {
      console.warn(`[neetcon-correction] failed (extra) ${mobileNumber}: ${result.reason}`);
      failed += 1;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n[neetcon-correction] Done. Sent: ${sent}, failed: ${failed}.`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[neetcon-correction] Failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
