/**
 * Send a sample confirmation (with QR) over WhatsApp to verify the setup.
 *
 * Usage:
 *   cd server
 *   node scripts/testWhatsApp.js 9876543210      # 10-digit, or 919876543210
 *
 * - WHATSAPP_MOCK=true            -> logs what would be sent (no real message).
 * - WHATSAPP_MOCK=false + creds   -> sends a REAL template message via Meta.
 *
 * Does NOT touch the database — it builds a sample registration object.
 */
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sendConfirmationWhatsApp } from '../utils/whatsapp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/testWhatsApp.js <mobile-number>');
  process.exit(1);
}

const sampleRegistration = {
  fullName: 'Test Student',
  mobileNumber: to,
  registrationNumber: 'NEET CON 001',
  preparingFor: 'NEET 2027',
  amount: Number(process.env.REGISTRATION_FEE || 100),
};

console.log(`[test] sending sample WhatsApp confirmation to ${to} ...`);
const result = await sendConfirmationWhatsApp(sampleRegistration);

if (result.sent) {
  console.log('[test] ✅ sent.', result.messageId ? `id: ${result.messageId}` : '(mock)');
  process.exit(0);
} else {
  console.error(`[test] ❌ not sent: ${result.reason}`);
  process.exit(1);
}
