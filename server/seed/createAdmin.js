/**
 * Seed default admin users.
 *
 * Usage:
 *   cd server
 *   node seed/createAdmin.js
 *
 * Existing users (matched by username) are left untouched unless you pass
 * --reset, which re-hashes their password to the default below.
 *
 * SECURITY: change these passwords immediately after first login.
 */
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';

// Load server/.env regardless of cwd (this file lives in server/seed/).
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

import connectDB from '../config/db.js';
import Admin from '../models/Admin.js';

const defaultAdmins = [
  { username: 'bilal', password: 'changeme123', role: 'admin' },
  { username: 'nihad', password: 'changeme123', role: 'admin' },
  { username: 'ashik', password: 'changeme123', role: 'viewer' },
];

const reset = process.argv.includes('--reset');

const run = async () => {
  await connectDB();

  for (const def of defaultAdmins) {
    const username = def.username.toLowerCase();
    let admin = await Admin.findOne({ username });

    if (admin && !reset) {
      console.log(`[seed] '${username}' already exists — skipping (use --reset to overwrite).`);
      continue;
    }

    if (!admin) {
      admin = new Admin({ username, role: def.role });
      console.log(`[seed] creating '${username}' (${def.role})`);
    } else {
      admin.role = def.role;
      console.log(`[seed] resetting '${username}' (${def.role})`);
    }

    await admin.setPassword(def.password);
    await admin.save();
  }

  console.log('\n[seed] Done. Default password for all seeded users: "changeme123"');
  console.log('[seed] >>> Change these passwords after first login. <<<');

  await mongoose.connection.close();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[seed] Failed:', err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
