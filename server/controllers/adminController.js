import Admin from '../models/Admin.js';
import Registration, { PAYMENT_STATUS, PREPARING_FOR } from '../models/Registration.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { buildRegistrationsWorkbook } from '../utils/exportExcel.js';
import { nextRegistrationNumber } from '../utils/registrationNumber.js';
import { sendConfirmationWhatsApp } from '../utils/whatsapp.js';
import { sendUserConfirmationEmail } from '../utils/email.js';
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
 * Query: page, limit, status, preparingFor, search, guestInfo
 *   guestInfo=needsReview -> replied to the guest-count ask but couldn't be
 *     parsed (guestCountReplyRaw set) — needs a human to read + set manually.
 *   guestInfo=notAnswered -> guestCount was never asked/answered at all.
 */
export const listRegistrations = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const { status, preparingFor, search, guestInfo, whatsappStatus } = req.query;

  const filter = {};
  if (status && Object.values(PAYMENT_STATUS).includes(status)) filter.paymentStatus = status;
  if (preparingFor && Object.values(PREPARING_FOR).includes(preparingFor))
    filter.preparingFor = preparingFor;
  if (guestInfo === 'needsReview') {
    filter.guestCountReplyRaw = { $ne: '' };
  } else if (guestInfo === 'notAnswered') {
    filter.guestCount = { $exists: false };
  }
  if (['sent', 'failed', 'skipped', 'unknown'].includes(whatsappStatus)) {
    filter.whatsappStatus = whatsappStatus;
    // Seat-holding only — a failed/pending registration was never eligible to
    // get a confirmation in the first place, so it's not a "missed" send.
    filter.paymentStatus = filter.paymentStatus || { $in: Registration.SEAT_HOLDING_STATUSES };
  }

  if (search && search.trim()) {
    const term = search.trim();
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { fullName: { $regex: safe, $options: 'i' } },
      { mobileNumber: { $regex: safe, $options: 'i' } },
      { emailAddress: { $regex: safe, $options: 'i' } },
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
  const { status, notes, guestCount } = req.body || {};
  const registration = await Registration.findById(req.params.id);
  if (!registration) {
    res.status(404);
    throw new Error('Registration not found');
  }

  if (typeof notes === 'string') {
    registration.notes = notes;
  }

  if (guestCount !== undefined && guestCount !== null && guestCount !== '') {
    const n = Math.trunc(Number(guestCount));
    if (!Number.isFinite(n) || n < 0 || n > 20) {
      res.status(400);
      throw new Error('Guest count must be a number between 0 and 20');
    }
    registration.guestCount = n;
    // Resolved — clear the "needs review" flag if one was set.
    registration.guestCountReplyRaw = '';
  }

  if (status) {
    if (!Object.values(PAYMENT_STATUS).includes(status)) {
      res.status(400);
      throw new Error('Invalid status');
    }

    const wasConfirmed = Registration.SEAT_HOLDING_STATUSES.includes(registration.paymentStatus);
    const becomingConfirmed =
      Registration.SEAT_HOLDING_STATUSES.includes(status) && !wasConfirmed;

    if (becomingConfirmed) {
      // Duplicate-payment guard: don't seat a mobile that already holds a seat.
      const dupe = await Registration.findOne({
        _id: { $ne: registration._id },
        mobileNumber: registration.mobileNumber,
        paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
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

    // On a manual confirmation, send the confirmation + QR via WhatsApp and (if
    // the registrant gave an email) by email. Fire-and-forget so the admin
    // response isn't delayed. No organizer notice here — that's reserved for
    // confirmations driven by an actual user payment.
    if (becomingConfirmed) {
      sendConfirmationWhatsApp(registration).catch((err) =>
        console.error(`[whatsapp] unexpected send error: ${err?.message || err}`)
      );
      sendUserConfirmationEmail(registration).catch((err) =>
        console.error(`[email] unexpected user send error: ${err?.message || err}`)
      );
    }
    return res.json({ success: true, data: registration.toObject() });
  }

  await registration.save();
  res.json({ success: true, data: registration.toObject() });
});

/**
 * POST /api/admin/registrations/:id/resend-whatsapp
 * Re-send the confirmation + QR to a registrant who never got it (or whose
 * send failed). Only makes sense for a seat-holding registration. Requires
 * admin role. Awaited (not fire-and-forget) so the admin gets a real result.
 */
export const resendWhatsApp = asyncHandler(async (req, res) => {
  const registration = await Registration.findById(req.params.id);
  if (!registration) {
    res.status(404);
    throw new Error('Registration not found');
  }
  if (!Registration.SEAT_HOLDING_STATUSES.includes(registration.paymentStatus)) {
    res.status(409);
    throw new Error('This registration does not hold a confirmed seat.');
  }

  const result = await sendConfirmationWhatsApp(registration);
  if (!result.sent) {
    res.status(502);
    throw new Error(`WhatsApp send failed: ${result.reason || 'unknown error'}`);
  }
  const updated = await Registration.findById(registration._id).lean();
  res.json({ success: true, data: updated });
});

/**
 * GET /api/admin/summary
 * Dashboard cards data.
 */
export const summary = asyncHandler(async (req, res) => {
  const [counts, checkedIn, guestAgg] = await Promise.all([
    Registration.aggregate([{ $group: { _id: '$paymentStatus', count: { $sum: 1 } } }]),
    Registration.countDocuments({ checkedInAt: { $ne: null } }),
    // Only count guests for seats that actually hold (paid/manual/free) —
    // a PENDING/FAILED attempt's guest count isn't a real headcount yet.
    Registration.aggregate([
      { $match: { paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$guestCount', 0] } } } },
    ]),
  ]);

  const byStatus = counts.reduce((acc, c) => {
    acc[c._id] = c.count;
    return acc;
  }, {});

  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const totalGuests = guestAgg[0]?.total || 0;
  const confirmedTotal =
    (byStatus[PAYMENT_STATUS.CONFIRMED] || 0) +
    (byStatus[PAYMENT_STATUS.MANUAL] || 0) +
    (byStatus[PAYMENT_STATUS.FREE] || 0);

  res.json({
    success: true,
    data: {
      total,
      confirmed: byStatus[PAYMENT_STATUS.CONFIRMED] || 0,
      manual: byStatus[PAYMENT_STATUS.MANUAL] || 0,
      free: byStatus[PAYMENT_STATUS.FREE] || 0,
      pending: byStatus[PAYMENT_STATUS.PENDING] || 0,
      failed: byStatus[PAYMENT_STATUS.FAILED] || 0,
      checkedIn,
      totalGuests,
      expectedHeadcount: confirmedTotal + totalGuests,
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
  guestCount: r.guestCount,
});

/**
 * GET /api/admin/checkins
 * The list of everyone already checked in (most recent first) + a count.
 * Available to any authenticated admin (gate staff may be viewers).
 */
export const listCheckIns = asyncHandler(async (req, res) => {
  const items = await Registration.find({ checkedInAt: { $ne: null } })
    .sort({ checkedInAt: -1 })
    .select(
      'registrationNumber fullName mobileNumber preparingFor schoolOrCollege checkedInAt checkedInBy guestCount'
    )
    .lean();
  res.json({ success: true, data: { count: items.length, items } });
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

  const isConfirmed = Registration.SEAT_HOLDING_STATUSES.includes(registration.paymentStatus);

  if (!isConfirmed) {
    return res.status(200).json({
      success: false,
      result: 'not_confirmed',
      message: 'This registration is not a confirmed/paid seat — do not admit.',
      data: checkinView(registration),
    });
  }

  // Claim the check-in atomically so two gate scanners hitting the same QR at
  // the same moment can't both admit — exactly one wins, the other sees
  // "already checked in".
  const updated = await Registration.findOneAndUpdate(
    { _id: registration._id, checkedInAt: null },
    { $set: { checkedInAt: new Date(), checkedInBy: req.admin.username } },
    { new: true }
  );

  if (!updated) {
    const current = await Registration.findById(registration._id);
    return res.status(200).json({
      success: false,
      result: 'already_checked_in',
      message: 'Already checked in — possible duplicate scan.',
      data: checkinView(current || registration),
    });
  }

  return res.json({
    success: true,
    result: 'checked_in',
    message: 'Checked in successfully. Admit the student.',
    data: checkinView(updated),
  });
});

/**
 * PATCH /api/admin/registrations/:id/guest-count
 * Set the guest count from the gate (spoken/typed at check-in) rather than
 * relying on the WhatsApp follow-up reply. Any authenticated admin (incl.
 * viewer-role gate staff) can set this — it doesn't touch seat/payment status.
 */
export const setGuestCountAtGate = asyncHandler(async (req, res) => {
  const n = Math.trunc(Number(req.body?.guestCount));
  if (!Number.isFinite(n) || n < 0 || n > 20) {
    res.status(400);
    throw new Error('Guest count must be a number between 0 and 20');
  }

  const registration = await Registration.findByIdAndUpdate(
    req.params.id,
    { $set: { guestCount: n, guestCountReplyRaw: '' } },
    { new: true }
  );
  if (!registration) {
    res.status(404);
    throw new Error('Registration not found');
  }

  res.json({ success: true, data: checkinView(registration) });
});
