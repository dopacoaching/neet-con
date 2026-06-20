import mongoose from 'mongoose';

export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  MANUAL: 'MANUAL',
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
    emailAddress: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'A valid email address is required'],
    },
    schoolOrCollege: { type: String, required: true, trim: true },
    passedYear: { type: String, trim: true }, // 2005–2028 (dropdown)
    preparingFor: {
      type: String,
      enum: Object.values(PREPARING_FOR),
      required: true,
    },

    // --- Payment fields ---
    orderId: { type: String, required: true, unique: true, index: true },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    amount: { type: Number, default: () => Number(process.env.REGISTRATION_FEE || 200) },
    hdfc_txn_id: { type: String, default: '' },
    hdfc_response: { type: mongoose.Schema.Types.Mixed, default: null }, // raw payload (audit)
    paymentAttempts: { type: Number, default: 0 },

    // --- Meta ---
    confirmedAt: { type: Date, default: null },
    manuallyConfirmedBy: { type: String, default: '' }, // admin username if MANUAL
    notes: { type: String, default: '' }, // admin internal notes
  },
  { timestamps: true } // adds createdAt + updatedAt
);

// Helper to know if a registration is "occupying a seat".
registrationSchema.statics.SEAT_HOLDING_STATUSES = [
  PAYMENT_STATUS.CONFIRMED,
  PAYMENT_STATUS.MANUAL,
];

const Registration = mongoose.model('Registration', registrationSchema);
export default Registration;
