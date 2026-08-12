/**
 * Centralized error-handling middleware.
 * All errors thrown or passed via next(err) land here.
 *
 * Error shape (always consistent):
 * { error: string, message: string, details?: any }
 */
const errorHandler = (err, req, res, next) => {
  // Prevent sending headers twice if response is already streaming
  if (res.headersSent) return next(err);

  const status = err.statusCode || err.status || 500;
  const errorType = err.name || 'InternalServerError';
  const message = err.message || 'An unexpected error occurred';

  // Log full error in non-production envs for easier debugging
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${req.method} ${req.path} → ${status} ${errorType}: ${message}`);
    if (err.details) console.error('[ERROR details]', err.details);
  }

  res.status(status).json({
    error: errorType,
    message,
    ...(err.details && { details: err.details }),
  });
};

module.exports = errorHandler;
