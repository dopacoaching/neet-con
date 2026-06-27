import Counter from '../models/Counter.js';

// Registration codes start at this number, so the first confirmed seat is
// "NEET CON 1000", the next "NEET CON 1001", and so on.
const REG_NUMBER_START = 1000;

/**
 * Format a sequence number (1-based) into the public registration code.
 *   1 -> "NEET CON 1000"
 *   2 -> "NEET CON 1001"
 *  51 -> "NEET CON 1050"
 *
 * @param {number} seq  1-based counter value
 * @returns {string}
 */
export const formatRegistrationNumber = (seq) => `NEET CON ${REG_NUMBER_START + seq - 1}`;

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
