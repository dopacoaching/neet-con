import express from 'express';
import { createRegistration } from '../controllers/registrationController.js';
import { registrationLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/', registrationLimiter, createRegistration);

export default router;
