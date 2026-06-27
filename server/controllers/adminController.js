import Admin from '../models/Admin.js';
import Registration, { PAYMENT_STATUS, PREPARING_FOR } from '../models/Registration.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { buildRegistrationsWorkbook } from '../utils/exportExcel.js';
import { nextRegistrationNumber } from '../utils/registrationNumber.js';
import { sendConfirmationWhatsApp } from '../utils/whatsapp.js';
import {
  signAdminToken,
  adminCookieOptions,
  ADMIN_COOKIE,
  findEnvAdmin,
} from '../middleware/authMiddleware.js';

/**
 * POST /api/admin/login
 */
export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400);
    throw new Error('Username and password are required');
  }

  // Env-defined admin (ADMIN_CREDENTIALS) takes precedence — works without DB seed.
  const envAdmin = findEnvAdmin(username, password);
  if (envAdmin) {
    const token = signAdminToken(envAdmin);
    res.cookie(ADMIN_COOKIE, token, adminCookieOptions());
    return res.json({ success: true, data: envAdmin.toSafeJSON() });
  }

  const admin = await Admin.findOne({ username: String(username).toLowerCase().trim() });
  // Constant-ish failure message to avoid user enumeration.
  if (!admin || !(await admin.verifyPassword(password))) {
    res.status(401);
    throw new Error('Invalid username or password');
  }

  const token = signAdminToken(admin);
  res.cookie(ADMIN_COOKIE, token, adminCookieOptions());
  res.json({ success: true, data: admin.toSafeJSON() });
});

/**
 * POST /api/admin/logout
 */
export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(ADMIN_COOKIE, { ...adminCookieOptions(), maxAge: undefined });
  res.json({ success: true, message: 'Logged out' });
});

/**
 * GET /api/admin/me
 */
export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.admin.toSafeJSON() });
});

/**
 * GET /api/admin/registrations
 * Paginated, searchable, filterable list.
 * Query: page, limit, status, preparingFor, search
 */
export const listRegistrations = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const { status, preparingFor, search } = req.query;

  const filter = {};
  if (status && Object.values(PAYMENT_STATUS).includes(status)) filter.paymentStatus = status;
  if (preparingFor && Object.values(PREPARING_FOR).includes(preparingFor))
    filter.preparingFor = preparingFor;

  if (search && search.trim()) {
    const term = search.trim();
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { fullName: { $regex: safe, $options: 'i' } },
      { mobileNumber: { $regex: safe, $options: 'i' } },
      { registrationNumber: { $regex: safe, $options: 'i' } },
      { schoolOrCollege: { $regex: safe, $options: 'i' } },
    ];
  }

  const [total, items] = await Promise.all([
    Registration.countDocuments(filter),
    Registration.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    },
  });
});

/**
 * GET /api/admin/registrations/:id
 */
export const getRegistration = asyncHandler(async (req, res) => {
  const registration = await Registration.findById(req.params.id).lean();
  if (!registration) {
    res.status(404);
    throw new Error('Registration not found');
  }
  res.json({ success: true, data: registration });
});

/**
 * PATCH /api/admin/registrations/:id/status
 * Manually update status (MANUAL / CONFIRMED / FAILED / PENDING) and/or notes.
 * Requires admin role.
 */
