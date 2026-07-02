import axios from 'axios';

// In dev, Vite proxies /api -> http://localhost:5000 (see vite.config.js).
// In production set VITE_API_BASE to the API base INCLUDING the /api path,
// e.g. "https://api.yourdomain.com/api" (or leave blank for same-origin "/api").
const baseURL = import.meta.env.VITE_API_BASE || '/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // send the admin httpOnly cookie
  headers: { 'Content-Type': 'application/json' },
});

// Normalise error messages from the API envelope.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.message ||
      'Something went wrong. Please try again.';
    return Promise.reject(Object.assign(err, { message }));
  }
);

/* ------------------------------------------------------------------ */
/* Public                                                              */
/* ------------------------------------------------------------------ */

export const createRegistration = (payload) =>
  api.post('/registrations', payload).then((r) => r.data.data);

export const initiatePayment = (orderId) =>
  api.post('/payment/initiate', { orderId }).then((r) => r.data.data);

export const getPaymentStatus = (orderId) =>
  api.get(`/payment/status/${orderId}`).then((r) => r.data.data);

// Direct URL to the branded entry-pass PNG (served by the API).
export const getPassUrl = (orderId) =>
  `${api.defaults.baseURL}/registrations/pass/${encodeURIComponent(orderId)}`;

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export const adminLogin = (username, password) =>
  api.post('/admin/login', { username, password }).then((r) => r.data.data);

export const adminLogout = () => api.post('/admin/logout').then((r) => r.data);

export const adminMe = () => api.get('/admin/me').then((r) => r.data.data);

export const adminSummary = () => api.get('/admin/summary').then((r) => r.data.data);

export const adminListRegistrations = (params) =>
  api.get('/admin/registrations', { params }).then((r) => r.data.data);

export const adminGetRegistration = (id) =>
  api.get(`/admin/registrations/${id}`).then((r) => r.data.data);

export const adminUpdateStatus = (id, payload) =>
  api.patch(`/admin/registrations/${id}/status`, payload).then((r) => r.data.data);

// Returns a Blob for download.
export const adminExport = () =>
  api.get('/admin/export', { responseType: 'blob' }).then((r) => r.data);

// Gate check-in by scanned QR code / registration number.
// Returns the full envelope { success, result, message, data } so the caller
// can distinguish checked_in / already_checked_in / not_confirmed.
export const adminCheckIn = (code) =>
  api.post('/admin/checkin', { code }).then((r) => r.data);

// The list of everyone checked in so far (most recent first) + count.
export const adminListCheckIns = () =>
  api.get('/admin/checkins').then((r) => r.data.data);

export default api;
