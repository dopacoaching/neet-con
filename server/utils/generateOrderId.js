import crypto from 'crypto';

/**
 * Generate a unique, unguessable order id per payment attempt.
 * Format: DOPA-<timestamp>-<16 hex chars (64 bits of CSPRNG entropy)>
 *
 * The random suffix must be unguessable because the public entry-pass and
 * payment-status endpoints are gated only by the order id — a predictable id
 * would let someone enumerate other registrants' details.
 * @returns {string}
 */
const generateOrderId = () => {
  const ts = Date.now();
  const rand = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `DOPA-${ts}-${rand}`;
};

export default generateOrderId;
