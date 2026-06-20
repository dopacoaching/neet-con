import crypto from 'crypto';

/**
 * HDFC SmartGateway (powered by Juspay) integration helper.
 *
 * ------------------------------------------------------------------------
 *  This gateway is NOT CCAvenue. It is Juspay's SmartGateway, which uses a
 *  REST + API-key model (confirmed from the merchant dashboard: API Keys,
 *  JWT Keys, Response Key, Card Encoding Key).
 *
 *  LIVE FLOW
 *   1. Server creates an order/session:  POST {BASE}/session
 *        - Auth: HTTP Basic with the API key as username, blank password.
 *        - Headers: x-merchantid, version.
 *        - Returns payment_links.web -> the hosted payment page URL.
 *   2. Browser is redirected (GET) to payment_links.web.
 *   3. After payment, SmartGateway redirects back to return_url (our callback)
 *      with params + an HMAC `signature`. We verify it with the RESPONSE KEY.
 *   4. (Defence in depth) We also fetch GET {BASE}/orders/{order_id} to read
 *      the authoritative status (CHARGED = paid).
 *
 *  ENV (set in server/.env, never commit):
 *    HDFC_API_KEY                 API key (dashboard > API Keys, "Neet Con")
 *    HDFC_MERCHANT_ID             merchant id (account profile)
 *    HDFC_RESPONSE_KEY            Response Key (dashboard > Security Keys) — HMAC
 *    HDFC_PAYMENT_PAGE_CLIENT_ID  payment page client id (defaults to merchant id)
 *    HDFC_BASE_URL                https://smartgateway.hdfcbank.com (prod)
 *                                 https://smartgatewayuat.hdfcbank.com (sandbox)
 *    HDFC_API_VERSION             API version date header (e.g. 2023-06-30)
 *    HDFC_REDIRECT_URL            return_url -> https://yourdomain/api/payment/callback
 *    HDFC_MOCK                    true = simulate locally (no real API calls)
 *
 *  >>> VALIDATE IN SANDBOX BEFORE PRODUCTION <<<
 *  The exact base URL, session field names, and especially the return-URL HMAC
 *  construction must be confirmed against YOUR SmartGateway integration doc and
 *  one real sandbox transaction. The implementation below follows Juspay's
 *  documented standard, but money is at stake — do not skip sandbox testing.
 * ------------------------------------------------------------------------
 */

export const isMockMode = () => String(process.env.HDFC_MOCK).toLowerCase() === 'true';

/* ------------------------------------------------------------------ */
/* Config accessors                                                   */
/* ------------------------------------------------------------------ */

const BASE_URL = () =>
  (process.env.HDFC_BASE_URL || 'https://smartgateway.hdfcbank.com').replace(/\/+$/, '');
const API_KEY = () => process.env.HDFC_API_KEY || '';
const MERCHANT_ID = () => process.env.HDFC_MERCHANT_ID || '';
const RESPONSE_KEY = () => process.env.HDFC_RESPONSE_KEY || 'mock_response_key';
const PAYMENT_PAGE_CLIENT_ID = () => process.env.HDFC_PAYMENT_PAGE_CLIENT_ID || MERCHANT_ID();
const API_VERSION = () => process.env.HDFC_API_VERSION || '2023-06-30';

const basicAuthHeader = () => 'Basic ' + Buffer.from(`${API_KEY()}:`).toString('base64');

const smartGatewayHeaders = () => ({
  Authorization: basicAuthHeader(),
  'x-merchantid': MERCHANT_ID(),
  version: API_VERSION(),
});

/* ------------------------------------------------------------------ */
/* Status normalisation                                               */
/* ------------------------------------------------------------------ */

