import crypto from 'crypto';

/**
 * Generate a unique, unguessable reference id for a registration.
 * Format: CX<16 hex chars (64 bits of CSPRNG entropy)> — 18 chars total.
 *
 * The random suffix must be unguessable because the public entry-pass
 * endpoint is gated only by this id — a predictable id would let someone
 * enumerate other registrants' details.
 * @returns {string}
 */
const generateOrderId = () => {
  const rand = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `CX${rand}`;
};

export default generateOrderId;
