import express from 'express';
import {
  createRegistration,
  getRegistrationStatus,
} from '../controllers/registrationController.js';
import { registrationLimiter, publicReadLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/', registrationLimiter, createRegistration);
router.get('/status/:orderId', publicReadLimiter, getRegistrationStatus);

export default router;
