/**
 * One-off: ask registrants who registered before the guest-count question
 * existed ("{ guestCount: { $exists: false } }") how many family/friends
 * are joining them, via the approved WHATSAPP_GUESTCOUNT_TEMPLATE_NAME
 * template. Replies are auto-captured by the WhatsApp webhook handler
 * (see server/controllers/whatsappController.js).
 *
 * Usage:
 *   cd server
 *   node scripts/sendGuestCountAsk.js --dry-run   # preview the list, sends nothing
 *   node scripts/sendGuestCountAsk.js              # actually sends
 *
 * Safe to re-run: only targets registrations still missing guestCount, so
 * anyone who has already answered (or been manually set) is skipped.
 */
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

import connectDB from '../config/db.js';
import Registration from '../models/Registration.js';
import { sendGuestCountAsk } from '../utils/whatsapp.js';

const dryRun = process.argv.includes('--dry-run');
const DELAY_MS = 300; // spread sends out a little; avoid hammering the Graph API

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  await connectDB();

  const targets = await Registration.find({
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
    guestCount: { $exists: false },
    guestCountAskedAt: null, // skip anyone already asked (e.g. a prior test send)
  }).sort({ createdAt: 1 });

  console.log(`[guest-count-ask] ${targets.length} registration(s) to ask.`);

  if (dryRun) {
    targets.forEach((r) =>
      console.log(`  - ${r.registrationNumber || r.orderId}  ${r.fullName}  ${r.mobileNumber}`)
    );
    console.log('\n[guest-count-ask] Dry run — nothing sent.');
    await mongoose.connection.close();
    process.exit(0);
  }

  let sent = 0;
  let failed = 0;
  for (const reg of targets) {
    const result = await sendGuestCountAsk(reg);
    if (result.sent) {
      reg.guestCountAskedAt = new Date();
      await reg.save();
      sent += 1;
    } else {
      console.warn(`[guest-count-ask] skipped ${reg.registrationNumber || reg.orderId}: ${result.reason}`);
      failed += 1;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n[guest-count-ask] Done. Sent: ${sent}, skipped/failed: ${failed}.`);
  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[guest-count-ask] Failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
