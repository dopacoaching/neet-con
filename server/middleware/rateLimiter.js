import rateLimit from 'express-rate-limit';

/**
 * Registration spam protection: 10 requests per IP per minute.
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts. Please wait a minute and try again.',
  },
});

/**
 * Admin login brute-force protection: 5 attempts per IP per 15 minutes.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failed logins toward the limit
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
});

/**
 * General API limiter (generous) applied to all /api routes as a safety net.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Tighter limiter for the PUBLIC endpoints that return registrant data keyed
 * only by order id (entry pass + payment status). Backstops the unguessable
 * order id against enumeration while staying comfortably above legitimate use
 * (the Thank-You page polls a handful of times, plus one pass load).
 */
export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.',
  },
});
