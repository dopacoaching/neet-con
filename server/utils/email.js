import nodemailer from 'nodemailer';
import { generateEventPass } from './eventPass.js';
import { generateQrBuffer } from './qrcode.js';

/**
 * Email delivery (nodemailer / SMTP).
 *
 * Two messages, both fire-and-forget and non-throwing:
 *   - User confirmation  -> the registrant (only if they gave an email).
 *   - Organizer notice   -> the team, on every completed payment.
 *
 * ENV (server/.env):
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE ("true"/"false")
 *   SMTP_USER, SMTP_PASS            (Gmail: use an App Password)
 *   MAIL_FROM                       e.g. "NEET CON 2026 <no-reply@dopacoaching.com>"
 *   ORGANIZER_EMAIL                 where organizer notifications are sent
 */

const EVENT = {
  date: process.env.EVENT_DATE || '12 July 2026',
  time: process.env.EVENT_TIME || '9:30 AM – 4:00 PM',
  venue: process.env.EVENT_VENUE || 'Yamaniya Hall, Kuttikattor',
  mapUrl: process.env.EVENT_MAP_URL || 'https://maps.app.goo.gl/b6ZUgZSWgj33UPXv5',
};

const FROM = () => process.env.MAIL_FROM || process.env.SMTP_USER || '';
const ORGANIZER = () => process.env.ORGANIZER_EMAIL || process.env.SMTP_USER || '';

const isEmailConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true', // true=465, false=587/STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
};

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Render the entry pass (fallback to a plain QR) as a PNG buffer for attaching. */
const passAttachment = async (reg) => {
  try {
    return await generateEventPass(reg);
  } catch {
    try {
      return await generateQrBuffer(reg.registrationNumber);
    } catch {
      return null;
    }
  }
};

/* ------------------------------------------------------------------ */
/* User confirmation                                                  */
/* ------------------------------------------------------------------ */

