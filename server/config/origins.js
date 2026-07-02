/**
 * Single source of truth for the origins allowed to make credentialed,
 * cross-site requests to the API. Used by both the CORS layer and the admin
 * CSRF/origin guard so they can never drift apart.
 */
export const getAllowedOrigins = () => {
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
  return process.env.NODE_ENV === 'production'
    ? [CLIENT_URL]
    : [CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'];
};

export default getAllowedOrigins;
