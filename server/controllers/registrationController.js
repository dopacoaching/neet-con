import Registration, { PAYMENT_STATUS, PREPARING_FOR } from '../models/Registration.js';
import generateOrderId from '../utils/generateOrderId.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getSeatStats } from '../utils/seats.js';

const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

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
  if (!emailAddress || !EMAIL_RE.test(String(emailAddress).trim()))
    errors.push('A valid email address is required');
  if (!schoolOrCollege || !schoolOrCollege.trim()) errors.push('School/College is required');
  if (!preparingFor || !Object.values(PREPARING_FOR).includes(preparingFor))
    errors.push('Preparing For must be "NEET 2027" or "NEET 2028"');

  if (errors.length) {
    res.status(400);
    throw new Error(errors.join('; '));
  }

  const mobile = String(mobileNumber).trim();

  // --- Seat cap enforcement (backend authority) ---
  const seats = await getSeatStats();
  if (seats.isFull) {
    res.status(409);
    throw new Error('Registrations are closed — all seats are filled.');
  }

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
 * GET /api/registrations/seats
 * Public live seat counter.
 */
export const getSeats = asyncHandler(async (req, res) => {
  const stats = await getSeatStats();
  res.json({ success: true, data: stats });
});
