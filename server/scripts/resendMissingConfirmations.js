/**
 * One-off: resend the WhatsApp confirmation + QR to every seat-holding
 * registration whose delivery was never confirmed as sent. Before this
 * script's companion tracking fields (whatsappStatus etc. on Registration)
 * existed, sends were fire-and-forget with no persisted outcome, so every
 * pre-existing registration reads as 'unknown' — this is expected on first
 * run and is exactly the backlog we're clearing.
 *
 * Usage:
 *   cd server
 *   node scripts/resendMissingConfirmations.js --dry-run   # preview only
 *   node scripts/resendMissingConfirmations.js              # actually sends
 *
 * Safe to re-run: sendConfirmationWhatsApp records whatsappStatus='sent' on
 * success, so a second run only retries whoever is still 'unknown'/'failed'.
 */
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

import connectDB from '../config/db.js';
import Registration from '../models/Registration.js';
import { sendConfirmationWhatsApp } from '../utils/whatsapp.js';

const dryRun = process.argv.includes('--dry-run');
const DELAY_MS = 300; // spread sends out a little; avoid hammering the Graph API

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  await connectDB();

  const targets = await Registration.find({
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
    $or: [
      { whatsappStatus: { $exists: false } }, // pre-existing docs, field never written
      { whatsappStatus: { $in: ['unknown', 'failed'] } },
    ],
  }).sort({ createdAt: 1 });

  console.log(`[resend-confirmations] ${targets.length} registration(s) to (re)send.`);

  if (dryRun) {
    targets.forEach((r) =>
      console.log(
        `  - ${r.registrationNumber || r.orderId}  ${r.fullName}  ${r.mobileNumber}  (whatsappStatus=${r.whatsappStatus})`
      )
    );
    console.log('\n[resend-confirmations] Dry run — nothing sent.');
    await mongoose.connection.close();
    process.exit(0);
  }

  let sent = 0;
  let failed = 0;
  for (const reg of targets) {
    const result = await sendConfirmationWhatsApp(reg);
    if (result.sent) {
      sent += 1;
      console.log(`[resend-confirmations] sent to ${reg.registrationNumber || reg.orderId}`);
    } else {
      failed += 1;
      console.warn(
        `[resend-confirmations] failed for ${reg.registrationNumber || reg.orderId}: ${result.reason}`
      );
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n[resend-confirmations] Done. Sent: ${sent}, failed: ${failed}.`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[resend-confirmations] Failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