// Map a Juspay/mock status token to our internal set.
const normaliseStatus = (rawStatus) => {
  const s = String(rawStatus || '').toUpperCase();
  // Juspay success
  if (['CHARGED', 'SUCCESS', 'SUCCESSFUL', 'PAID', 'AUTO_REFUNDED'].includes(s)) return 'SUCCESS';
  // Juspay user-cancelled / aborted
  if (['ABORTED', 'CANCELLED', 'CANCELED', 'USER_ABORTED'].includes(s)) return 'ABORTED';
  // Juspay failures
  if (
    [
      'FAILURE',
      'FAILED',
      'DECLINED',
      'ERROR',
      'AUTHENTICATION_FAILED',
      'AUTHORIZATION_FAILED',
      'JUSPAY_DECLINED',
      'API_FAILURE',
    ].includes(s)
  )
    return 'FAILURE';
  // NEW / PENDING / PENDING_VBV / STARTED etc.
  return 'UNKNOWN';
};

/* ------------------------------------------------------------------ */
/* Return-URL HMAC verification (Juspay)                              */
/* ------------------------------------------------------------------ */

/**
 * Verify the HMAC-SHA256 signature SmartGateway appends to the return URL.
 *
 * Juspay's documented algorithm:
 *   1. Drop `signature` and `signature_algorithm`.
 *   2. For each remaining param, percent-encode key and value.
 *   3. Sort the encoded pairs by key, join with `&`.
 *   4. Percent-encode that whole string.
 *   5. HMAC-SHA256 it with the Response Key, base64-encode.
 *   6. Compare (constant time) to the URL-decoded received `signature`.
 *
 * @param {Record<string,string>} params  raw return-url params
 * @param {string} responseKey
 * @returns {boolean}
 */
