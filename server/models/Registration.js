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

    // --- Free / Google-Form (DOPA student) fields ---
    source: { type: String, default: 'online', index: true }, // 'online' | 'google_form'
    district: { type: String, trim: true, default: '' },
    currentStatus: { type: String, trim: true, default: '' }, // Plus Two / Repeater / Re-Repeater / Others
    neetScore: { type: String, trim: true, default: '' },
    dopaStudent: { type: String, trim: true, default: '' },
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

    // --- Meta ---
    confirmedAt: { type: Date, default: null },
    manuallyConfirmedBy: { type: String, default: '' }, // admin username if MANUAL
    notes: { type: String, default: '' }, // admin internal notes

    // --- Event check-in (QR scan at the gate) ---
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: String, default: '' }, // admin username who scanned
  },
  { timestamps: true } // adds createdAt + updatedAt
);

// Helper to know if a registration is "occupying a seat".
registrationSchema.statics.SEAT_HOLDING_STATUSES = [
  PAYMENT_STATUS.CONFIRMED,
  PAYMENT_STATUS.MANUAL,
  PAYMENT_STATUS.FREE,
];

const Registration = mongoose.model('Registration', registrationSchema);
export default Registration;
