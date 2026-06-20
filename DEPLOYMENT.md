# Deployment — NEET CON 2026

Split deployment: **API → Render**, **client → Vercel**, **database → MongoDB Atlas**.

> Order matters slightly: deploy the API first to learn its URL, then the client
> (which needs the API URL), then come back and set the API's `CLIENT_URL` to the
> client URL. A first deploy with placeholder URLs + one settings update is normal.

---

## 0. Prerequisites

- A **MongoDB Atlas** cluster (free tier is fine). Create a DB user + get the
  connection string (`mongodb+srv://...`). Under *Network Access*, allow
  `0.0.0.0/0` (Render egress IPs are dynamic on the free plan).
- A **GitHub** repo with this code pushed (see the root `README` / git section).
- A **Render** account and a **Vercel** account.

---

## 1. API on Render

You can use the included **`render.yaml`** blueprint, or configure manually.

### Option A — Blueprint (recommended)
1. Render Dashboard → **New → Blueprint** → select your GitHub repo.
2. Render reads `render.yaml` and creates the `neetcon-2026-api` web service
   (root dir `server`, build `npm install`, start `npm start`, health check
   `/api/health`). `JWT_SECRET` is auto-generated.
3. Fill the `sync:false` secrets in the dashboard (see env list below).

### Option B — Manual
- **Root Directory:** `server`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Health Check Path:** `/api/health`

### API environment variables (Render dashboard)

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `MONGO_URI` | your Atlas connection string |
| `JWT_SECRET` | a long random string (blueprint auto-generates) |
| `JWT_EXPIRES_IN` | `7d` |
| `CLIENT_URL` | the Vercel URL, e.g. `https://neetcon-2026.vercel.app` (no trailing slash) |
| `SEAT_CAPACITY` | `600` |
| `REGISTRATION_FEE` | `200` |
| `HDFC_MOCK` | `true` until a live payment is validated, then `false` |
| `HDFC_API_KEY` / `HDFC_MERCHANT_ID` / `HDFC_RESPONSE_KEY` / `HDFC_PAYMENT_PAGE_CLIENT_ID` | from the SmartGateway dashboard |
| `HDFC_BASE_URL` | `https://smartgateway.hdfcbank.com` |
| `HDFC_API_VERSION` | `2023-06-30` |
| `HDFC_REDIRECT_URL` | `https://<your-api>.onrender.com/api/payment/callback` |
| `HDFC_WEBHOOK_URL` | `https://<your-api>.onrender.com/api/payment/webhook` |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASS`/`MAIL_FROM` | Gmail SMTP (App Password) |
| `EVENT_DATE`/`EVENT_TIME`/`EVENT_VENUE` | event details for the email |

After it deploys, note the API URL: `https://<your-api>.onrender.com`.

### Seed admin users (one-time)
From the Render service **Shell**:
```bash
npm run seed:admin
```
Then change the default passwords (`changeme123`) after first login.

> **Free-plan note:** the service sleeps after inactivity; the first request
> after a sleep takes ~30–50s to wake.

---

## 2. Client on Vercel

1. Vercel → **Add New → Project** → import the same GitHub repo.
2. **Root Directory:** `client` (important — the app is in a subfolder).
3. Framework preset: **Vite** (auto-detected; `vercel.json` also pins it).
   Build `npm run build`, output `dist` — already configured.
4. **Environment Variable:**

   | Variable | Value |
   |----------|-------|
   | `VITE_API_BASE` | `https://<your-api>.onrender.com/api` (note the trailing `/api`) |

5. Deploy. Note the client URL, e.g. `https://neetcon-2026.vercel.app`.

`vercel.json` adds the SPA rewrite so deep links (`/register`, `/thank-you`,
`/neetcon-admin/login`, …) work on refresh.

---

## 3. Wire the two together

1. Back in **Render**, set `CLIENT_URL` to the Vercel URL and **redeploy** (this
   drives CORS + the post-payment redirect target).
2. In the **SmartGateway dashboard**: register the **return URL**
   (`https://<your-api>.onrender.com/api/payment/callback`) and **webhook URL**
   (`.../api/payment/webhook`), and add to the **IP whitelist** if required.

Cross-origin auth is already handled: the admin cookie is `SameSite=None; Secure`
in production and CORS allows credentials from `CLIENT_URL` only.

---

## 4. Go live with payments

1. Keep `HDFC_MOCK=true` and smoke-test the whole flow on the live URLs.
2. Do one real ₹200 payment, confirm the registration flips to CONFIRMED and the
   email + QR arrive, then **refund** it from the dashboard.
3. Set `HDFC_MOCK=false` on Render and redeploy. You're live.

---

## Quick checklist

- [ ] Atlas cluster + `MONGO_URI`, network access open
- [ ] Code pushed to GitHub
- [ ] Render API deployed, env vars set, `/api/health` green
- [ ] `npm run seed:admin` run, default passwords changed
- [ ] Vercel client deployed with `VITE_API_BASE`
- [ ] Render `CLIENT_URL` set to the Vercel URL, redeployed
- [ ] SmartGateway return/webhook URLs registered
- [ ] One live payment validated + refunded, then `HDFC_MOCK=false`
