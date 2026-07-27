import Counter from '../models/Counter.js';

// Own counter key so CareerX numbering starts fresh at 1, independent of the
// old NEET CON 2026 sequence (which used the bare "registrationNumber" key).
const COUNTER_KEY = 'registrationNumber_careerx';

/**
 * Format a sequence number (1-based) into the public registration code.
 *   1   -> "CAREERX 001"
 *   10  -> "CAREERX 010"
 *   100 -> "CAREERX 100"
 * Numbers above 999 keep their natural width (e.g. "CAREERX 1000").
 *
 * @param {number} seq  1-based counter value
 * @returns {string}
 */
export const formatRegistrationNumber = (seq) => `CAREERX ${String(seq).padStart(3, '0')}`;

/**
 * Atomically allocate the next sequential registration code. There is no
 * fixed seat cap — registrations stay open — so this always returns a code.
 *
 * @returns {Promise<string>}
 */
export const nextRegistrationNumber = async () => {
  const seq = await Counter.next(COUNTER_KEY);
  return formatRegistrationNumber(seq);
};
