import express from 'express';
import {
  initiatePayment,
  paymentCallback,
  paymentWebhook,
  getPaymentStatus,
  mockPayPage,
} from '../controllers/paymentController.js';

const router = express.Router();

router.post('/initiate', initiatePayment);

// HDFC redirects back here. Support both GET and POST (gateways vary).
router.route('/callback').get(paymentCallback).post(paymentCallback);

// Server-to-server webhook.
router.post('/webhook', paymentWebhook);

router.get('/status/:orderId', getPaymentStatus);

// MOCK-only simulated checkout page (404 when HDFC_MOCK=false).
router.get('/mock-pay', mockPayPage);

export default router;
