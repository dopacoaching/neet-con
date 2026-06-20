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
};

export default connectDB;
