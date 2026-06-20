import express from 'express';
import { createRegistration, getSeats } from '../controllers/registrationController.js';
import { registrationLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/', registrationLimiter, createRegistration);
router.get('/seats', getSeats);

export default router;
