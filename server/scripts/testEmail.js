/**
 * Send sample confirmation + organizer emails to verify the SMTP setup.
 *
 * Usage:
 *   cd server
 *   node scripts/testEmail.js you@example.com     # recipient of the user email
 *
 * - Needs SMTP_USER / SMTP_PASS (Gmail App Password) set in server/.env.
 * - The organizer notification goes to ORGANIZER_EMAIL.
 * - Does NOT touch the database — it builds a sample registration.
 */
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sendUserConfirmationEmail, sendOrganizerNotification } from '../utils/email.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/testEmail.js <recipient-email>');
  process.exit(1);
}

const sampleRegistration = {
  fullName: 'Test Student',
  registrationNumber: 'NEET CON 001',
  preparingFor: 'NEET 2027',
  amount: Number(process.env.REGISTRATION_FEE || 100),
  emailAddress: to,
  mobileNumber: '7306540341',
  schoolOrCollege: 'DOPA Coaching, Calicut',
  orderId: 'DOPA-TEST-0001',
  confirmedAt: new Date(),
};

console.log(`[test] sending sample confirmation email to ${to} ...`);
const user = await sendUserConfirmationEmail(sampleRegistration);
console.log('[test] user email:', user.sent ? '✅ sent' : `❌ ${user.reason}`);

console.log(`[test] sending organizer notification to ${process.env.ORGANIZER_EMAIL || '(unset)'} ...`);
const org = await sendOrganizerNotification(sampleRegistration);
console.log('[test] organizer email:', org.sent ? '✅ sent' : `❌ ${org.reason}`);

process.exit(user.sent || org.sent ? 0 : 1);
