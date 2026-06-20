import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ADMIN_ROLES = Object.freeze({
  ADMIN: 'admin',
  VIEWER: 'viewer',
});

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(ADMIN_ROLES),
      default: ADMIN_ROLES.VIEWER,
    },
  },
  { timestamps: true }
);

/**
 * Hash and set the password.
 * @param {string} plain
 */
adminSchema.methods.setPassword = async function setPassword(plain) {
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

/**
 * Compare a candidate password against the stored hash.
 * @param {string} candidate
 * @returns {Promise<boolean>}
 */
adminSchema.methods.verifyPassword = function verifyPassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

// Never leak the hash in JSON responses.
adminSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    username: this.username,
    role: this.role,
    createdAt: this.createdAt,
  };
};

const Admin = mongoose.model('Admin', adminSchema);
export default Admin;
