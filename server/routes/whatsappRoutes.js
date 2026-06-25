import express from 'express';
import { verifyWebhook, receiveWebhook } from '../controllers/whatsappController.js';

const router = express.Router();

// Meta calls GET to verify the callback URL, then POSTs status/message events.
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

export default router;
