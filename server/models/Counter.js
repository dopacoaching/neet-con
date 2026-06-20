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

const Counter = mongoose.model('Counter', counterSchema);
export default Counter;