export const updateRegistrationStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body || {};
  const registration = await Registration.findById(req.params.id);
  if (!registration) {
    res.status(404);
    throw new Error('Registration not found');
  }

  if (typeof notes === 'string') {
    registration.notes = notes;
  }

  if (status) {
    if (!Object.values(PAYMENT_STATUS).includes(status)) {
      res.status(400);
      throw new Error('Invalid status');
    }

    const wasConfirmed =
      registration.paymentStatus === PAYMENT_STATUS.CONFIRMED ||
      registration.paymentStatus === PAYMENT_STATUS.MANUAL;
    const becomingConfirmed =
      (status === PAYMENT_STATUS.MANUAL || status === PAYMENT_STATUS.CONFIRMED) && !wasConfirmed;

    if (becomingConfirmed) {
      // Duplicate-payment guard: don't seat a mobile that already holds a seat.
      const dupe = await Registration.findOne({
        _id: { $ne: registration._id },
        mobileNumber: registration.mobileNumber,
        paymentStatus: { $in: [PAYMENT_STATUS.CONFIRMED, PAYMENT_STATUS.MANUAL] },
      });
      if (dupe) {
        res.status(409);
        throw new Error(
          `This mobile is already confirmed under ${dupe.registrationNumber || dupe.orderId}.`
        );
      }
      // Allocate the next sequential registration code atomically.
      if (!registration.registrationNumber) {
        registration.registrationNumber = await nextRegistrationNumber();
      }
      registration.confirmedAt = registration.confirmedAt || new Date();
    }

    // Un-confirming (confirmed -> failed/pending): clear the confirmation stamp
    // so the record isn't left in a half-confirmed state. The already-issued
    // registrationNumber is kept (its QR may have been sent) and is not reused.
    if (wasConfirmed && (status === PAYMENT_STATUS.FAILED || status === PAYMENT_STATUS.PENDING)) {
      registration.confirmedAt = null;
      registration.manuallyConfirmedBy = '';
    }

    if (status === PAYMENT_STATUS.MANUAL) {
      registration.manuallyConfirmedBy = req.admin.username;
    }

    registration.paymentStatus = status;

    await registration.save();

    // On a manual confirmation, send the confirmation + QR via WhatsApp too.
    // Fire-and-forget so the admin response isn't delayed by Meta's API.
    if (becomingConfirmed) {
      sendConfirmationWhatsApp(registration).catch((err) =>
        console.error(`[whatsapp] unexpected send error: ${err?.message || err}`)
      );
    }
    return res.json({ success: true, data: registration.toObject() });
  }

  await registration.save();
  res.json({ success: true, data: registration.toObject() });
});

/**
 * GET /api/admin/summary
 * Dashboard cards data.
 */
export const summary = asyncHandler(async (req, res) => {
  const counts = await Registration.aggregate([
    { $group: { _id: '$paymentStatus', count: { $sum: 1 } } },
  ]);

  const byStatus = counts.reduce((acc, c) => {
    acc[c._id] = c.count;
    return acc;
  }, {});

  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  res.json({
    success: true,
    data: {
      total,
      confirmed: byStatus[PAYMENT_STATUS.CONFIRMED] || 0,
      manual: byStatus[PAYMENT_STATUS.MANUAL] || 0,
      pending: byStatus[PAYMENT_STATUS.PENDING] || 0,
      failed: byStatus[PAYMENT_STATUS.FAILED] || 0,
    },
  });
});

/**
 * GET /api/admin/export
 * Export all registrations to .xlsx. Admin role only.
 */
export const exportRegistrations = asyncHandler(async (req, res) => {
  const registrations = await Registration.find({}).sort({ createdAt: 1 }).lean();
  const buffer = buildRegistrationsWorkbook(registrations);

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="neetcon2026-registrations-${stamp}.xlsx"`
  );
  res.send(buffer);
});

/**
 * The subset of a registration shown to the gate scanner after a scan.
 */
const checkinView = (r) => ({
  id: r._id,
  registrationNumber: r.registrationNumber,
  fullName: r.fullName,
  mobileNumber: r.mobileNumber,
  schoolOrCollege: r.schoolOrCollege,
  preparingFor: r.preparingFor,
  paymentStatus: r.paymentStatus,
  checkedInAt: r.checkedInAt,
  checkedInBy: r.checkedInBy,
});

/**
 * POST /api/admin/checkin
 * Body: { code }  — the registration code encoded in the student's QR.
 * Looks the student up, validates the seat, and marks attendance (once).
 * Available to any authenticated admin (gate staff may be viewers).
 */
export const checkIn = asyncHandler(async (req, res) => {
  const code = String(req.body?.code || '').trim();
  if (!code) {
    res.status(400);
    throw new Error('No QR code / registration number provided');
  }

  const registration = await Registration.findOne({ registrationNumber: code });
  if (!registration) {
    res.status(404);
    throw new Error(`No registration found for "${code}"`);
  }

  const isConfirmed =
    registration.paymentStatus === PAYMENT_STATUS.CONFIRMED ||
    registration.paymentStatus === PAYMENT_STATUS.MANUAL;

  if (!isConfirmed) {
    return res.status(200).json({
      success: false,
      result: 'not_confirmed',
      message: 'This registration is not a confirmed/paid seat — do not admit.',
      data: checkinView(registration),
    });
  }

  if (registration.checkedInAt) {
    return res.status(200).json({
      success: false,
      result: 'already_checked_in',
      message: 'Already checked in — possible duplicate scan.',
      data: checkinView(registration),
    });
  }

  registration.checkedInAt = new Date();
  registration.checkedInBy = req.admin.username;
  await registration.save();

  return res.json({
    success: true,
    result: 'checked_in',
    message: 'Checked in successfully. Admit the student.',
    data: checkinView(registration),
  });
});
