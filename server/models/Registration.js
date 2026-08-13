import mongoose from 'mongoose';

// This collection is shared across events — older NEET CON 2026 documents
// stay in the DB for the record, untouched. Every registration created from
// now on is tagged with `event` so all queries/admin views can scope to just
// the current event instead of ever reading/showing the old event's data.
export const CURRENT_EVENT = 'careerx';

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  FAILED: 'FAILED',
  MANUAL: 'MANUAL', // admin-added / walk-in
  FREE: 'FREE', // the normal free-registration path
});

// Is the registrant a DOPA student or from elsewhere? Drives which extra
// fields the form asks for (DOPA -> campus + batch; Non-DOPA -> institution).
export const DOPA_STATUS = Object.freeze({
  DOPA: 'DOPA',
  NON_DOPA: 'Non-DOPA',
});

/**
 * Registration model.
 *
 * Schema is intentionally permissive about future fields: new optional fields
 * can be appended here without breaking existing documents, so avoid making
 * newly added fields `required`.
 */
const registrationSchema = new mongoose.Schema(
  {
    // Which event this registration belongs to. Always CURRENT_EVENT for new
    // documents; older NEET CON 2026 documents predate this field and simply
    // won't match `{ event: CURRENT_EVENT }` queries.
    event: { type: String, default: CURRENT_EVENT, index: true },

    // Sequential per-event code ("CAREERX 001", ...), assigned once confirmed.
    registrationNumber: {
      type: String,
      unique: true,
      sparse: true, // allows many docs without a registrationNumber
      index: true,
    },

    // --- Form fields ---
    fullName: { type: String, required: true, trim: true },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Mobile number must be a valid 10-digit Indian number'],
      index: true,
    },
    // Optional — the confirmation is delivered via WhatsApp (to mobileNumber).
    emailAddress: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      default: '',
    },
    // DOPA or Non-DOPA (see DOPA_STATUS above).
    dopaStatus: {
      type: String,
      enum: Object.values(DOPA_STATUS),
      required: false,
    },
    // DOPA campus name (if dopaStatus === 'DOPA') OR the non-DOPA institution
    // name (if dopaStatus === 'Non-DOPA'). One field, meaning depends on
    // dopaStatus — kept as `schoolOrCollege` for continuity with the existing
    // admin search/display wiring.
    schoolOrCollege: { type: String, trim: true },
    // Batch — only collected/meaningful when dopaStatus === 'DOPA'.
    batch: { type: String, trim: true, default: '' },
    // NEET 2026 score, as self-reported (free text — some enter "not appeared").
    neetScore: { type: String, trim: true, default: '' },
    passedYear: { type: String, trim: true }, // 12th pass-out year (dropdown)
    // How many family/friends the registrant is bringing along (for headcount/
    // logistics planning — they are not seated as separate registrations).
    // Left unset (no default) on purpose: `{ $exists: false }` distinguishes
    // "never asked" from a genuine "0 guests" answer.
    guestCount: { type: Number, min: 0, max: 20 },
    // Set when the one-off "how many guests?" WhatsApp follow-up was sent, so
    // the webhook knows an inbound reply from this mobile is answering that
    // specific question (and so the send script doesn't ask twice).
    guestCountAskedAt: { type: Date, default: null },
    // Set when the day-before event reminder was sent, so the send script is
    // safe to re-run without double-sending.
    reminderSentAt: { type: Date, default: null },
    // Set when the one-off CareerX invite (to old NEET CON 2026 registrants)
    // was sent, so server/scripts/sendNeetconInvite.js is safe to re-run.
    neetconInviteSentAt: { type: Date, default: null },
    // Set when the "event moved to online mode" one-off update was sent to an
    // already-confirmed CareerX registrant, so sendModeUpdate.js is safe to re-run.
    modeUpdateSentAt: { type: Date, default: null },
    // Set when the venue-correction follow-up (fixing the "Bhatia Hall" text in
    // the original NEET CON invite) was sent, so sendNeetconCorrection.js is
    // safe to re-run.
    neetconCorrectionSentAt: { type: Date, default: null },
    // Set when the "rescheduled to evening" one-off update (2026-08-13) was
    // sent, so sendReschedule.js is safe to re-run.
    rescheduleSentAt: { type: Date, default: null },
    // Set when the "meeting starts in 15 minutes" one-off reminder
    // (2026-08-13, 7:15 PM IST) was sent, so sendMeetingStarting.js is safe
    // to re-run.
    meetingStartingSentAt: { type: Date, default: null },
    // If a reply to that follow-up couldn't be parsed as a number (e.g. "hey
    // who's this" or a voice note), the raw text is stashed here so an admin
    // can read it and set guestCount manually instead of it silently vanishing.
    guestCountReplyRaw: { type: String, default: '' },
    guestCountReplyAt: { type: Date, default: null },

    // 'online' (self-registered on the site) | 'admin_walk_in' (added at the gate).
    source: { type: String, default: 'online', index: true },

    // Free-form notes carried over from the old NEET-CON Google-Form path.
    // Unused by the current CareerX flow but kept so old documents still read
    // correctly if ever inspected.
    district: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },

    // Reference id for this registration (was "orderId" back when this field
    // doubled as a payment-gateway order reference; kept for continuity with
    // the pass/lookup endpoints, which are keyed on it).
    orderId: { type: String, required: true, unique: true, index: true },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.FREE,
      index: true,
    },

    // --- Meta ---
    confirmedAt: { type: Date, default: null },
    manuallyConfirmedBy: { type: String, default: '' }, // admin username if MANUAL
    notes: { type: String, default: '' }, // admin internal notes

    // --- Joined the online event's WhatsApp group ---
    // Set manually by an admin (no automated way to detect a WhatsApp group
    // join via the Cloud API) — replaces the old physical-gate check-in.
    joinedAt: { type: Date, default: null },
    joinedBy: { type: String, default: '' }, // admin username who marked it

    // --- WhatsApp confirmation delivery (set by sendConfirmationWhatsApp) ---
    // Lets admins see and resend to anyone whose confirmation never went out,
    // instead of it only ever being logged to the server console.
    whatsappStatus: {
      type: String,
      enum: ['sent', 'failed', 'skipped', 'unknown'],
      default: 'unknown',
    },
    whatsappMessageId: { type: String, default: '' },
    whatsappError: { type: String, default: '' },
    whatsappSentAt: { type: Date, default: null },
  },
  { timestamps: true } // adds createdAt + updatedAt
);

// Helper to know if a registration is "occupying a seat".
registrationSchema.statics.SEAT_HOLDING_STATUSES = [PAYMENT_STATUS.MANUAL, PAYMENT_STATUS.FREE];

// DB-level backstop against two concurrent requests for the same mobile
// number, for the same event, both passing the app-level dupe check (see
// createRegistration). Scoped per-event so the same person can hold a seat at
// both NEET CON 2026 and CareerX without tripping the other event's index.
registrationSchema.index(
  { mobileNumber: 1, event: 1 },
  {
    name: 'mobileNumber_event_free_unique',
    unique: true,
    partialFilterExpression: { paymentStatus: PAYMENT_STATUS.FREE },
  }
);

// Same backstop for admin manual-confirm / walk-ins.
registrationSchema.index(
  { mobileNumber: 1, event: 1 },
  {
    name: 'mobileNumber_event_manual_unique',
    unique: true,
    partialFilterExpression: { paymentStatus: PAYMENT_STATUS.MANUAL },
  }
);

const Registration = mongoose.model('Registration', registrationSchema);
export default Registration;
