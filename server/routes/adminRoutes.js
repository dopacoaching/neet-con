import express from 'express';
import {
  login,
  logout,
  me,
  listRegistrations,
  getRegistration,
  updateRegistrationStatus,
  resendWhatsApp,
  summary,
  listJoined,
  setJoined,
  setGuestCount,
  syncGoogleSheet,
} from '../controllers/adminController.js';
import { protect, requireAdminRole } from '../middleware/authMiddleware.js';
import { loginLimiter, whatsappResendLimiter } from '../middleware/rateLimiter.js';
import originGuard from '../middleware/originGuard.js';

const router = express.Router();

// Admin responses carry full PII — never cache them (browser, proxy or CDN).
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// CSRF defence: reject cross-origin state-changing requests.
router.use(originGuard);

// --- Public (auth) ---
router.post('/login', loginLimiter, login);
router.post('/logout', logout);

// --- Protected ---
router.get('/me', protect, me);
router.get('/summary', protect, summary);
router.get('/registrations', protect, listRegistrations);
router.get('/registrations/:id', protect, getRegistration);

// Mark/unmark a registrant as having joined the event's WhatsApp group — any
// authenticated admin (no automated way to detect this via the Cloud API).
router.patch('/registrations/:id/joined', protect, setJoined);

// List of everyone marked as joined so far — any authenticated admin.
router.get('/joined', protect, listJoined);

// Manual guest-count override (e.g. an unparsed WhatsApp reply) — any
// authenticated admin; doesn't touch seat status.
router.patch('/registrations/:id/guest-count', protect, setGuestCount);

// Manual status changes require the "admin" role (not "viewer").
router.patch('/registrations/:id/status', protect, requireAdminRole, updateRegistrationStatus);

// Resend the WhatsApp confirmation — real message to a real person, admin role only.
router.post(
  '/registrations/:id/resend-whatsapp',
  protect,
  requireAdminRole,
  whatsappResendLimiter,
  resendWhatsApp
);

// Push the live roster into a connected Google Sheet. Admin role only.
router.post('/sync-sheet', protect, requireAdminRole, syncGoogleSheet);

export default router;
