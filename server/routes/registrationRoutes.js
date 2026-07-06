import express from 'express';
import {
  createRegistration,
  createExternalRegistration,
  getPass,
} from '../controllers/registrationController.js';
import { registrationLimiter, publicReadLimiter, externalIngestLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/', registrationLimiter, createRegistration);
// Google-Form (free DOPA-student) ingest — authenticated by shared secret.
router.post('/external', externalIngestLimiter, createExternalRegistration);
router.get('/pass/:orderId', publicReadLimiter, getPass);

export default router;
