import crypto from 'crypto';
import Registration, { PAYMENT_STATUS, PREPARING_FOR } from '../models/Registration.js';
import generateOrderId from '../utils/generateOrderId.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateEventPass } from '../utils/eventPass.js';
import { nextRegistrationNumber } from '../utils/registrationNumber.js';
import { sendConfirmationWhatsApp } from '../utils/whatsapp.js';
import { sendUserConfirmationEmail, sendOrganizerNotification } from '../utils/email.js';

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MAX_GUESTS = 20;

/** Parse a guest-count input into a clamped non-negative integer (defaults to 0). */
const parseGuestCount = (v) => {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_GUESTS);
};

/** Constant-time compare that never throws on length mismatch. */
const secretEqual = (a, b) => {
  const ab = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

/** Reduce any Indian contact number to its 10-digit core (drops +91 / 0 / spaces). */
const normalizeMobile = (v) => {
  const d = String(v || '').replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
};

/**
 * POST /api/registrations
 * Event is free — confirm the seat immediately (no payment step) and return
 * the orderId/registration number.
 */
export const createRegistration = asyncHandler(async (req, res) => {
  const {
    fullName,
    mobileNumber,
    emailAddress = '',
    schoolOrCollege,
    passedYear = '',
    preparingFor,
    guestCount = 0,
  } = req.body || {};

  // --- Validation ---
  const errors = [];
  if (!fullName || !fullName.trim()) errors.push('Full name is required');
  if (!mobileNumber || !MOBILE_RE.test(String(mobileNumber).trim()))
    errors.push('A valid 10-digit Indian mobile number is required');
  // Email is optional now (confirmation goes to WhatsApp); validate only if given.
  if (emailAddress && !EMAIL_RE.test(String(emailAddress).trim()))
    errors.push('Enter a valid email address');
  if (!schoolOrCollege || !schoolOrCollege.trim()) errors.push('School/College is required');
  if (!preparingFor || !Object.values(PREPARING_FOR).includes(preparingFor))
    errors.push('Preparing For must be "NEET 2027" or "NEET 2028"');

  if (errors.length) {
    res.status(400);
    throw new Error(errors.join('; '));
  }

  const mobile = String(mobileNumber).trim();

  // --- Duplicate protection: a seat-holding reg for this mobile already exists ---
  const existing = await Registration.findOne({
    mobileNumber: mobile,
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
  });
  if (existing) {
    res.status(409);
    throw new Error('This mobile number is already registered.');
  }

  const orderId = generateOrderId();

  // A unique partial index on { mobileNumber, paymentStatus: FREE } is the
  // real guard against two concurrent requests for the same mobile number
  // both passing the findOne check above — it rejects the loser atomically
  // at the DB level instead of letting both docs get created first.
  let registration;
  try {
    registration = await Registration.create({
      fullName: fullName.trim(),
      mobileNumber: mobile,
      emailAddress: String(emailAddress).trim().toLowerCase(),
      schoolOrCollege: schoolOrCollege.trim(),
      passedYear: String(passedYear).trim(),
      preparingFor,
      guestCount: parseGuestCount(guestCount),
      orderId,
      amount: 0,
      paymentStatus: PAYMENT_STATUS.FREE,
      registrationNumber: await nextRegistrationNumber(),
      confirmedAt: new Date(),
    });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.mobileNumber) {
      res.status(409);
      throw new Error('This mobile number is already registered.');
    }
    throw err;
  }

  // Send the confirmation + QR via WhatsApp, plus backup email. Fire-and-forget
  // so the response is never delayed by Meta/SMTP; neither ever throws.
  sendConfirmationWhatsApp(registration).catch((err) =>
    console.error(`[whatsapp] registration send error: ${err?.message || err}`)
  );
  sendUserConfirmationEmail(registration).catch((err) =>
    console.error(`[email] user send error: ${err?.message || err}`)
  );
  sendOrganizerNotification(registration).catch((err) =>
    console.error(`[email] organizer send error: ${err?.message || err}`)
  );

  res.status(201).json({
    success: true,
    message: 'Registration confirmed!',
    data: {
      orderId: registration.orderId,
      registrationId: registration._id,
      registrationNumber: registration.registrationNumber,
      amount: registration.amount,
      fullName: registration.fullName,
    },
  });
});

