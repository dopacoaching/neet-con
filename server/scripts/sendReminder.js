/**
 * One-off: send the day-before event reminder to every seat-holding
 * registration, via the approved WHATSAPP_REMINDER_TEMPLATE_NAME template
 * (defaults to 'neetcon_2026_reminder' — see server/utils/whatsapp.js).
 *
 * Usage:
 *   cd server
 *   node scripts/sendReminder.js --dry-run   # preview the list, sends nothing
 *   node scripts/sendReminder.js              # actually sends
 *
 * Safe to re-run: only targets registrations that haven't been sent a
 * reminder yet (reminderSentAt is null), so a partial/interrupted run can be
 * resumed without double-sending.
 */
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

import connectDB from '../config/db.js';
import Registration from '../models/Registration.js';
import { sendReminder } from '../utils/whatsapp.js';

const dryRun = process.argv.includes('--dry-run');
const DELAY_MS = 300; // spread sends out a little; avoid hammering the Graph API

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  await connectDB();

  const targets = await Registration.find({
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
    reminderSentAt: null,
  }).sort({ createdAt: 1 });

  console.log(`[reminder] ${targets.length} registration(s) to remind.`);

  if (dryRun) {
    targets.forEach((r) =>
      console.log(`  - ${r.registrationNumber || r.orderId}  ${r.fullName}  ${r.mobileNumber}`)
    );
    console.log('\n[reminder] Dry run — nothing sent.');
    await mongoose.connection.close();
    process.exit(0);
  }

  let sent = 0;
  let failed = 0;
  for (const reg of targets) {
    const result = await sendReminder(reg);
    if (result.sent) {
      reg.reminderSentAt = new Date();
      await reg.save();
      sent += 1;
    } else {
      console.warn(`[reminder] skipped ${reg.registrationNumber || reg.orderId}: ${result.reason}`);
      failed += 1;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n[reminder] Done. Sent: ${sent}, skipped/failed: ${failed}.`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[reminder] Failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
