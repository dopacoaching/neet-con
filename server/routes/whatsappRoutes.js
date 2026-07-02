import express from 'express';
import { verifyWebhook, receiveWebhook, debugRecent, diag } from '../controllers/whatsappController.js';

const router = express.Router();

// Meta calls GET to verify the callback URL, then POSTs status/message events.
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

// Debug: recent events (gated by WHATSAPP_VERIFY_TOKEN).
router.get('/debug', debugRecent);
// Diag: live WhatsApp env config, no full secrets (gated by WHATSAPP_VERIFY_TOKEN).
router.get('/diag', diag);

export default router;
