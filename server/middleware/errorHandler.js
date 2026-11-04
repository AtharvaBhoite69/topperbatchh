// =============================================================================
// TopperBatch - Global Error Handler Middleware
// =============================================================================

const env = require('../config/env');

/**
 * Global error handler middleware.
 * Logs errors and returns sanitized error messages.
 */
function errorHandler(err, req, res, _next) {
  // Log the error
  console.error('❌ Unhandled Error:', {
    message: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
  });

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File is too large. Maximum size is 50MB.',
    });
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file field.',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token.',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired.',
    });
  }

  // SQLite constraint errors
  if (err.message && err.message.includes('UNIQUE constraint failed')) {
    return res.status(409).json({
      error: 'A record with this information already exists.',
    });
  }

  if (err.message && err.message.includes('FOREIGN KEY constraint failed')) {
    return res.status(400).json({
      error: 'Referenced record does not exist.',
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const response = {
    error: statusCode === 500
      ? 'An internal server error occurred.'
      : err.message || 'Something went wrong.',
  };

  // Include stack trace in development
  if (env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = err.message;
  }

  res.status(statusCode).json(response);
}

/**
 * 404 handler for unknown routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = { errorHandler, notFoundHandler };
