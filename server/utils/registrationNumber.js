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
 * Atomically allocate the next sequential registration code, enforcing the
 * seat capacity at the same time. The registration-number counter doubles as
 * the authoritative seat gate: exactly `capacity` codes can ever be issued, so
 * concurrent confirmations can never oversell.
 *
 * @param {number} capacity  max number of codes that may be issued (seat cap)
 * @returns {Promise<string|null>}  the code, or null when capacity is reached
 */
export const nextRegistrationNumber = async (capacity) => {
  const max = Number(capacity);
  const seq = Number.isFinite(max)
    ? await Counter.nextCapped('registrationNumber', max)
    : await Counter.next('registrationNumber');
  if (seq == null) return null;
  return formatRegistrationNumber(seq);
};
