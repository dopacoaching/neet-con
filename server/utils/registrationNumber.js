import Counter from '../models/Counter.js';

/**
 * Format a sequence number (1-based) into the public registration code.
 *   1   -> "NEET CON 001"
 *   10  -> "NEET CON 010"
 *   100 -> "NEET CON 100"
 * Numbers above 999 keep their natural width (e.g. "NEET CON 1000").
 *
 * @param {number} seq  1-based counter value
 * @returns {string}
 */
export const formatRegistrationNumber = (seq) => `NEET CON ${String(seq).padStart(3, '0')}`;

/**
 * Atomically allocate the next sequential registration code. There is no fixed
 * seat cap — registrations stay open — so this always returns a code.
 *
 * @returns {Promise<string>}
 */
export const nextRegistrationNumber = async () => {
  const seq = await Counter.next('registrationNumber');
  return formatRegistrationNumber(seq);
};
