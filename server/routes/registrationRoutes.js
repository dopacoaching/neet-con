import express from 'express';
import { createRegistration, getPass } from '../controllers/registrationController.js';
import { registrationLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/', registrationLimiter, createRegistration);
router.get('/pass/:orderId', getPass);

export default router;
