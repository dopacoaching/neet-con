/**
 * One-off: invite old NEET CON 2026 registrants (plus a supplementary
 * manually-provided number list) to the new CareerX event via the approved
 * WHATSAPP_NEETCON_INVITE_TEMPLATE_NAME template (careerx_neetcon_invite_v1).
 *
 * Two target groups, each sent exactly once:
 *  1. Registration docs that predate the `event` field (or otherwise aren't
 *     tagged `careerx`), excluding anyone who has already registered for
 *     CareerX (same mobile number under event=careerx) and anyone already
 *     sent this invite (neetconInviteSentAt set).
 *  2. EXTRA_NUMBERS below (a manually supplied list) — only the ones that
 *     are NOT already a CareerX registrant and NOT already covered by group
 *     1 (avoids double-sending to someone in both lists). Sent status for
 *     this group is tracked in extraSentLog.json (these numbers have no
 *     Registration doc to flag).
 *
 * Usage:
 *   cd server
 *   node scripts/sendNeetconInvite.js --dry-run   # preview both lists, sends nothing
 *   node scripts/sendNeetconInvite.js              # actually sends
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
const TEMPLATE_NAME = process.env.WHATSAPP_NEETCON_INVITE_TEMPLATE_NAME || 'careerx_neetcon_invite_v1';
const COUNTRY_CODE = process.env.WHATSAPP_COUNTRY_CODE || '91';
const POSTER_PATH = join(__dirname, '..', '..', 'WhatsApp Image 2026-08-08 at 3.06.53 PM.jpeg');
const EXTRA_SENT_LOG_PATH = join(__dirname, 'neetconExtraSent.json');

const dryRun = process.argv.includes('--dry-run');
const DELAY_MS = 300; // spread sends out a little; avoid hammering the Graph API

// Supplementary numbers to also invite, provided directly (not necessarily
// in the Registration collection at all).
const EXTRA_NUMBERS = [
  '9946850077', '9744351315', '7012625181', '9846616805', '8075820556',
  '9645646847', '8921908339', '9495667348', '8137841421', '8129211212',
  '7558891350', '9656774566', '9961339171', '9846057706', '9526643379',
  '9846588559', '9400030996', '9447238887', '9895666843', '9633100889',
  '9847766786', '9544491278', '8606694472', '9778590852', '9846771087',
  '8281345923', '8943219406', '9497298464', '7907879499', '6282946217',
  '8943039020', '8547508920', '9562751515', '9526577120', '8589070708',
  '9526890428', '9072461888', '9961106340', '9946263999', '9495666162',
  '8547108433', '9188230963', '9544635596', '9037658090', '9895492431',
  '8129770319', '9847060778', '9446238379', '6282919651', '9744517376',
  '9961074561', '9446766434', '9961037899', '9567366676', '9947240241',
  '8089893394', '8825805956', '8086984504', '8075698364', '8075489773',
  '9567610673', '9495449677', '7025568821', '9526508888', '8943235440',
  '8113038541', '7356588744', '7034599694', '7306596790', '9495427742',
  '9778185045', '9846523970', '9072823365', '9526401635', '7907845698',
  '8089089001', '7994156214', '8111878383', '9747353426', '9037858671',
  '9447990877', '8921195933', '7306723887', '9633393463', '9745163777',
  '9847746774', '6238637842', '9846105382', '9605006053', '8921274889',
  '9495551889', '9947012403', '8891783586', '9995682878', '9605233595',
  '6238666683', '7559924133', '7994910343', '8281041000', '9188281636',
  '7558019099',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const toWhatsAppNumber = (mobile) => {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length === 10 ? `${COUNTRY_CODE}${digits}` : digits;
};

async function loadExtraSentLog() {
  if (!existsSync(EXTRA_SENT_LOG_PATH)) return new Set();
  const raw = await readFile(EXTRA_SENT_LOG_PATH, 'utf8');
  return new Set(JSON.parse(raw));
}

async function saveExtraSentLog(set) {
  await writeFile(EXTRA_SENT_LOG_PATH, JSON.stringify([...set], null, 2));
}

async function uploadHeaderMedia() {
  if (!existsSync(POSTER_PATH)) {
    throw new Error(`Poster image not found at ${POSTER_PATH} — check it exists before re-running.`);
  }
  const bytes = await readFile(POSTER_PATH);
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'image/jpeg');
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'poster.jpg');

  const res = await fetch(`${GRAPH}/${API_VERSION}/${PHONE_NUMBER_ID}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: form,
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Header media upload failed: ${JSON.stringify(data)}`);
  return data.id;
}

async function sendInviteTo(mobileNumber, mediaId) {
  const payload = {
    messaging_product: 'whatsapp',
    to: toWhatsAppNumber(mobileNumber),
    type: 'template',
    template: {
      name: TEMPLATE_NAME,
      language: { code: 'en' },
      components: [{ type: 'header', parameters: [{ type: 'image', image: { id: mediaId } }] }],
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
  await connectDB();

  const careerxMobiles = new Set(
    await Registration.distinct('mobileNumber', { event: CURRENT_EVENT })
  );

  const candidates = await Registration.find({
    event: { $ne: CURRENT_EVENT },
    mobileNumber: { $regex: /^[6-9]\d{9}$/ },
    // 'CONFIRMED' is a legacy NEET CON 2026 paid-registration status (old
    // HDFC/Juspay gateway flow, pre-rebrand) not covered by the current
    // CareerX-only SEAT_HOLDING_STATUSES (['MANUAL','FREE']) — include it
    // explicitly here so old paid registrants aren't silently skipped.
    paymentStatus: { $in: [...Registration.SEAT_HOLDING_STATUSES, 'CONFIRMED'] },
    neetconInviteSentAt: null,
  }).sort({ createdAt: 1 });

  const seenMobiles = new Set();
  const targets = [];
  for (const reg of candidates) {
    if (careerxMobiles.has(reg.mobileNumber)) continue; // already a CareerX registrant
    if (seenMobiles.has(reg.mobileNumber)) continue; // dedupe old duplicate NEET CON entries
    seenMobiles.add(reg.mobileNumber);
    targets.push(reg);
  }

  const extraAlreadySent = await loadExtraSentLog();
  const extraTargets = [...new Set(EXTRA_NUMBERS)].filter(
    (n) => !careerxMobiles.has(n) && !seenMobiles.has(n) && !extraAlreadySent.has(n)
  );

  console.log(
    `[neetcon-invite] NEET CON group: ${candidates.length} raw candidate(s), ${targets.length} after dedupe/exclusion.`
  );
  console.log(
    `[neetcon-invite] Extra list group: ${EXTRA_NUMBERS.length} provided, ${extraTargets.length} to send (after removing CareerX/NEETCON overlaps and already-sent).`
  );

  if (dryRun) {
    targets.forEach((r) =>
      console.log(`  - [neetcon] ${r.registrationNumber || r.orderId || r._id}  ${r.fullName}  ${r.mobileNumber}`)
    );
    extraTargets.forEach((n) => console.log(`  - [extra] ${n}`));
    console.log(`\n[neetcon-invite] Total to send: ${targets.length + extraTargets.length}. Dry run — nothing sent.`);
    await mongoose.connection.close();
    process.exit(0);
  }

  console.log('[neetcon-invite] Uploading header image once for reuse across all sends...');
  const mediaId = await uploadHeaderMedia();
  console.log(`[neetcon-invite] Header media id: ${mediaId}`);

  let sent = 0;
  let failed = 0;

  for (const reg of targets) {
    const result = await sendInviteTo(reg.mobileNumber, mediaId);
    if (result.sent) {
      // Atomic field update — NOT reg.save(). These docs predate the
      // `event` field, so Mongoose hydrates them with `event`'s schema
      // default ('careerx') applied in memory; calling .save() persists
      // that default back to the DB, silently relabeling old NEET CON
      // registrations as CareerX ones. updateOne touches only this field.
      await Registration.updateOne({ _id: reg._id }, { $set: { neetconInviteSentAt: new Date() } });
      sent += 1;
    } else {
      console.warn(`[neetcon-invite] failed ${reg.fullName} ${reg.mobileNumber}: ${result.reason}`);
      failed += 1;
    }
    await sleep(DELAY_MS);
  }

  for (const mobileNumber of extraTargets) {
    const result = await sendInviteTo(mobileNumber, mediaId);
    if (result.sent) {
      extraAlreadySent.add(mobileNumber);
      await saveExtraSentLog(extraAlreadySent);
      sent += 1;
    } else {
      console.warn(`[neetcon-invite] failed (extra) ${mobileNumber}: ${result.reason}`);
      failed += 1;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n[neetcon-invite] Done. Sent: ${sent}, failed: ${failed}.`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[neetcon-invite] Failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
