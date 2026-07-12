import Admin from '../models/Admin.js';
import Registration, { PAYMENT_STATUS, PREPARING_FOR } from '../models/Registration.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { buildRegistrationsWorkbook } from '../utils/exportExcel.js';
import { nextRegistrationNumber } from '../utils/registrationNumber.js';
import generateOrderId from '../utils/generateOrderId.js';
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
  const [counts, checkedIn, guestAgg, checkedInGuestAgg] = await Promise.all([
    Registration.aggregate([{ $group: { _id: '$paymentStatus', count: { $sum: 1 } } }]),
    Registration.countDocuments({ checkedInAt: { $ne: null } }),
    // Only count guests for seats that actually hold (paid/manual/free) —
    // a PENDING/FAILED attempt's guest count isn't a real headcount yet.
    Registration.aggregate([
      { $match: { paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$guestCount', 0] } } } },
    ]),
    // Actual (not expected) guest headcount — only those who've walked
    // through the gate so far.
    Registration.aggregate([
      { $match: { checkedInAt: { $ne: null } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$guestCount', 0] } } } },
    ]),
  ]);

  const byStatus = counts.reduce((acc, c) => {
    acc[c._id] = c.count;
    return acc;
  }, {});

  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const totalGuests = guestAgg[0]?.total || 0;
  const checkedInGuests = checkedInGuestAgg[0]?.total || 0;
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
      checkedInGuests,
      actualHeadcount: checkedIn + checkedInGuests,
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
 * Body: { code }  — the registration code encoded in the student's QR, OR
 * (as a fallback for walk-ins without a printed QR, e.g. some Google-Form
 * students) an exact mobile number, OR a name search.
 * Looks the student up, validates the seat, and marks attendance (once).
 * Available to any authenticated admin (gate staff may be viewers).
 */
export const checkIn = asyncHandler(async (req, res) => {
  const code = String(req.body?.code || '').trim();
  if (!code) {
    res.status(400);
    throw new Error('No QR code / registration number provided');
  }

  let registration = await Registration.findOne({ registrationNumber: code });

  // Fallback 1: exact 10-digit mobile number — unambiguous, safe to proceed.
  if (!registration) {
    const digits = code.replace(/\D/g, '');
    if (digits.length === 10) {
      registration = await Registration.findOne({ mobileNumber: digits });
    }
  }

  // Fallback 2: name search. Only auto-proceeds if exactly one seat-holding
  // registration matches — otherwise surface the candidates so gate staff
  // pick the right person instead of risking checking in the wrong one.
  if (!registration) {
    const safe = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const candidates = await Registration.find({
      fullName: { $regex: safe, $options: 'i' },
      paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
    }).limit(8);

    if (candidates.length === 1) {
      registration = candidates[0];
    } else if (candidates.length > 1) {
      return res.status(200).json({
        success: false,
        result: 'multiple_matches',
        message: `${candidates.length} matches for "${code}" — pick the right one.`,
        data: { candidates: candidates.map(checkinView) },
      });
    }
  }

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

const WALKIN_MOBILE_RE = /^[6-9]\d{9}$/;

/**
 * POST /api/admin/registrations/walk-in
 * Register a student on the spot at the gate (they never registered online)
 * and check them in immediately in the same action. Name, mobile, and guest
 * count are required; school/college and preparing-for are optional. Any
 * authenticated admin (incl. viewer-role gate staff) can do this.
 */
export const registerWalkIn = asyncHandler(async (req, res) => {
  const { fullName, mobileNumber, schoolOrCollege = '', preparingFor = '', guestCount } =
    req.body || {};

  const errors = [];
  if (!fullName || !String(fullName).trim()) errors.push('Full name is required');
  if (!mobileNumber || !WALKIN_MOBILE_RE.test(String(mobileNumber).trim()))
    errors.push('A valid 10-digit Indian mobile number is required');
  const n = Math.trunc(Number(guestCount));
  if (guestCount === undefined || guestCount === null || guestCount === '' || !Number.isFinite(n))
    errors.push('Guest count is required');
  else if (n < 0 || n > 20) errors.push('Guest count must be between 0 and 20');
  if (preparingFor && !Object.values(PREPARING_FOR).includes(preparingFor))
    errors.push('Preparing For must be "NEET 2027" or "NEET 2028"');

  if (errors.length) {
    res.status(400);
    throw new Error(errors.join('; '));
  }

  const mobile = String(mobileNumber).trim();

  const existing = await Registration.findOne({
    mobileNumber: mobile,
    paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
  });
  if (existing) {
    res.status(409);
    throw new Error(
      `This mobile number is already registered under ${existing.registrationNumber || existing.orderId} — check them in from Registrations instead.`
    );
  }

  const orderId = generateOrderId();

  let registration;
  try {
    registration = await Registration.create({
      fullName: String(fullName).trim(),
      mobileNumber: mobile,
      schoolOrCollege: String(schoolOrCollege).trim(),
      preparingFor: preparingFor || undefined,
      guestCount: n,
      orderId,
      amount: 0,
      paymentStatus: PAYMENT_STATUS.FREE,
      registrationNumber: await nextRegistrationNumber(),
      confirmedAt: new Date(),
      source: 'admin_walk_in',
      checkedInAt: new Date(),
      checkedInBy: req.admin.username,
    });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.mobileNumber) {
      res.status(409);
      throw new Error('This mobile number is already registered.');
    }
    throw err;
  }

  // Send the confirmation + QR via WhatsApp. Fire-and-forget so the response
  // is never delayed by Meta; never throws. No email on file for a walk-in.
  sendConfirmationWhatsApp(registration).catch((err) =>
    console.error(`[whatsapp] walk-in send error: ${err?.message || err}`)
  );

  return res.status(201).json({
    success: true,
    result: 'checked_in',
    message: 'Registered and checked in successfully. Admit the student.',
    data: checkinView(registration),
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
