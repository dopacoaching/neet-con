import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import { ADMIN_ROLES } from '../models/Admin.js';
import { asyncHandler } from './errorHandler.js';

export const ADMIN_COOKIE = 'neetcon_admin_token';

/**
 * Sign a JWT for an admin.
 * @param {object} admin Mongoose admin doc
 * @returns {string}
 */
export const signAdminToken = (admin) =>
  jwt.sign({ id: admin._id.toString(), role: admin.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

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
 * Populates req.admin.
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
