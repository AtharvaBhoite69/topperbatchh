// =============================================================================
// TopperBatch - Authentication Routes
// =============================================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { getDb } = require('../database/db');
const env = require('../config/env');
const { generateId, generateToken, hashToken, sanitizeUser } = require('../utils/helpers');
const {
  authenticate,
  createToken,
  setAuthCookie,
  clearAuthCookie,
} = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  registerValidation,
  loginValidation,
  handleValidationErrors,
} = require('../middleware/validator');
const { sendPasswordReset } = require('../services/email');

/**
 * Helper to check if an email belongs to a permanent admin
 */
function isPermanentAdmin(email) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return env.ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalized);
}

/**
 * POST /api/auth/register
 * Student registration flow.
 * Admin emails are auto-approved as admins; others are created as 'pending'.
 */
router.post(
  '/register',
  authLimiter,
  registerValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email, password, fullName, semester, department } = req.body;
      const db = getDb();
      const normalizedEmail = email.trim().toLowerCase();

      // Check if user already exists
      const existingUser = db.prepare('SELECT id, status FROM users WHERE email = ?').get(normalizedEmail);
      if (existingUser) {
        // Return generic success-like response to avoid account enumeration
        return res.status(200).json({
          success: true,
          message:
            'Registration request submitted. If this email is new, an administrator will review your account.',
          status: 'pending',
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const userId = generateId();
      const isAdmin = isPermanentAdmin(normalizedEmail);
      const role = isAdmin ? 'admin' : 'student';
      const status = isAdmin ? 'approved' : 'pending';

      const insertStmt = db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, role, status, semester, department)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        userId,
        normalizedEmail,
        passwordHash,
        fullName.trim(),
        role,
        status,
        semester ? parseInt(semester, 10) : null,
        department ? department.trim() : null
      );

      // If non-admin pending registration, notify admins
      if (!isAdmin) {
        const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
        const notifyStmt = db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, message, link)
          VALUES (?, ?, 'registration', 'New Recruit Pending Approval', ?, '/admin/registrations')
        `);

        for (const admin of admins) {
          notifyStmt.run(
            generateId(),
            admin.id,
            `${fullName.trim()} (${normalizedEmail}) has registered and is awaiting approval.`
          );
        }
      }

      return res.status(201).json({
        success: true,
        message: isAdmin
          ? 'Administrator account created and auto-approved! You can now log in.'
          : 'Registration submitted successfully! Your account is pending admin approval. You will be able to log in once approved.',
        status,
        isAdmin,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/login
 * User login with device & session tracking.
 */
router.post(
  '/login',
  authLimiter,
  loginValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const db = getDb();
      const normalizedEmail = email.trim().toLowerCase();

      // Look up user
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      // Check permanent admin auto-promotion
      if (isPermanentAdmin(normalizedEmail)) {
        if (user.role !== 'admin' || user.status !== 'approved') {
          db.prepare("UPDATE users SET role = 'admin', status = 'approved' WHERE id = ?").run(user.id);
          user.role = 'admin';
          user.status = 'approved';
        }
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      // Check account status
      if (user.status === 'pending') {
        return res.status(403).json({
          error: 'Your account is pending administrator approval. Please check back later.',
          status: 'pending',
        });
      }

      if (user.status === 'rejected') {
        return res.status(403).json({
          error: 'Your registration request was declined. Please contact an administrator.',
          status: 'rejected',
        });
      }

      if (user.status === 'suspended') {
        return res.status(403).json({
          error: 'Your account has been suspended by an administrator. Please reach out to support.',
          status: 'suspended',
        });
      }

      // Device / Session management: enforce max active sessions
      const setting = db.prepare("SELECT value FROM platform_settings WHERE key = 'max_sessions_per_user'").get();
      const maxSessions = setting ? parseInt(setting.value, 10) : 1;

      const activeSessions = db.prepare(
        "SELECT id FROM sessions WHERE user_id = ? AND is_active = 1 ORDER BY created_at ASC"
      ).all(user.id);

      if (activeSessions.length >= maxSessions) {
        // Deactivate oldest sessions to respect max session limit
        const toRevoke = activeSessions.slice(0, activeSessions.length - maxSessions + 1);
        const deactivateStmt = db.prepare("UPDATE sessions SET is_active = 0 WHERE id = ?");
        for (const s of toRevoke) {
          deactivateStmt.run(s.id);
        }
      }

      // Create new session
      const sessionId = generateId();
      const rawToken = generateToken();
      const tokenHash = hashToken(rawToken);
      const userAgent = req.headers['user-agent'] || 'Unknown Device';
      const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';

      // 7 days expiration
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO sessions (id, user_id, token_hash, device_info, ip_address, is_active, expires_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(sessionId, user.id, tokenHash, userAgent, ipAddress, expiresAt);

      // Update last active
      db.prepare("UPDATE users SET last_active_date = datetime('now') WHERE id = ?").run(user.id);

      // Create JWT and set cookie
      const jwtToken = createToken(user);
      setAuthCookie(res, jwtToken);

      return res.status(200).json({
        success: true,
        message: `Welcome back, ${user.full_name}!`,
        user: sanitizeUser(user),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, (req, res) => {
  try {
    const db = getDb();
    if (req.sessionId) {
      db.prepare('UPDATE sessions SET is_active = 0 WHERE id = ?').run(req.sessionId);
    }
    clearAuthCookie(res);
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    clearAuthCookie(res);
    return res.status(200).json({ success: true, message: 'Logged out.' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get('/me', authenticate, (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
});

/**
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const db = getDb();
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, full_name FROM users WHERE email = ?').get(normalizedEmail);

    // Constant message to prevent account enumeration
    const successResponse = {
      success: true,
      message: 'If an account exists with this email, instructions to reset your password have been generated.',
    };

    if (!user) {
      return res.status(200).json(successResponse);
    }

    // Generate reset token (expires in 1 hour)
    const resetToken = generateToken();
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO password_resets (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(generateId(), user.id, tokenHash, expiresAt);

    // Send email or log to console
    await sendPasswordReset(normalizedEmail, resetToken);

    // In development mode, return token so developer can test without an active SMTP server
    if (env.NODE_ENV === 'development') {
      return res.status(200).json({
        ...successResponse,
        devResetToken: resetToken,
      });
    }

    return res.status(200).json(successResponse);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/reset-password
 */
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const db = getDb();
    const tokenHash = hashToken(token);

    const resetRecord = db.prepare(`
      SELECT * FROM password_resets
      WHERE token_hash = ? AND used = 0 AND expires_at > datetime('now')
    `).get(tokenHash);

    if (!resetRecord) {
      return res.status(400).json({ error: 'Password reset link is invalid or has expired.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(password, salt);

    // Transaction: update password, mark reset used, revoke all sessions
    const updateTx = db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
        newPasswordHash,
        resetRecord.user_id
      );
      db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRecord.id);
      db.prepare('UPDATE sessions SET is_active = 0 WHERE user_id = ?').run(resetRecord.user_id);
    });

    updateTx();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

