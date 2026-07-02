import express from 'express';
import {
  login,
  logout,
  me,
  listRegistrations,
  getRegistration,
  updateRegistrationStatus,
  summary,
  exportRegistrations,
  checkIn,
} from '../controllers/adminController.js';
import { protect, requireAdminRole } from '../middleware/authMiddleware.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
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

// Manual status changes require the "admin" role (not "viewer").
router.patch('/registrations/:id/status', protect, requireAdminRole, updateRegistrationStatus);

// Export requires "admin" role.
router.get('/export', protect, requireAdminRole, exportRegistrations);

export default router;
