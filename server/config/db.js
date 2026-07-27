import mongoose from 'mongoose';

/**
 * Connect to MongoDB using MONGO_URI from environment.
 * Exits the process on initial connection failure so the app does not
 * run in a broken state.
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[db] MONGO_URI is not set. Check your .env file.');
    process.exit(1);
  }

  mongoose.set('strictQuery', true);

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error(`[db] MongoDB connection error: ${err.message}`);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected');
  });
  mongoose.connection.on('error', (err) => {
    console.error(`[db] MongoDB error: ${err.message}`);
  });

  // One-time cleanup: the pre-CareerX schema had a GLOBAL unique index on
  // mobileNumber (not scoped per event), which would wrongly block a NEET CON
  // 2026 attendee from registering for CareerX with the same number. The
  // model now defines compound { mobileNumber, event } indexes instead — drop
  // the old ones if still present (index-only change, no data is touched).
  try {
    const coll = mongoose.connection.collection('registrations');
    const existing = await coll.indexes();
    const stale = ['mobileNumber_free_unique', 'mobileNumber_manual_unique'];
    for (const name of stale) {
      if (existing.some((i) => i.name === name)) {
        await coll.dropIndex(name);
        console.log(`[db] dropped stale index ${name}`);
      }
    }
  } catch (err) {
    console.warn(`[db] stale index cleanup skipped: ${err.message}`);
  }
};

export default connectDB;
