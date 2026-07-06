import crypto from 'crypto';

/**
 * Generate a unique, unguessable order id per payment attempt.
 * Format: NC<16 hex chars (64 bits of CSPRNG entropy)> — 18 chars total.
 *
 * The random suffix must be unguessable because the public entry-pass and
 * payment-status endpoints are gated only by the order id — a predictable id
 * would let someone enumerate other registrants' details.
 *
 * Kept short deliberately: HDFC SmartGateway builds its UPI transaction
 * reference by prefixing our order id with the merchant id and a suffix
 * (e.g. `43304-<orderId>-1`), and NPCI enforces a hard 35-character limit on
 * that field. The previous DOPA-<timestamp>-<hex> format was already 35
 * chars on its own, so every UPI payment was silently declined with
 * `OrderNo_Length_Validation_Failure`.
 * @returns {string}
 */
const generateOrderId = () => {
  const rand = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `NC${rand}`;
};

export default generateOrderId;
