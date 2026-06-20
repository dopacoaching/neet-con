import Counter from '../models/Counter.js';

/**
 * Format a sequence number into the public registration code.
 *   1   -> "NEET CON 001"
 *   10  -> "NEET CON 010"
 *   100 -> "NEET CON 100"
 *   600 -> "NEET CON 600"
 * Numbers above 999 keep their natural width (e.g. "NEET CON 1000").
 *
 * @param {number} seq
 * @returns {string}
 */
export const formatRegistrationNumber = (seq) => `NEET CON ${String(seq).padStart(3, '0')}`;

/**
 * Atomically allocate the next sequential registration code.
 * @returns {Promise<string>}
 */
export const nextRegistrationNumber = async () => {
  const seq = await Counter.next('registrationNumber');
  return formatRegistrationNumber(seq);
};
