/**
 * 404 handler — for unmatched routes.
 */
export const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Central error handler. Keep error responses generic in production and never
 * leak secrets or stack traces to clients.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || 'Internal server error';

  // Mongoose: bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    status = 400;
    message = 'Invalid resource id';
  }

  // Mongoose: validation error
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
  }

  // Mongoose: duplicate key
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}`;
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} -> ${err.stack || err.message}`);
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && status >= 500 ? { stack: err.stack } : {}),
  });
};

/**
 * Wrap async route handlers so thrown errors reach the error handler.
 * @param {Function} fn
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
