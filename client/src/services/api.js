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

export const getRegistrationStatus = (orderId) =>
  api.get(`/registrations/status/${orderId}`).then((r) => r.data.data);

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

export const adminResendWhatsApp = (id) =>
  api.post(`/admin/registrations/${id}/resend-whatsapp`).then((r) => r.data.data);

// Push the live roster into the connected Google Sheet. Returns { sheetUrl }.
export const adminSyncSheet = () =>
  api.post('/admin/sync-sheet').then((r) => r.data.data);

// Mark/unmark a registrant as having joined the event's WhatsApp group.
export const adminSetJoined = (id, joined) =>
  api.patch(`/admin/registrations/${id}/joined`, { joined }).then((r) => r.data.data);

// The list of everyone marked as joined so far (most recent first) + count.
export const adminListJoined = () => api.get('/admin/joined').then((r) => r.data.data);

// Manual guest-count override.
export const adminSetGuestCount = (id, guestCount) =>
  api.patch(`/admin/registrations/${id}/guest-count`, { guestCount }).then((r) => r.data.data);

export default api;