export const verifyJuspaySignature = (params, responseKey) => {
  const received = params?.signature;
  if (!received || typeof received !== 'string') return false;

  const pairs = Object.keys(params)
    .filter((k) => k !== 'signature' && k !== 'signature_algorithm')
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .sort();
  const encoded = encodeURIComponent(pairs.join('&'));

  const computed = crypto.createHmac('sha256', responseKey).update(encoded).digest('base64');

  let receivedDecoded;
  try {
    receivedDecoded = decodeURIComponent(received);
  } catch {
    receivedDecoded = received;
  }

  const a = Buffer.from(computed);
  const b = Buffer.from(receivedDecoded);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

/* ------------------------------------------------------------------ */
/* Mock-mode hashing (self-consistent; no real gateway)               */
/* ------------------------------------------------------------------ */

const serialiseForHash = (payload) => {
  const keys = Object.keys(payload)
    .filter((k) => k !== 'hash' && k !== 'signature')
    .filter((k) => payload[k] !== undefined && payload[k] !== null && typeof payload[k] !== 'object')
    .sort();
  return keys.map((k) => `${k}=${payload[k]}`).join('&');
};

export const buildHdfcHash = (payload, secretKey) =>
  crypto.createHash('sha256').update(`${serialiseForHash(payload)}|${secretKey}`).digest('hex');

const verifyMockHash = (response, secretKey) => {
  const received = response?.hash;
  if (!received || typeof received !== 'string') return false;
  const computed = buildHdfcHash(response, secretKey);
  const a = Buffer.from(received);
  const b = Buffer.from(computed);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

/* ------------------------------------------------------------------ */
/* Outgoing: create a payment session                                 */
/* ------------------------------------------------------------------ */

/**
 * Create a SmartGateway/Juspay order session and return the hosted page URL.
 * @returns {Promise<string>} payment_links.web
 */
const createSmartGatewaySession = async ({
  orderId,
  amount,
  customerName,
  customerMobile,
  customerEmail,
}) => {
  const body = {
    order_id: orderId,
    amount: Number(amount).toFixed(2),
    currency: 'INR',
    customer_id: customerMobile, // stable per-customer reference
    customer_email: customerEmail || '',
    customer_phone: customerMobile,
    payment_page_client_id: PAYMENT_PAGE_CLIENT_ID(),
    action: 'paymentPage',
    return_url: process.env.HDFC_REDIRECT_URL || '',
    description: 'NEET CON 2026 registration',
    first_name: customerName || '',
  };

  const res = await fetch(`${BASE_URL()}/session`, {
    method: 'POST',
    headers: { ...smartGatewayHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SmartGateway session failed (${res.status}): ${text.slice(0, 300)}`);
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('SmartGateway returned a non-JSON session response');
  }

  const url = json?.payment_links?.web || json?.payment_links?.iframe;
  if (!url) {
    throw new Error('SmartGateway session did not include a payment link');
  }
  return url;
};

/**
 * Build the data needed to send the user to the payment gateway.
 *
 * NOTE: async — the live path calls the SmartGateway API.
 *
 * @returns {Promise<{ mock:boolean, method:'GET'|'POST', paymentUrl:string, fields:object }>}
 */
export const buildPaymentRequest = async ({
  orderId,
  amount,
  customerName,
  customerMobile,
  customerEmail = '',
}) => {
  if (isMockMode()) {
    const base = (process.env.HDFC_REDIRECT_URL || '').replace('/api/payment/callback', '') || '';
    return {
      mock: true,
      method: 'GET',
      paymentUrl: `${base}/api/payment/mock-pay?orderId=${encodeURIComponent(orderId)}`,
      fields: { order_id: orderId },
    };
  }

  const paymentUrl = await createSmartGatewaySession({
    orderId,
    amount,
    customerName,
    customerMobile,
    customerEmail,
  });

  // The hosted page is reached by a simple browser redirect (GET).
  return { mock: false, method: 'GET', paymentUrl, fields: {} };
};

/* ------------------------------------------------------------------ */
/* Incoming: parse + verify the callback/webhook                      */
/* ------------------------------------------------------------------ */

/**
 * Optionally fetch the authoritative order status from SmartGateway.
 * Used as defence-in-depth so a confirmation never relies on the redirect alone.
 * Returns the normalised status, or null if the call could not be made.
 * @param {string} orderId
 * @returns {Promise<'SUCCESS'|'FAILURE'|'ABORTED'|'UNKNOWN'|null>}
 */
export const fetchOrderStatus = async (orderId) => {
  if (!orderId || isMockMode()) return null;
  try {
    const res = await fetch(`${BASE_URL()}/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: smartGatewayHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return normaliseStatus(json?.status);
  } catch {
    return null;
  }
};

/**
 * Normalise an HDFC SmartGateway callback/webhook body into a common shape AND
 * verify it (HMAC for live, self-consistent hash for mock).
 *
 * @param {object} body
 * @returns {{ orderId:string, status:'SUCCESS'|'FAILURE'|'ABORTED'|'UNKNOWN', txnId:string, raw:object, verified:boolean }}
 */
export const parseHdfcResponse = (body = {}) => {
  if (isMockMode()) {
    const orderId = body.order_id || body.orderId || '';
    return {
      orderId,
      status: normaliseStatus(body.order_status || body.status),
      txnId: body.tracking_id || body.txn_id || '',
      raw: body,
      verified: verifyMockHash(body, RESPONSE_KEY()),
    };
  }

  // --- Live SmartGateway return params ---
  const orderId = body.order_id || body.orderId || '';
  return {
    orderId,
    status: normaliseStatus(body.status || body.order_status),
    txnId: body.transaction_id || body.txn_uuid || body.epg_txn_id || '',
    raw: body,
    verified: verifyJuspaySignature(body, RESPONSE_KEY()),
  };
};

/**
 * MOCK ONLY. Produce a self-consistent callback payload for the mock pay page
 * so local callback verification succeeds without a real gateway.
 * @param {string} orderId
 * @param {'CHARGED'|'FAILURE'} status
 * @returns {object}
 */
export const buildMockCallback = (orderId, status) => {
  const payload = {
    order_id: orderId,
    status,
    transaction_id: `MOCK-${Date.now()}`,
    amount: Number(process.env.REGISTRATION_FEE || 200).toFixed(2),
  };
  payload.hash = buildHdfcHash(payload, RESPONSE_KEY());
  return payload;
};
