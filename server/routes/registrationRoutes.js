import express from 'express';
import { createRegistration, getPass } from '../controllers/registrationController.js';
import { registrationLimiter, publicReadLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/', registrationLimiter, createRegistration);
router.get('/pass/:orderId', publicReadLimiter, getPass);

export default router;
