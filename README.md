# NEET CON 2026 — Registration System

Full-stack **MERN** application for **NEET CON 2026**, hosted by **DOPA Coaching, Calicut, Kerala**.
Students register and pay ₹100 via the HDFC Payment Gateway; the DOPA team manages everything from an internal admin dashboard.

- **Event:** NEET CON 2026 · **Date:** July 12, 2026 · **Venue:** Yamaniya Hall, Kuttikattor (Calicut, Kerala)
- **Fee:** ₹100 per student · **Capacity:** 600 seats (hard cap)
- **Payment:** HDFC SmartGateway (powered by Juspay) — hosted payment page / redirect

---

## Tech Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18, Vite, React Router v6, Tailwind CSS, react-hook-form, react-hot-toast, axios, date-fns |
| Backend  | Node.js, Express, Mongoose |
| Database | MongoDB |
| Auth     | JWT in an httpOnly cookie (admin only) |
| Payment  | HDFC PG (mock mode until credentials arrive) |
| Export   | `xlsx` |
| Security | helmet, CORS allow-list, express-rate-limit, bcrypt, signature verification |

---

## Project Structure

```
neetcon-2026/
├── client/   # React + Vite frontend
└── server/   # Express + MongoDB backend
```

See the prompt/spec for the full file-by-file breakdown.

---

## Prerequisites

- **Node.js 18+** (built & tested on v22)
- **MongoDB** running locally (`mongodb://localhost:27017`) or a connection string

---

## Setup

### 1. Backend

```bash
cd server
npm install
cp .env.example .env        # then edit values (see below)
npm run seed:admin          # create default admin users
npm run dev                 # starts on http://localhost:5000
```

### 2. Frontend

```bash
cd client
npm install
npm run dev                 # starts on http://localhost:5173
```

The Vite dev server proxies `/api` → `http://localhost:5000`, so no extra config is needed in development.

### 3. Open

- Public site: <http://localhost:5173>
- Admin login: <http://localhost:5173/neetcon-admin/login>

---

## Environment Variables (`server/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | API port (default 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string for signing admin tokens |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `HDFC_API_KEY` / `HDFC_MERCHANT_ID` / `HDFC_RESPONSE_KEY` | SmartGateway credentials (API Key, merchant id, HMAC Response Key) |
| `HDFC_PAYMENT_PAGE_CLIENT_ID` | Payment page client id (often = merchant id) |
| `HDFC_BASE_URL` | SmartGateway base URL (UAT vs production) |
| `HDFC_API_VERSION` | API version date header (e.g. `2023-06-30`) |
| `HDFC_REDIRECT_URL` | Browser callback (must be `…/api/payment/callback`) |
| `HDFC_WEBHOOK_URL` | Server-to-server webhook URL |
| `HDFC_MOCK` | `true` = simulate payments locally; `false` = use real SmartGateway |
| `CLIENT_URL` | Frontend origin (CORS + redirects) |
| `SEAT_CAPACITY` | Hard seat cap (default 600) |
| `REGISTRATION_FEE` | Fee in INR (default 100) |
| `EVENT_DATE` / `EVENT_TIME` / `EVENT_VENUE` | Shown in the confirmation message |
| `WHATSAPP_*` | Meta WhatsApp Cloud API config (see `.env.example`) — primary confirmation channel |

> **Never commit `.env`.** It is git-ignored.

The confirmation + entry QR are delivered over **WhatsApp** (Meta Cloud API), not
email. See [`server/utils/whatsapp.js`](server/utils/whatsapp.js) for the required
approved-template spec, and verify your setup with:

```bash
cd server
npm run test:whatsapp -- 9876543210
```

---

## Default Admin Users

Created by `npm run seed:admin`. **Change these passwords after first login.**

| Username | Password | Role |
|----------|------------|--------|
| `bilal`  | `changeme123` | admin |
| `nihad`  | `changeme123` | admin |
| `ashik`  | `changeme123` | viewer |

- **admin** — full access: manual confirmation, status changes, Excel export.
- **viewer** — read-only: can browse and search but not modify or export.

Re-run with `node seed/createAdmin.js --reset` to reset passwords to the defaults.

---

## Payment Flow

1. Student submits the form → `POST /api/registrations` saves a **PENDING** record and returns a unique `orderId`.
2. Frontend calls `POST /api/payment/initiate` → backend builds the signed HDFC request.
3. Browser is redirected to the HDFC hosted payment page.
4. After payment, HDFC redirects to `POST /api/payment/callback`; HDFC **also** calls `POST /api/payment/webhook` server-to-server.
5. **Both** paths independently verify the response signature, then finalise the registration (idempotent — whichever arrives first wins; the other is a no-op).
6. On success the status becomes **CONFIRMED**, a sequential registration code is generated atomically (**`NEET CON 001`**, `NEET CON 002`, … zero-padded to 3 digits), and `confirmedAt` is set.
7. A **WhatsApp confirmation with the entry QR** (the QR encodes the registration code) is sent to the student's mobile number via the Meta WhatsApp Cloud API. The QR is also shown on the Thank You page in-app. (Manual confirmations from the admin dashboard send the same message.)
8. The Thank You page polls `GET /api/payment/status/:orderId` (auto-retries while PENDING, then falls back to the Payment Failed page).