/** Validate the shared free-registration input; returns { name, mobile, errors }. */
const validateFreeInput = (body = {}) => {
  const name = String(body.name || body.fullName || '').trim();
  const mobile = normalizeMobile(body.contactNumber || body.mobileNumber);
  const errors = [];
  if (!name) errors.push('Name is required');
  if (!MOBILE_RE.test(mobile)) errors.push('A valid 10-digit contact number is required');
  return { name, mobile, errors };
};

/**
 * Create a FREE (no-payment) seat and send the WhatsApp entry pass.
 * Idempotent: returns the existing seat for a mobile that already holds one.
 * @returns {Promise<{ duplicate:boolean, registration:object }>}
 */
const provisionFreeSeat = async ({ name, mobile, source, body }) => {
  const existing = await Registration.findOne({
    mobileNumber: mobile,
    paymentStatus: {
      $in: [PAYMENT_STATUS.CONFIRMED, PAYMENT_STATUS.MANUAL, PAYMENT_STATUS.FREE],
    },
  });
  if (existing) return { duplicate: true, registration: existing };

  const registration = await Registration.create({
    fullName: name,
    mobileNumber: mobile,
    source,
    district: String(body.district || '').trim(),
    currentStatus: String(body.currentStatus || '').trim(),
    expectedScore: String(body.expectedScore || '').trim(),
    remarks: String(body.remarks || '').trim(),
    // Google Form column can be named a few different ways depending on how
    // the sheet/Apps Script maps it — accept the common ones.
    guestCount: parseGuestCount(body.guestCount ?? body.accompanying ?? body.guests),
    orderId: generateOrderId(),
    paymentStatus: PAYMENT_STATUS.FREE,
    amount: 0,
    registrationNumber: await nextRegistrationNumber(),
    confirmedAt: new Date(),
  });

  // Send the WhatsApp entry pass so free attendees can be scanned at the gate.
  sendConfirmationWhatsApp(registration).catch((err) =>
    console.error(`[whatsapp] free reg send error: ${err?.message || err}`)
  );

  return { duplicate: false, registration };
};

/**
 * POST /api/registrations/external
 * Ingest a free (DOPA student) registration from the Google Form via its Apps
 * Script. Authenticated by a shared secret (X-Form-Secret / body.secret).
 */
export const createExternalRegistration = asyncHandler(async (req, res) => {
  const secret = process.env.FORM_INGEST_SECRET;
  const provided = req.get('x-form-secret') || req.body?.secret || '';
  if (!secret || !secretEqual(provided, secret)) {
    res.status(401);
    throw new Error('Unauthorized');
  }

  const { name, mobile, errors } = validateFreeInput(req.body);
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join('; '));
  }

  const { duplicate, registration } = await provisionFreeSeat({
    name,
    mobile,
    source: 'google_form',
    body: req.body || {},
  });
  res.status(duplicate ? 200 : 201).json({
    success: true,
    duplicate,
    data: { orderId: registration.orderId, registrationNumber: registration.registrationNumber },
  });
});

/**
 * GET /api/registrations/pass/:orderId
 * Public — returns the branded entry-pass PNG for a CONFIRMED registration.
 * Gated by the orderId (which the registrant already holds); only available
 * once the seat is confirmed and a registration code exists.
 */
export const getPass = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const registration = await Registration.findOne({ orderId });
  const confirmed =
    registration &&
    registration.registrationNumber &&
    Registration.SEAT_HOLDING_STATUSES.includes(registration.paymentStatus);

  if (!confirmed) {
    res.status(404);
    throw new Error('Pass not available');
  }

  const png = await generateEventPass(registration);
  const filename = `neetcon-2026-${String(registration.registrationNumber).replace(/\s+/g, '-')}.png`;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  // Contains PII (name + registration code): keep it out of shared/CDN caches
  // (private only), and allow the cross-origin client (Vercel) to render it as
  // an <img> despite the API's default same-origin resource policy.
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.send(png);
});
