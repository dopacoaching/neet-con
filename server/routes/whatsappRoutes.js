import express from 'express';
import {
  verifyWebhook,
  receiveWebhook,
  debugRecent,
  triggerMeetingStarting,
  triggerMeetingStartingV3,
  triggerMeetingStartingV4,
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

// One-off (2026-08-15 occurrence): same pattern, new template/link/tracking
// field so repeat registrants still get this occurrence's reminder.
router.post('/trigger-meeting-starting-v3', triggerMeetingStartingV3);

// One-off (2026-08-17 occurrence): same pattern, new template/link/tracking
// field so repeat registrants still get this occurrence's reminder.
router.post('/trigger-meeting-starting-v4', triggerMeetingStartingV4);

export default router;