> **Mobile number is required** at registration — the registration code and entry QR are delivered to it via WhatsApp. Email is optional (kept for records only).

### Mock mode (no HDFC credentials yet)

With `HDFC_MOCK=true`, `POST /api/payment/initiate` returns a URL to a built-in **mock checkout page** (`/api/payment/mock-pay`) that lets you simulate Success/Failure and exercise the full flow end-to-end. Signatures are computed with placeholder SHA-256 logic that is self-consistent.

### Going live with HDFC SmartGateway (Juspay)

> **This gateway is HDFC SmartGateway, powered by Juspay — not CCAvenue.** The
> integration in `server/utils/hdfc.js` is built for SmartGateway's REST model:
> the server creates an order via `POST {BASE}/session` (API-key Basic auth),
> redirects the browser to the returned hosted `payment_links.web`, then verifies
> the return-URL params with an **HMAC-SHA256 signature using the Response Key**.

To switch from mock to live:

1. **`server/.env`** — set `HDFC_API_KEY`, `HDFC_MERCHANT_ID`, `HDFC_RESPONSE_KEY`,
   `HDFC_PAYMENT_PAGE_CLIENT_ID`, `HDFC_BASE_URL`, `HDFC_API_VERSION`, and set
   **`HDFC_MOCK=false`**. (See `.env.example` for where each comes from in the
   SmartGateway dashboard.)
2. **Dashboard** — register the return URL (`…/api/payment/callback`) and webhook
   URL, and add your server's IP to the **IP whitelist**.
3. **Validate in sandbox first.** Point `HDFC_BASE_URL` at the UAT host and run a
   real test transaction. The exact session fields and the return-URL HMAC
   construction must be confirmed against your SmartGateway integration doc
   before production — money is at stake, so do not skip this.

The rest of the flow (routes, controllers, idempotency, seat enforcement, the
dual callback + webhook confirmation paths) is unchanged.

---

## API Reference

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/registrations` | Create a PENDING registration, return `orderId` |
| `GET`  | `/api/registrations/seats` | `{ confirmed, remaining, total, isFull }` |
| `POST` | `/api/payment/initiate` | Build the HDFC request for an order |
| `GET/POST` | `/api/payment/callback` | HDFC browser redirect target |
| `POST` | `/api/payment/webhook` | HDFC server-to-server webhook |
| `GET`  | `/api/payment/status/:orderId` | Poll payment status |
| `GET`  | `/api/payment/mock-pay` | Mock checkout page (only when `HDFC_MOCK=true`) |

### Admin (JWT cookie)

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| `POST` | `/api/admin/login` | — | Login, set httpOnly cookie |
| `POST` | `/api/admin/logout` | — | Clear cookie |
| `GET`  | `/api/admin/me` | any | Current admin |
| `GET`  | `/api/admin/summary` | any | Dashboard cards data |
| `GET`  | `/api/admin/registrations` | any | List (paginated, `?page&limit&status&preparingFor&search`) |
| `GET`  | `/api/admin/registrations/:id` | any | Single registration |
| `PATCH`| `/api/admin/registrations/:id/status` | **admin** | Update status / notes |
| `GET`  | `/api/admin/export` | **admin** | Download `.xlsx` |

---

## Security Notes

- Admin routes are protected by JWT verification from an httpOnly cookie.
- Registration is rate-limited to **10 req/IP/min**; admin login to **5 attempts/IP/15 min**.
- `helmet` sets security headers; CORS is restricted to `CLIENT_URL`.
- HDFC callback/webhook **verify the signature before any DB write**.
- HDFC working key / secrets are never logged.
- Seat cap (600) is enforced on the backend at confirmation time — the authoritative check — in addition to the frontend.
- A mobile number can hold only one CONFIRMED/MANUAL seat (`409 Conflict` otherwise).

---

## Production Build

```bash
cd client && npm run build      # outputs client/dist
cd ../server && NODE_ENV=production npm start
```

Serve `client/dist` from any static host (or behind the same domain as the API) and set
`VITE_API_BASE` at build time if the API is on a different origin. In production, set
`HDFC_REDIRECT_URL` / `HDFC_WEBHOOK_URL` / `CLIENT_URL` to your real HTTPS domain.

---

## Roadmap

- **v1.0 (this build):** form fields are final — Full Name, **Mobile (required, WhatsApp delivery)**, Email (optional), School/College, Year of 12th, Preparing For.
- **v1.1:** additional form fields. The Mongoose schema is intentionally additive — new optional fields can be added without breaking existing records.

---

© DOPA Coaching, Calicut.