export const buildUserEmailHtml = (reg) => {
  const name = esc(reg.fullName);
  const code = esc(reg.registrationNumber);
  return `<!doctype html>
<html><body style="margin:0;background:#eef1f8;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0b1330">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e8f3">
      <tr><td style="background:#001e5f;padding:24px 28px">
        <div style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:.3px">NEET CON 2026</div>
        <div style="color:#9fb4ff;font-size:13px;margin-top:3px">DOPA Coaching · Calicut</div>
      </td></tr>
      <tr><td style="padding:28px">
        <span style="display:inline-block;background:#e7f8ee;color:#138a4e;font-size:12px;font-weight:bold;padding:6px 12px;border-radius:999px">✓ SEAT CONFIRMED</span>
        <h1 style="font-size:22px;margin:16px 0 6px;color:#0b1330">You're all set, ${name}!</h1>
        <p style="color:#5b6478;margin:0 0 22px;font-size:14px;line-height:1.6">Your registration for NEET CON 2026 is confirmed. Your entry pass is below — show the QR at the registration desk.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fc;border-radius:12px;margin-bottom:22px">
          <tr><td style="padding:16px 18px">
            <div style="font-size:11px;color:#7a85a0;text-transform:uppercase;letter-spacing:1.2px">Registration Code</div>
            <div style="font-size:25px;font-weight:bold;color:#002ef4;letter-spacing:1px;margin-top:4px">${code}</div>
          </td></tr>
        </table>

        <img src="cid:entrypass" alt="NEET CON 2026 entry pass" width="504" style="width:100%;height:auto;border-radius:12px;border:1px solid #e4e8f3;display:block"/>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;font-size:14px">
          <tr><td style="padding:7px 0;color:#7a85a0;border-bottom:1px solid #eef1f8">Date</td><td style="padding:7px 0;text-align:right;font-weight:bold;border-bottom:1px solid #eef1f8">${esc(EVENT.date)}</td></tr>
          <tr><td style="padding:7px 0;color:#7a85a0;border-bottom:1px solid #eef1f8">Time</td><td style="padding:7px 0;text-align:right;font-weight:bold;border-bottom:1px solid #eef1f8">${esc(EVENT.time)}</td></tr>
          <tr><td style="padding:7px 0;color:#7a85a0">Venue</td><td style="padding:7px 0;text-align:right;font-weight:bold">${esc(EVENT.venue)}</td></tr>
        </table>

        <a href="${esc(EVENT.mapUrl)}" style="display:inline-block;margin-top:22px;background:#002ef4;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px;font-size:14px">Get Directions</a>

        <p style="color:#7a85a0;font-size:13px;margin:24px 0 0;line-height:1.6">A copy has also been sent to your WhatsApp. Please keep this pass handy for entry. See you there!</p>
      </td></tr>
      <tr><td style="background:#f3f6fc;padding:16px 28px;color:#9aa3b8;font-size:12px;text-align:center">
        NEET CON 2026 · DOPA Coaching, Calicut · Automated confirmation — please do not reply.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
};

const userText = (reg) =>
  `You're confirmed for NEET CON 2026!\n\n` +
  `Registration Code: ${reg.registrationNumber}\n` +
  `Name: ${reg.fullName}\n` +
  `Date: ${EVENT.date}\n` +
  `Time: ${EVENT.time}\n` +
  `Venue: ${EVENT.venue}\n\n` +
  `Show the QR on your entry pass (attached) at the registration desk.\n` +
  `Directions: ${EVENT.mapUrl}\n\n` +
  `DOPA Coaching, Calicut`;

/**
 * Email the entry pass to the registrant. Only sends when an email was given.
 * Never throws.
 * @returns {Promise<{ sent:boolean, reason?:string }>}
 */
export const sendUserConfirmationEmail = async (reg) => {
  const to = String(reg?.emailAddress || '').trim();
  if (!to) return { sent: false, reason: 'no email on record' };
  if (!isEmailConfigured()) {
    console.warn('[email] SMTP not configured — skipped user confirmation.');
    return { sent: false, reason: 'not configured' };
  }
  try {
    const png = await passAttachment(reg);
    const attachments = png
      ? [
          {
            filename: `neetcon-2026-${String(reg.registrationNumber).replace(/\s+/g, '-')}.png`,
            content: png,
            cid: 'entrypass',
          },
        ]
      : [];
    await getTransporter().sendMail({
      from: FROM(),
      to,
      subject: `Your NEET CON 2026 entry pass — ${reg.registrationNumber}`,
      text: userText(reg),
      html: buildUserEmailHtml(reg),
      attachments,
    });
    console.log(`[email] confirmation sent to ${to} (${reg.registrationNumber})`);
    return { sent: true };
  } catch (err) {
    console.error(`[email] failed to send confirmation to ${to}: ${err.message}`);
    return { sent: false, reason: err.message };
  }
};

/* ------------------------------------------------------------------ */
/* Organizer notification                                             */
/* ------------------------------------------------------------------ */

export const buildOrganizerEmailHtml = (reg) => {
  const row = (k, v) =>
    `<tr><td style="padding:8px 12px;color:#7a85a0;border-bottom:1px solid #eef1f8">${k}</td>` +
    `<td style="padding:8px 12px;font-weight:bold;border-bottom:1px solid #eef1f8">${esc(v || '—')}</td></tr>`;
  return `<!doctype html>
<html><body style="margin:0;background:#eef1f8;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0b1330">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e4e8f3">
      <tr><td style="background:#001e5f;padding:20px 24px;color:#ffffff;font-size:17px;font-weight:bold">New registration · NEET CON 2026</td></tr>
      <tr><td style="padding:8px 12px 20px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
          ${row('Registration Code', reg.registrationNumber)}
          ${row('Name', reg.fullName)}
          ${row('Mobile', reg.mobileNumber)}
          ${row('Email', reg.emailAddress)}
          ${row('School / College', reg.schoolOrCollege)}
          ${row('Preparing For', reg.preparingFor)}
          ${row('Order ID', reg.orderId)}
          ${row('Confirmed At', reg.confirmedAt ? new Date(reg.confirmedAt).toLocaleString('en-IN') : '')}
        </table>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
};

/**
 * Notify the organizer of a completed registration. Never throws.
 * @returns {Promise<{ sent:boolean, reason?:string }>}
 */
export const sendOrganizerNotification = async (reg) => {
  const to = ORGANIZER();
  if (!to) return { sent: false, reason: 'no organizer email configured' };
  if (!isEmailConfigured()) {
    console.warn('[email] SMTP not configured — skipped organizer notification.');
    return { sent: false, reason: 'not configured' };
  }
  try {
    await getTransporter().sendMail({
      from: FROM(),
      to,
      subject: `New registration: ${reg.fullName} (${reg.registrationNumber})`,
      text:
        `New registration for NEET CON 2026\n\n` +
        `Code: ${reg.registrationNumber}\nName: ${reg.fullName}\nMobile: ${reg.mobileNumber}\n` +
        `Email: ${reg.emailAddress || '—'}\nSchool: ${reg.schoolOrCollege}\nPreparing: ${reg.preparingFor}\n` +
        `Order: ${reg.orderId}`,
      html: buildOrganizerEmailHtml(reg),
    });
    console.log(`[email] organizer notified (${reg.registrationNumber}) -> ${to}`);
    return { sent: true };
  } catch (err) {
    console.error(`[email] failed to notify organizer: ${err.message}`);
    return { sent: false, reason: err.message };
  }
};
