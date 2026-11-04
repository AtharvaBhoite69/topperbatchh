// =============================================================================
// TopperBatch - Authentication Middleware
// =============================================================================

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { getDb } = require('../database/db');
const { sanitizeUser } = require('../utils/helpers');

const COOKIE_NAME = 'topperbatch_token';

/**
 * Authenticate user from JWT in httpOnly cookie.
 * Attaches user object to req.user on success.
 */
function authenticate(req, res, next) {
  try {
    let token = req.cookies?.[COOKIE_NAME];
    if (!token && req.headers?.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        clearAuthCookie(res);
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
      }
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }

    const db = getDb();

    // Check session exists and is active
    const session = db.prepare(
      'SELECT * FROM sessions WHERE user_id = ? AND is_active = 1 AND expires_at > datetime(\'now\')'
    ).get(decoded.userId);

    if (!session) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Session is no longer valid. Please log in again.' });
    }

    // Get user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);

    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'User not found.' });
    }

    // Check user status - admins always pass, others need 'approved'
    if (user.role !== 'admin' && user.status !== 'approved') {
      return res.status(403).json({
        error: `Your account is currently ${user.status}. Please contact an admin.`,
        status: user.status,
      });
    }

    // Update last active date
    db.prepare('UPDATE users SET last_active_date = datetime(\'now\') WHERE id = ?').run(user.id);

    // Attach sanitized user to request
    req.user = sanitizeUser(user);
    req.sessionId = session.id;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(500).json({ error: 'Authentication failed.' });
  }
}

/**
 * Require admin role. Must be used after authenticate middleware.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

/**
 * Require approved status. Must be used after authenticate middleware.
 */
function requireApproved(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.user.role === 'admin') {
    return next(); // Admins always pass
  }
  if (req.user.status !== 'approved') {
    return res.status(403).json({
      error: 'Your account must be approved to access this resource.',
      status: req.user.status,
    });
  }
  next();
}

/**
 * Create JWT token with user payload.
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function createToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Set authentication cookie on response.
 * @param {import('express').Response} res
 * @param {string} token - JWT token
 */
function setAuthCookie(res, token) {
  const isProduction = env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

/**
 * Clear authentication cookie.
 * @param {import('express').Response} res
 */
function clearAuthCookie(res) {
  res.cookie(COOKIE_NAME, '', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

module.exports = {
  authenticate,
  requireAdmin,
  requireApproved,
  createToken,
  setAuthCookie,
  clearAuthCookie,
  COOKIE_NAME,
};
