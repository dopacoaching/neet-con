import mongoose from 'mongoose';

/**
 * Atomic sequence counter. Used to generate sequential registration numbers
 * ("NEET CON 001", "NEET CON 002", ...) without race conditions when multiple
 * payments confirm at the same time.
 */
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "registrationNumber"
  seq: { type: Number, default: 0 },
});

/**
 * Atomically increment and return the next sequence value for a given key.
 * @param {string} key
 * @returns {Promise<number>}
 */
counterSchema.statics.next = async function next(key) {
  const doc = await this.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
};

/**
 * Atomically increment and return the next sequence value ONLY if it stays
 * below `max`. Returns null when the counter has already reached `max` (i.e.
 * capacity is full). This is a single-document atomic op, so it is race-safe:
 * if N confirmations race for the last seat, exactly one succeeds.
 *
 * @param {string} key
 * @param {number} max  exclusive upper bound (e.g. seat capacity)
 * @returns {Promise<number|null>}
 */
counterSchema.statics.nextCapped = async function nextCapped(key, max) {
  try {
    const doc = await this.findOneAndUpdate(
      { _id: key, seq: { $lt: max } },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    return doc ? doc.seq : null;
  } catch (err) {
    // Upsert raced against an existing at-capacity doc (filter didn't match,
    // so Mongo tried to insert a duplicate _id) -> treat as "full".
    if (err && err.code === 11000) return null;
    throw err;
  }
};

const Counter = mongoose.model('Counter', counterSchema);
export default Counter;
