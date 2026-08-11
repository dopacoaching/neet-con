import Registration, { PAYMENT_STATUS, DOPA_STATUS, CURRENT_EVENT } from '../models/Registration.js';
import generateOrderId from '../utils/generateOrderId.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { nextRegistrationNumber } from '../utils/registrationNumber.js';
import { sendConfirmationWhatsApp } from '../utils/whatsapp.js';
import { sendUserConfirmationEmail, sendOrganizerNotification } from '../utils/email.js';
import { appendRegistrationRow } from '../utils/googleSheets.js';

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Registrations are open unless explicitly closed via REGISTRATIONS_OPEN=false. */
const isRegistrationsOpen = () => String(process.env.REGISTRATIONS_OPEN).toLowerCase() !== 'false';

/**
 * POST /api/registrations
 * CareerX is free to attend — the seat is confirmed immediately (no payment
 * step) and the registration number is returned/sent right away.
 */
export const createRegistration = asyncHandler(async (req, res) => {
  if (!isRegistrationsOpen()) {
    res.status(403);
    throw new Error('Registrations for CareeRx are now closed. Thank you for your interest!');
  }

  const {
    fullName,
    mobileNumber,
    emailAddress = '',
    dopaStatus,
    schoolOrCollege,
    batch = '',
    neetScore = '',
    passedYear = '',
  } = req.body || {};

  // --- Validation ---
  const errors = [];
  if (!fullName || !fullName.trim()) errors.push('Full name is required');
  if (!mobileNumber || !MOBILE_RE.test(String(mobileNumber).trim()))
    errors.push('A valid 10-digit Indian mobile number is required');
  // Email is optional now (confirmation goes to WhatsApp); validate only if given.
  if (emailAddress && !EMAIL_RE.test(String(emailAddress).trim()))
    errors.push('Enter a valid email address');
  if (!dopaStatus || !Object.values(DOPA_STATUS).includes(dopaStatus))
    errors.push('Please select DOPA or Non-DOPA');
  if (!schoolOrCollege || !schoolOrCollege.trim())
    errors.push(dopaStatus === DOPA_STATUS.DOPA ? 'Campus name is required' : 'Institution name is required');
  if (dopaStatus === DOPA_STATUS.DOPA && (!batch || !String(batch).trim()))
    errors.push('Batch is required');
  if (!neetScore || !String(neetScore).trim()) errors.push('NEET 2026 score is required');
  if (!passedYear || !String(passedYear).trim()) errors.push('12th pass-out year is required');

  if (errors.length) {
    res.status(400);
    throw new Error(errors.join('; '));
  }

  const mobile = String(mobileNumber).trim();

  // --- Duplicate protection: a seat-holding CareerX reg for this mobile already exists ---
  const existing = await Registration.findOne({
    mobileNumber: mobile,
    event: CURRENT_EVENT,
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
  });
  if (existing) {
    res.status(409);
    throw new Error('This mobile number is already registered.');
  }

  const orderId = generateOrderId();

  // A unique partial index on { mobileNumber, event, paymentStatus: FREE } is
  // the real guard against two concurrent requests for the same mobile number
  // both passing the findOne check above — it rejects the loser atomically at
  // the DB level instead of letting both docs get created first.
  let registration;
  try {
    registration = await Registration.create({
      event: CURRENT_EVENT,
      fullName: fullName.trim(),
      mobileNumber: mobile,
      emailAddress: String(emailAddress).trim().toLowerCase(),
      dopaStatus,
      schoolOrCollege: schoolOrCollege.trim(),
      batch: dopaStatus === DOPA_STATUS.DOPA ? String(batch).trim() : '',
      neetScore: String(neetScore).trim(),
      passedYear: String(passedYear).trim(),
      orderId,
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

  // Send the confirmation via WhatsApp, plus backup email. Fire-and-forget
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
  appendRegistrationRow(registration).catch((err) =>
    console.error(`[sheets] append row error: ${err?.message || err}`)
  );

  res.status(201).json({
    success: true,
    message: 'Registration confirmed!',
    data: {
      orderId: registration.orderId,
      registrationId: registration._id,
      registrationNumber: registration.registrationNumber,
      fullName: registration.fullName,
      mobileNumber: registration.mobileNumber,
    },
  });
});

/**
 * GET /api/registrations/status/:orderId
 * Public — the Thank-You page's data source. Gated by the unguessable
 * orderId. Registration is synchronous (no payment step), so this just
 * confirms the seat exists and returns the bits the page needs to render.
 */
export const getRegistrationStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const registration = await Registration.findOne({ orderId, event: CURRENT_EVENT }).lean();
  if (!registration) {
    res.status(404);
    throw new Error('Registration not found');
  }

  res.json({
    success: true,
    data: {
      fullName: registration.fullName,
      mobileNumber: registration.mobileNumber,
      registrationNumber: registration.registrationNumber,
      paymentStatus: registration.paymentStatus,
    },
  });
});
