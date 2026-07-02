import crypto from 'crypto';
import Registration, { PAYMENT_STATUS, PREPARING_FOR } from '../models/Registration.js';
import generateOrderId from '../utils/generateOrderId.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateEventPass } from '../utils/eventPass.js';
import { nextRegistrationNumber } from '../utils/registrationNumber.js';
import { sendConfirmationWhatsApp } from '../utils/whatsapp.js';

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

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
 * Save a new registration with PENDING status and return an orderId.
 */
export const createRegistration = asyncHandler(async (req, res) => {
  const {
    fullName,
    mobileNumber,
    emailAddress = '',
    schoolOrCollege,
    passedYear = '',
    preparingFor,
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

  // --- Duplicate protection: a CONFIRMED/MANUAL reg for this mobile already exists ---
  const existing = await Registration.findOne({
    mobileNumber: mobile,
    paymentStatus: { $in: [PAYMENT_STATUS.CONFIRMED, PAYMENT_STATUS.MANUAL] },
  });
  if (existing) {
    res.status(409);
    throw new Error('This mobile number is already registered.');
  }

  const orderId = generateOrderId();

  const registration = await Registration.create({
    fullName: fullName.trim(),
    mobileNumber: mobile,
    emailAddress: String(emailAddress).trim().toLowerCase(),
    schoolOrCollege: schoolOrCollege.trim(),
    passedYear: String(passedYear).trim(),
    preparingFor,
    orderId,
    paymentStatus: PAYMENT_STATUS.PENDING,
  });

  res.status(201).json({
    success: true,
    message: 'Registration saved. Proceed to payment.',
    data: {
      orderId: registration.orderId,
      registrationId: registration._id,
      amount: registration.amount,
      fullName: registration.fullName,
    },
  });
});

/**
 * POST /api/registrations/external
 * Ingest a free (DOPA student) registration from the Google Form via its Apps
 * Script. Authenticated by a shared secret (X-Form-Secret / body.secret), NOT a
 * user session. Creates a CONFIRMED-equivalent FREE seat (no payment), issues a
 * registration number, and sends the WhatsApp entry pass.
 */
export const createExternalRegistration = asyncHandler(async (req, res) => {
  const secret = process.env.FORM_INGEST_SECRET;
  const provided = req.get('x-form-secret') || req.body?.secret || '';
  if (!secret || !secretEqual(provided, secret)) {
    res.status(401);
    throw new Error('Unauthorized');
  }

  const body = req.body || {};
  const finalName = String(body.name || body.fullName || '').trim();
  const mobile = normalizeMobile(body.contactNumber || body.mobileNumber);

  const errors = [];
  if (!finalName) errors.push('Name is required');
  if (!MOBILE_RE.test(mobile)) errors.push('A valid 10-digit contact number is required');
  if (errors.length) {
    res.status(400);
    throw new Error(errors.join('; '));
  }

  // Idempotent: if this mobile already holds a seat (online-paid, manual or a
  // previous form submit), return it instead of creating a duplicate.
  const existing = await Registration.findOne({
    mobileNumber: mobile,
    paymentStatus: {
      $in: [PAYMENT_STATUS.CONFIRMED, PAYMENT_STATUS.MANUAL, PAYMENT_STATUS.FREE],
    },
  });
  if (existing) {
    return res.status(200).json({
      success: true,
      duplicate: true,
      data: { orderId: existing.orderId, registrationNumber: existing.registrationNumber },
    });
  }

  const registration = await Registration.create({
    fullName: finalName,
    mobileNumber: mobile,
    source: 'google_form',
    district: String(body.district || '').trim(),
    currentStatus: String(body.currentStatus || '').trim(),
    expectedScore: String(body.expectedScore || '').trim(),
    remarks: String(body.remarks || '').trim(),
    orderId: generateOrderId(),
    paymentStatus: PAYMENT_STATUS.FREE,
    amount: 0,
    registrationNumber: await nextRegistrationNumber(),
    confirmedAt: new Date(),
  });

  // Send the WhatsApp entry pass so free attendees can be scanned at the gate.
  sendConfirmationWhatsApp(registration).catch((err) =>
    console.error(`[whatsapp] external reg send error: ${err?.message || err}`)
  );

  res.status(201).json({
    success: true,
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
    (registration.paymentStatus === PAYMENT_STATUS.CONFIRMED ||
      registration.paymentStatus === PAYMENT_STATUS.MANUAL);

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
