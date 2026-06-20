import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import { ADMIN_ROLES } from '../models/Admin.js';
import { asyncHandler } from './errorHandler.js';

export const ADMIN_COOKIE = 'neetcon_admin_token';

/* ------------------------------------------------------------------ */
/* Env-defined admins (ADMIN_CREDENTIALS="email:password,email:pass")  */
/* ------------------------------------------------------------------ */

/**
 * Parse ADMIN_CREDENTIALS into a list of { username, password, role:'admin' }.
 * Format: `email:password` pairs, separated by comma or newline.
 * These are bootstrap superadmins that work without seeding the database.
 */
const parseEnvAdmins = () =>
  (process.env.ADMIN_CREDENTIALS || '')
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(':');
      if (idx === -1) return null;
      return {
        username: pair.slice(0, idx).trim().toLowerCase(),
        password: pair.slice(idx + 1), // keep verbatim (may contain symbols)
        role: ADMIN_ROLES.ADMIN,
      };
    })
    .filter(Boolean);

const safeEqual = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
};

// A synthetic admin object that mirrors the Mongoose admin's used surface.
const makeEnvAdmin = (username, role = ADMIN_ROLES.ADMIN) => ({
  _id: `env:${username}`,
  username,
  role,
  isEnvAdmin: true,
  toSafeJSON() {
    return { id: this._id, username: this.username, role: this.role, env: true };
  },
});

/** Return a synthetic admin if username+password match an env credential. */
export const findEnvAdmin = (username, password) => {
  const u = String(username || '').trim().toLowerCase();
  const match = parseEnvAdmins().find((a) => a.username === u);
  if (!match || !safeEqual(match.password, password)) return null;
  return makeEnvAdmin(match.username, match.role);
};

/** Does an env credential still exist for this username? (token revocation) */
export const envAdminExists = (username) => {
  const u = String(username || '').trim().toLowerCase();
  return parseEnvAdmins().some((a) => a.username === u);
};

/* ------------------------------------------------------------------ */
/* JWT + cookie                                                        */
/* ------------------------------------------------------------------ */

/**
 * Sign a JWT for an admin (DB-backed or env-defined).
 * @param {object} admin Mongoose admin doc or synthetic env admin
 * @returns {string}
 */
export const signAdminToken = (admin) => {
  const isEnv = admin.isEnvAdmin || String(admin._id).startsWith('env:');
  return jwt.sign(
    { id: String(admin._id), role: admin.role, env: isEnv || undefined },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Cookie options for the admin JWT (httpOnly).
 *
 * In production the client (Vercel) and API (Render) live on different domains,
 * so the auth cookie must be `SameSite=None; Secure` to be sent on cross-site
 * XHR. (`None` requires `Secure`, which both hosts serve over HTTPS.)
 */
export const adminCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
};

/**
 * Protect routes: require a valid admin JWT from the httpOnly cookie.
 * Populates req.admin (DB doc or synthetic env admin).
 */
export const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[ADMIN_COOKIE];
  if (!token) {
    res.status(401);
    throw new Error('Not authenticated');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401);
    throw new Error('Session expired or invalid. Please log in again.');
  }

  // Env-defined admin: rebuild from the token (no DB row).
  if (decoded.env || String(decoded.id).startsWith('env:')) {
    const username = String(decoded.id).replace(/^env:/, '');
    if (!envAdminExists(username)) {
      res.status(401);
      throw new Error('Account no longer exists');
    }
    req.admin = makeEnvAdmin(username, decoded.role || ADMIN_ROLES.ADMIN);
    return next();
  }

  const admin = await Admin.findById(decoded.id);
  if (!admin) {
    res.status(401);
    throw new Error('Account no longer exists');
  }

  req.admin = admin;
  next();
});

/**
 * Require the "admin" role (not "viewer"). Use after `protect`.
 */
export const requireAdminRole = (req, res, next) => {
  if (!req.admin || req.admin.role !== ADMIN_ROLES.ADMIN) {
    res.status(403);
    return next(new Error('This action requires admin privileges'));
  }
  next();
};
