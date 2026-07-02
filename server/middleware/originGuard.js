import { getAllowedOrigins } from '../config/origins.js';

/**
 * CSRF defence for cross-site state changes.
 *
 * The admin session cookie is SameSite=None (required for the split
 * Vercel client / Render API deploy), so browsers attach it on cross-site
 * requests. CORS already blocks *preflighted* cross-origin calls, but "simple"
 * requests (e.g. a form POST) skip preflight. This guard rejects any
 * state-changing request whose Origin isn't our client, closing that gap.
 *
 * Same-origin and non-browser clients frequently omit Origin — those are
 * allowed through (they still need a valid auth cookie). Only a *present*,
 * non-whitelisted Origin is rejected.
 */
const originGuard = (req, res, next) => {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!mutating) return next();

  const origin = req.get('origin');
  if (origin && !getAllowedOrigins().includes(origin)) {
    res.status(403);
    return next(new Error('Cross-origin request blocked'));
  }
  next();
};

export default originGuard;
