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
 * Google-Form ingest protection: keyed by a shared secret, not user-facing, so
 * legitimate volume is low and bursty guessing of FORM_INGEST_SECRET should be
 * slowed down independent of the generous blanket apiLimiter.
 */
export const externalIngestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again shortly.',
  },
});

/**
 * Admin-triggered WhatsApp resend: real messages to real people, so cap it
 * well below what a runaway double-click or frontend bug could rack up.
 */
export const whatsappResendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many resend attempts. Please wait a minute and try again.',
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
