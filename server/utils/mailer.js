import nodemailer from 'nodemailer';
import { generateQrBuffer } from './qrcode.js';

/**
 * Email sender for registration confirmations.
 *
 * Transport selection:
 *   1. If SMTP_* env vars are set  -> real delivery via that SMTP server.
 *   2. Else, in non-production     -> a nodemailer **Ethereal** test inbox is
 *      auto-created. The email is actually "sent" and captured, and a preview
 *      URL is logged so you can open the rendered email + QR in a browser.
 *      (Ethereal does NOT deliver to real inboxes — it is for testing only.)
 *   3. Else, in production w/o SMTP -> skipped with a warning (never blocks
 *      payment confirmation).
 */

let transporter = null;
let transportKind = null; // 'smtp' | 'ethereal'

const isMailConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const isProd = () => process.env.NODE_ENV === 'production';

/**
 * Lazily build (and cache) the transport.
 * @returns {Promise<import('nodemailer').Transporter|null>}
 */
const getTransport = async () => {
  if (transporter) return transporter;

  if (isMailConfigured()) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true', // true for 465
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    transportKind = 'smtp';
    return transporter;
  }

  if (isProd()) {
    return null; // no test inbox in production — caller will skip + warn
  }

  // Dev/testing fallback: a disposable Ethereal account (requires network).
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  transportKind = 'ethereal';
  console.warn(
    '[mail] SMTP not configured — using an Ethereal TEST inbox. Emails are NOT ' +
      'delivered to real addresses; a preview URL is logged per message. Set ' +
      'SMTP_HOST/SMTP_USER/SMTP_PASS for real delivery.'
  );
  return transporter;
};

const EVENT = {
  name: 'NEET CON 2026',
  date: process.env.EVENT_DATE || '12 July 2026',
  time: process.env.EVENT_TIME || '9:30 AM – 5:00 PM',
  venue: process.env.EVENT_VENUE || 'Yamaniya Hall, Kuttikattor',
};

const buildHtml = (reg) => `
  <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;background:#001e5f;color:#fff;border-radius:16px;overflow:hidden">
    <div style="background:#002ef4;padding:24px 28px">
      <h1 style="margin:0;font-size:20px">NEET CON 2026</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:.9">DOPA Coaching, Calicut</p>
    </div>
    <div style="padding:28px">
      <p style="font-size:16px;margin:0 0 6px">Hi ${reg.fullName},</p>
      <p style="margin:0 0 20px;color:#c2cdf0">Your seat is <strong style="color:#4ade80">confirmed</strong>! Show the QR code below at the entry desk.</p>

      <div style="background:#08296f;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:1px;color:#6680ff;text-transform:uppercase">Your Registration Code</p>
        <p style="margin:0 0 16px;font-size:26px;font-weight:800;letter-spacing:1px">${reg.registrationNumber}</p>
        <img src="cid:qrcode" alt="Entry QR code" width="220" height="220" style="background:#fff;border-radius:12px;padding:10px"/>
      </div>

      <table style="width:100%;font-size:14px;color:#c9c9e0;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#9a9ac0">Name</td><td style="text-align:right;color:#fff">${reg.fullName}</td></tr>
        <tr><td style="padding:6px 0;color:#9a9ac0">Preparing For</td><td style="text-align:right;color:#fff">${reg.preparingFor}</td></tr>
        <tr><td style="padding:6px 0;color:#9a9ac0">Date</td><td style="text-align:right;color:#fff">${EVENT.date}</td></tr>
        <tr><td style="padding:6px 0;color:#9a9ac0">Time</td><td style="text-align:right;color:#fff">${EVENT.time}</td></tr>
        <tr><td style="padding:6px 0;color:#9a9ac0">Venue</td><td style="text-align:right;color:#fff">${EVENT.venue}</td></tr>
        <tr><td style="padding:6px 0;color:#9a9ac0">Amount Paid</td><td style="text-align:right;color:#fff">₹${reg.amount}</td></tr>
      </table>

      <p style="margin:22px 0 0;font-size:12px;color:#7a7aa0">Please keep this email safe — your QR code is your entry pass. See you at the event!</p>
    </div>
  </div>`;

const buildText = (reg) =>
  `NEET CON 2026 — Registration Confirmed\n\n` +
  `Hi ${reg.fullName}, your seat is confirmed.\n\n` +
  `Registration Code: ${reg.registrationNumber}\n` +
  `Date: ${EVENT.date}\nTime: ${EVENT.time}\nVenue: ${EVENT.venue}\nAmount Paid: ₹${reg.amount}\n\n` +
  `Show your QR code (attached / in the HTML email) at the entry desk.`;

/**
 * Send the confirmation email with the QR code attached (inline, cid:qrcode).
 * Never throws — returns a result object the caller can log.
 *
 * @param {object} reg  the confirmed registration document
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
export const sendConfirmationEmail = async (reg) => {
  if (!reg?.emailAddress) {
    return { sent: false, reason: 'no email address on record' };
  }

  let transport;
  try {
    transport = await getTransport();
  } catch (err) {
    console.error(`[mail] could not initialise transport: ${err.message}`);
    return { sent: false, reason: `transport init failed: ${err.message}` };
  }

  if (!transport) {
    console.warn(
      `[mail] no mail transport (production without SMTP) — skipped email to ` +
        `${reg.emailAddress} (${reg.registrationNumber}). Set SMTP_* to enable.`
    );
    return { sent: false, reason: 'no transport configured' };
  }

  try {
    const qrBuffer = await generateQrBuffer(reg.registrationNumber);
    const info = await transport.sendMail({
      from: process.env.MAIL_FROM || `"NEET CON 2026" <${process.env.SMTP_USER || 'no-reply@neetcon.test'}>`,
      to: reg.emailAddress,
      subject: `✅ NEET CON 2026 — Seat Confirmed (${reg.registrationNumber})`,
      text: buildText(reg),
      html: buildHtml(reg),
      attachments: [
        {
          filename: `${reg.registrationNumber.replace(/\s+/g, '-')}-qr.png`,
          content: qrBuffer,
          cid: 'qrcode', // referenced by <img src="cid:qrcode">
          contentType: 'image/png',
        },
      ],
    });

    const previewUrl = transportKind === 'ethereal' ? nodemailer.getTestMessageUrl(info) : null;
    if (previewUrl) {
      console.log(
        `[mail] TEST email for ${reg.emailAddress} (${reg.registrationNumber}). ` +
          `Preview the email + QR here: ${previewUrl}`
      );
    } else {
      console.log(`[mail] confirmation sent to ${reg.emailAddress} (${reg.registrationNumber})`);
    }
    return { sent: true, preview: previewUrl || undefined };
  } catch (err) {
    console.error(`[mail] failed to send to ${reg.emailAddress}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
};
