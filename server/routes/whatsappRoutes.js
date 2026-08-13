import express from 'express';
import {
  verifyWebhook,
  receiveWebhook,
  debugRecent,
  triggerMeetingStarting,
} from '../controllers/whatsappController.js';

const router = express.Router();

// Meta calls GET to verify the callback URL, then POSTs status/message events.
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

// Debug: recent events (gated by WHATSAPP_VERIFY_TOKEN).
router.get('/debug', debugRecent);

// One-off (2026-08-13): "meeting starts in 15 minutes" broadcast, gated by
// CRON_TRIGGER_SECRET so an external scheduler (GitHub Actions cron) can
// fire it at 7:15 PM IST without an admin login session.
router.post('/trigger-meeting-starting', triggerMeetingStarting);

export default router;
