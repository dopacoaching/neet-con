import Admin from '../models/Admin.js';
import Registration, { PAYMENT_STATUS, DOPA_STATUS, CURRENT_EVENT } from '../models/Registration.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { syncToGoogleSheet } from '../utils/googleSheets.js';
import { nextRegistrationNumber } from '../utils/registrationNumber.js';
import { sendConfirmationWhatsApp } from '../utils/whatsapp.js';
import { sendUserConfirmationEmail } from '../utils/email.js';
import {
  signAdminToken,
  adminCookieOptions,
  ADMIN_COOKIE,
  findEnvAdmin,
} from '../middleware/authMiddleware.js';

// Every query in this file is scoped to the current event (`event: CURRENT_EVENT`)
// so the admin dashboard only ever shows CareerX registrations, even though the
// same DB/collection still holds older NEET CON 2026 documents.

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
 * Query: page, limit, status, dopaStatus, search, guestInfo
 *   guestInfo=needsReview -> replied to the guest-count ask but couldn't be
 *     parsed (guestCountReplyRaw set) — needs a human to read + set manually.
 *   guestInfo=notAnswered -> guestCount was never asked/answered at all.
 */
export const listRegistrations = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const { status, dopaStatus, search, guestInfo, whatsappStatus } = req.query;

  const filter = { event: CURRENT_EVENT };
  if (status && Object.values(PAYMENT_STATUS).includes(status)) filter.paymentStatus = status;
  if (dopaStatus && Object.values(DOPA_STATUS).includes(dopaStatus)) filter.dopaStatus = dopaStatus;
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
  const registration = await Registration.findOne({ _id: req.params.id, event: CURRENT_EVENT }).lean();
  if (!registration) {
    res.status(404);
    throw new Error('Registration not found');
  }
  res.json({ success: true, data: registration });
});

/**
 * PATCH /api/admin/registrations/:id/status
 * Manually update status (MANUAL / FREE / FAILED / PENDING) and/or notes.
 * Requires admin role.
 */
