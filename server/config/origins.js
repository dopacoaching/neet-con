/**
 * Single source of truth for the origins allowed to make credentialed,
 * cross-site requests to the API. Used by both the CORS layer and the admin
 * CSRF/origin guard so they can never drift apart.
 */
// Vercel's default URL for this project — always kept allowed so the app keeps
// working during a custom-domain cutover (while DNS/SSL propagate).
const VERCEL_URL = 'https://neet-con-2026.vercel.app';

export const getAllowedOrigins = () => {
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
  // Optional extra origins (comma-separated), e.g. a custom domain mid-migration.
  const extra = (process.env.EXTRA_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const list =
    process.env.NODE_ENV === 'production'
      ? [CLIENT_URL, VERCEL_URL, ...extra]
      : [CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000', ...extra];

  return [...new Set(list)];
};

export default getAllowedOrigins;
