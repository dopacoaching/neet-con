import express from 'express';
import { verifyWebhook, receiveWebhook, debugRecent } from '../controllers/whatsappController.js';

const router = express.Router();

// Meta calls GET to verify the callback URL, then POSTs status/message events.
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

// Debug: recent events (gated by WHATSAPP_VERIFY_TOKEN).
router.get('/debug', debugRecent);

export default router;