export const updateRegistrationStatus = asyncHandler(async (req, res) => {
  const { status, notes, guestCount } = req.body || {};
  const registration = await Registration.findOne({ _id: req.params.id, event: CURRENT_EVENT });
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
      // Duplicate guard: don't seat a mobile that already holds a CareerX seat.
      const dupe = await Registration.findOne({
        _id: { $ne: registration._id },
        event: CURRENT_EVENT,
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

    try {
      await registration.save();
    } catch (err) {
      // DB-level backstop catching the rare race where two admins pass the
      // pre-check above for the same mobile at once.
      if (err?.code === 11000 && err?.keyPattern?.mobileNumber) {
        res.status(409);
        throw new Error('This mobile number was just confirmed by another admin — refresh and check.');
      }
      throw err;
    }

    // On a manual confirmation, send the confirmation via WhatsApp and (if
    // the registrant gave an email) by email. Fire-and-forget so the admin
    // response isn't delayed.
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
 * Re-send the confirmation to a registrant who never got it (or whose
 * send failed). Only makes sense for a seat-holding registration. Requires
 * admin role. Awaited (not fire-and-forget) so the admin gets a real result.
 */
export const resendWhatsApp = asyncHandler(async (req, res) => {
  const registration = await Registration.findOne({ _id: req.params.id, event: CURRENT_EVENT });
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
  const [counts, dopaCounts, joined, guestAgg] = await Promise.all([
    Registration.aggregate([
      { $match: { event: CURRENT_EVENT } },
      { $group: { _id: '$paymentStatus', count: { $sum: 1 } } },
    ]),
    // DOPA vs Non-DOPA — only seats that actually hold (manual/free), same
    // scoping as the guest-count aggregation below.
    Registration.aggregate([
      {
        $match: {
          event: CURRENT_EVENT,
          paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
        },
      },
      { $group: { _id: '$dopaStatus', count: { $sum: 1 } } },
    ]),
    Registration.countDocuments({ event: CURRENT_EVENT, joinedAt: { $ne: null } }),
    // Only count guests for seats that actually hold (manual/free) — a
    // PENDING/FAILED attempt's guest count isn't a real headcount yet.
    Registration.aggregate([
      {
        $match: {
          event: CURRENT_EVENT,
          paymentStatus: { $in: Registration.SEAT_HOLDING_STATUSES },
        },
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$guestCount', 0] } } } },
    ]),
  ]);

  const byStatus = counts.reduce((acc, c) => {
    acc[c._id] = c.count;
    return acc;
  }, {});
  const byDopaStatus = dopaCounts.reduce((acc, c) => {
    acc[c._id] = c.count;
    return acc;
  }, {});

  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const totalGuests = guestAgg[0]?.total || 0;
  const confirmedTotal = (byStatus[PAYMENT_STATUS.MANUAL] || 0) + (byStatus[PAYMENT_STATUS.FREE] || 0);

  res.json({
    success: true,
    data: {
      total,
      manual: byStatus[PAYMENT_STATUS.MANUAL] || 0,
      free: byStatus[PAYMENT_STATUS.FREE] || 0,
      dopa: byDopaStatus[DOPA_STATUS.DOPA] || 0,
      nonDopa: byDopaStatus[DOPA_STATUS.NON_DOPA] || 0,
      joined,
      totalGuests,
      expectedHeadcount: confirmedTotal + totalGuests,
    },
  });
});

/**
 * The subset of a registration shown in the joined-list / joined-toggle response.
 */
const joinedView = (r) => ({
  id: r._id,
  registrationNumber: r.registrationNumber,
  fullName: r.fullName,
  mobileNumber: r.mobileNumber,
  dopaStatus: r.dopaStatus,
  schoolOrCollege: r.schoolOrCollege,
  batch: r.batch,
  neetScore: r.neetScore,
  paymentStatus: r.paymentStatus,
  joinedAt: r.joinedAt,
  joinedBy: r.joinedBy,
  guestCount: r.guestCount,
});

/**
 * GET /api/admin/joined
 * The list of everyone marked as having joined the WhatsApp group (most
 * recent first) + a count. Available to any authenticated admin.
 */
export const listJoined = asyncHandler(async (req, res) => {
  const items = await Registration.find({ event: CURRENT_EVENT, joinedAt: { $ne: null } })
    .sort({ joinedAt: -1 })
    .select(
      'registrationNumber fullName mobileNumber dopaStatus schoolOrCollege batch neetScore joinedAt joinedBy guestCount'
    )
    .lean();
  res.json({ success: true, data: { count: items.length, items } });
});

/**
 * POST /api/admin/sync-sheet
 * Push the current CareerX registrations + WhatsApp-group joins into a live
 * Google Sheet (two tabs), fully overwriting each tab so re-running never
 * duplicates rows. Admin role only.
 */
export const syncGoogleSheet = asyncHandler(async (req, res) => {
  const [registrations, joined] = await Promise.all([
    Registration.find({ event: CURRENT_EVENT }).sort({ createdAt: 1 }).lean(),
    Registration.find({ event: CURRENT_EVENT, joinedAt: { $ne: null } })
      .sort({ joinedAt: 1 })
      .lean(),
  ]);

  const { sheetUrl } = await syncToGoogleSheet(registrations, joined);
  res.json({ success: true, data: { sheetUrl } });
});

/**
 * PATCH /api/admin/registrations/:id/joined
 * Body: { joined: boolean } — manually mark (or unmark) a registrant as
 * having joined the event's WhatsApp group. There's no automated way to
 * detect this via the WhatsApp Cloud API, so it's a plain admin toggle
 * (replaces the old physical-gate QR check-in). Any authenticated admin.
 */
export const setJoined = asyncHandler(async (req, res) => {
  const joined = !!req.body?.joined;
  const registration = await Registration.findOne({ _id: req.params.id, event: CURRENT_EVENT });
  if (!registration) {
    res.status(404);
    throw new Error('Registration not found');
  }

  registration.joinedAt = joined ? new Date() : null;
  registration.joinedBy = joined ? req.admin.username : '';
  await registration.save();

  res.json({ success: true, data: joinedView(registration) });
});

/**
 * PATCH /api/admin/registrations/:id/guest-count
 * Set the guest count manually (an admin override for when the WhatsApp
 * follow-up reply never came, or couldn't be parsed as a number). Any
 * authenticated admin — it doesn't touch seat/payment status.
 */
export const setGuestCount = asyncHandler(async (req, res) => {
  const n = Math.trunc(Number(req.body?.guestCount));
  if (!Number.isFinite(n) || n < 0 || n > 20) {
    res.status(400);
    throw new Error('Guest count must be a number between 0 and 20');
  }

  const existing = await Registration.findOne({ _id: req.params.id, event: CURRENT_EVENT });
  if (!existing) {
    res.status(404);
    throw new Error('Registration not found');
  }
  if (!Registration.SEAT_HOLDING_STATUSES.includes(existing.paymentStatus)) {
    res.status(409);
    throw new Error('This registration does not hold a confirmed seat.');
  }

  existing.guestCount = n;
  existing.guestCountReplyRaw = '';
  await existing.save();

  res.json({ success: true, data: joinedView(existing) });
});
