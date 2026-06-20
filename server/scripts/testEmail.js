/**
 * Send a sample confirmation email (with a QR code) to verify the mail setup.
 *
 * Usage:
 *   cd server
 *   node scripts/testEmail.js you@example.com
 *
 * - With SMTP_USER/SMTP_PASS set in .env  -> sends a REAL email via Gmail.
 * - With them blank (development)         -> uses Ethereal and logs a preview URL.
 *
 * This does NOT touch the database — it builds a fake registration object.
 */
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sendConfirmationEmail } from '../utils/mailer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/testEmail.js <recipient-email>');
  process.exit(1);
}

const sampleRegistration = {
  fullName: 'Test Student',
  emailAddress: to,
  registrationNumber: 'NEET CON 001',
  preparingFor: 'NEET 2027',
  amount: Number(process.env.REGISTRATION_FEE || 200),
};

console.log(`[test] sending sample confirmation email to ${to} ...`);
const result = await sendConfirmationEmail(sampleRegistration);

if (result.sent) {
  console.log('[test] ✅ sent.', result.preview ? `Preview: ${result.preview}` : '(check the inbox)');
  process.exit(0);
} else {
  console.error(`[test] ❌ not sent: ${result.reason}`);
  process.exit(1);
}
