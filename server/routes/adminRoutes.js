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
  exportRegistrations,
  checkIn,
  listCheckIns,
  exportCheckIns,
  setGuestCountAtGate,
  registerWalkIn,
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

// Gate check-in by scanned QR code — any authenticated admin (incl. viewers).
router.post('/checkin', protect, checkIn);

// List of everyone checked in so far — any authenticated admin.
router.get('/checkins', protect, listCheckIns);

// Excel export of the check-in roster — any authenticated admin, same
// access level as viewing the list itself.
router.get('/checkins/export', protect, exportCheckIns);

// Register a walk-in student (never registered online) and check them in
// immediately — any authenticated admin (incl. viewer-role gate staff).
router.post('/registrations/walk-in', protect, registerWalkIn);

// Set guest count at the gate (spoken/typed during check-in) — any authenticated
// admin, since gate staff may be viewer-role and this doesn't touch seat status.
router.patch('/registrations/:id/guest-count', protect, setGuestCountAtGate);

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

// Export requires "admin" role.
router.get('/export', protect, requireAdminRole, exportRegistrations);

export default router;
