import mongoose from 'mongoose';

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  MANUAL: 'MANUAL',
  FREE: 'FREE', // DOPA students — no payment required (via Google Form)
});

export const PREPARING_FOR = Object.freeze({
  NEET_2027: 'NEET 2027',
  NEET_2028: 'NEET 2028',
});

/**
 * Registration model.
 *
 * Schema is intentionally permissive about future fields: v1.1 will add more
 * form fields. New optional fields can be appended here without breaking
 * existing documents, so avoid making newly added fields `required`.
 */
const registrationSchema = new mongoose.Schema(
  {
    // Generated only once payment is CONFIRMED ("NEET CON 001" style).
    registrationNumber: {
      type: String,
      unique: true,
      sparse: true, // allows many docs without a registrationNumber (PENDING)
      index: true,
    },

    // --- Form fields (v1.0) ---
    fullName: { type: String, required: true, trim: true },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Mobile number must be a valid 10-digit Indian number'],
      index: true,
    },
    // Optional — confirmation + QR are delivered via WhatsApp (to mobileNumber).
    // Kept for records; validated only when provided.
    emailAddress: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      default: '',
    },
    // Required for the paid online flow (enforced in its controller); optional
    // for free/Google-Form entries, which don't collect it.
    schoolOrCollege: { type: String, trim: true },
    passedYear: { type: String, trim: true }, // 2005–2028 (dropdown)
    preparingFor: {
      type: String,
      enum: Object.values(PREPARING_FOR),
      required: false,
    },
    // How many family/friends the registrant is bringing along (for headcount/
    // logistics planning — they are not seated as separate registrations).
    // Applies to both the paid online flow and the free Google-Form (DOPA) flow.
    // Left unset (no default) on purpose: pre-feature registrations never had
    // this asked, so `{ $exists: false }` distinguishes "never asked" from a
    // genuine "0 guests" answer.
    guestCount: { type: Number, min: 0, max: 20 },
    // Set when the one-off "how many guests?" WhatsApp follow-up was sent, so
    // the webhook knows an inbound reply from this mobile is answering that
    // specific question (and so the send script doesn't ask twice).
    guestCountAskedAt: { type: Date, default: null },
    // If a reply to that follow-up couldn't be parsed as a number (e.g. "hey
    // who's this" or a voice note), the raw text is stashed here so an admin
    // can read it and set guestCount manually instead of it silently vanishing.
    guestCountReplyRaw: { type: String, default: '' },
    guestCountReplyAt: { type: Date, default: null },

    // --- Free / Google-Form (DOPA student) fields ---
    source: { type: String, default: 'online', index: true }, // 'online' | 'google_form'
    district: { type: String, trim: true, default: '' },
    currentStatus: { type: String, trim: true, default: '' }, // Plus Two / Repeater / Re-Repeater / Others
    expectedScore: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },

    // --- Payment fields ---
    orderId: { type: String, required: true, unique: true, index: true },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    amount: { type: Number, default: () => Number(process.env.REGISTRATION_FEE || 100) },
    hdfc_txn_id: { type: String, default: '' },
    hdfc_response: { type: mongoose.Schema.Types.Mixed, default: null }, // raw payload (audit)
    paymentAttempts: { type: Number, default: 0 },
    // Transient: held only while a callback/webhook/status-poll is actively
    // finalising this order, so the three racing confirmation paths can't
    // both process the same order at once. Always released back to false;
    // processingLockAt lets a stale lock (crash mid-request) expire instead
    // of stranding the order unconfirmable forever.
    processingLock: { type: Boolean, default: false },
    processingLockAt: { type: Date, default: null },

    // --- Meta ---
    confirmedAt: { type: Date, default: null },
    manuallyConfirmedBy: { type: String, default: '' }, // admin username if MANUAL
    notes: { type: String, default: '' }, // admin internal notes

    // --- Event check-in (QR scan at the gate) ---
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: String, default: '' }, // admin username who scanned

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
registrationSchema.statics.SEAT_HOLDING_STATUSES = [
  PAYMENT_STATUS.CONFIRMED,
  PAYMENT_STATUS.MANUAL,
  PAYMENT_STATUS.FREE,
];

// DB-level backstop against two concurrent requests for the same mobile
// number both passing the app-level dupe check (see createRegistration).
// Scoped to FREE — the only status the live (payment-free) flow ever
// creates — since partial indexes can't express an $in over all
// seat-holding statuses.
registrationSchema.index(
  { mobileNumber: 1 },
  {
    name: 'mobileNumber_free_unique',
    unique: true,
    partialFilterExpression: { paymentStatus: PAYMENT_STATUS.FREE },
  }
);

const Registration = mongoose.model('Registration', registrationSchema);
export default Registration;
