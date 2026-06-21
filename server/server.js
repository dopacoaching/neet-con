import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Load server/.env regardless of the current working directory, so the server
// can be started from the repo root (nodemon) or from server/.
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '.env') });

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

import registrationRoutes from './routes/registrationRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Behind a proxy (Heroku/Render/Nginx) — needed for secure cookies + rate-limit IPs.
app.set('trust proxy', 1);

// --- Security & parsing middleware ---
app.use(
  helmet({
    // The mock pay page is inline HTML; relax CSP only enough for it in dev.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? [CLIENT_URL]
    : [CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'];

app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / server-to-server (no origin) and whitelisted clients.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'neetcon-2026-api',
    time: new Date().toISOString(),
    mockPayment: String(process.env.HDFC_MOCK).toLowerCase() === 'true',
  });
});

// --- API routes ---
app.use('/api', apiLimiter);
app.use('/api/registrations', registrationRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// --- Serve the built client from the same origin (if present) ---
// Lets one process/port serve both the API and the frontend — handy for tunnel
// previews and single-origin deploys. No-op when client/dist isn't alongside
// the server (e.g. Render API-only / Vercel client-only deploys).
const clientDist = join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: send index.html for non-API GET routes.
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(join(clientDist, 'index.html'));
    }
    next();
  });
  console.log('[server] Serving built client from client/dist');
}

// --- 404 + error handling ---
app.use(notFound);
app.use(errorHandler);

// --- Start ---
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[server] NEET CON 2026 API running on http://localhost:${PORT}`);
    console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(
      `[server] Payment mode: ${
        String(process.env.HDFC_MOCK).toLowerCase() === 'true' ? 'MOCK (HDFC not configured)' : 'LIVE HDFC'
      }`
    );
  });
};

start();

export default app;
