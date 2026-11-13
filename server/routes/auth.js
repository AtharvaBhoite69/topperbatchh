// =============================================================================
// TopperBatch - Authentication Routes
// Production-Ready: Supabase PostgreSQL & Session Management
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
const { sendPasswordReset, sendVerificationOtp } = require('../services/email');

/**
 * Helper to ensure email_verifications table exists in database
 */
async function ensureEmailVerificationsTable(db) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        verified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
  } catch (_) {}
}

/**
 * Helper to check if an email belongs to a permanent admin
 */
function isPermanentAdmin(email) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return env.ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalized);
}

/**
 * POST /api/auth/send-otp
 * Send a 6-digit OTP to student's Gmail to verify ownership before registration
 */
router.post('/send-otp', authLimiter, async (req, res, next) => {
  try {
    const { email, fullName } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Gmail address is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const db = getDb();
    await ensureEmailVerificationsTable(db);

    // Check if user already exists
    const existingUser = await db.prepare('SELECT id, status FROM users WHERE email = ?').get(normalizedEmail);
    if (existingUser) {
      if (existingUser.status === 'approved') {
        return res.status(400).json({
          error: 'This Gmail address is already registered. Please log in directly.',
          isExisting: true,
        });
      }
      return res.status(400).json({
        error: 'A registration request for this Gmail is already submitted and pending admin approval.',
        isPending: true,
      });
    }

    // Rate limiting: check recent OTP sent to this email within last 3 minutes (180 seconds)
    const recentOtp = await db.prepare(`
      SELECT created_at FROM email_verifications
      WHERE email = ? AND verified = 0
      ORDER BY created_at DESC
      LIMIT 1
    `).get(normalizedEmail);

    if (recentOtp?.created_at) {
      const createdTime = new Date(recentOtp.created_at).getTime();
      const secondsSince = (Date.now() - createdTime) / 1000;
      if (secondsSince < 180) {
        const waitSec = Math.ceil(180 - secondsSince);
        const waitMin = Math.floor(waitSec / 60);
        const waitRemainderSec = waitSec % 60;
        const timeText = waitMin > 0 ? `${waitMin}m ${waitRemainderSec}s` : `${waitSec}s`;
        return res.status(429).json({
          error: `Please wait ${timeText} before requesting a new code.`,
          retryAfter: waitSec,
        });
      }
    }

    // Generate random 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await db.prepare(`
      INSERT INTO email_verifications (id, email, otp_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(generateId(), normalizedEmail, otpHash, expiresAt);

    // Send email via Brevo / SMTP
    const emailRes = await sendVerificationOtp(normalizedEmail, otp, fullName);

    if (emailRes?.skipped) {
      console.warn(`[OTP Skipped] SMTP not configured. OTP for ${normalizedEmail}: ${otp}`);
    }

    return res.status(200).json({
      success: true,
      message: `6-digit verification code sent to ${normalizedEmail}! Check Inbox or Spam.`,
      email: normalizedEmail,
      devOtp: env.NODE_ENV === 'development' || emailRes?.skipped ? otp : undefined,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/register
 * Student registration flow with Gmail OTP verification.
 * Admin emails are auto-approved as admins; others are created as 'pending'.
 */
router.post(
  '/register',
  authLimiter,
  registerValidation,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { email, password, fullName, semester, department, otp } = req.body;
      const db = getDb();
      await ensureEmailVerificationsTable(db);
      const normalizedEmail = email.trim().toLowerCase();

      // Check if user already exists
      const existingUser = await db.prepare('SELECT id, status FROM users WHERE email = ?').get(normalizedEmail);
      if (existingUser) {
        if (existingUser.status === 'approved') {
          return res.status(400).json({ error: 'This Gmail address is already registered. Please log in.' });
        }
        return res.status(400).json({
          error: 'A registration request for this Gmail is already submitted and pending admin approval.',
        });
      }

      const isAdmin = isPermanentAdmin(normalizedEmail);

      // Verify OTP for student registrations (guarantees Gmail ownership)
      if (!isAdmin) {
        if (!otp || !String(otp).trim()) {
          return res.status(400).json({
            error: 'Please enter the 6-digit verification code sent to your Gmail.',
          });
        }

        const cleanOtp = String(otp).trim();
        const nowIso = new Date().toISOString();
        const otpRecord = await db.prepare(`
          SELECT * FROM email_verifications
          WHERE email = ? AND verified = 0 AND expires_at > ?
          ORDER BY created_at DESC
          LIMIT 1
        `).get(normalizedEmail, nowIso);

        if (!otpRecord) {
          return res.status(400).json({
            error: 'Verification code expired or not found. Please click "Resend Code" to receive a new OTP.',
          });
        }

        if (otpRecord.attempts >= 5) {
          return res.status(400).json({
            error: 'Too many incorrect attempts. Please request a new verification code.',
          });
        }

        const inputHash = hashToken(cleanOtp);
        if (inputHash !== otpRecord.otp_hash) {
          await db
            .prepare('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?')
            .run(otpRecord.id);
          const remaining = 5 - (otpRecord.attempts + 1);
          return res.status(400).json({
            error: `Invalid verification code. ${
              remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Please request a new code.'
            }`,
          });
        }

        // Mark OTP as verified
        await db.prepare('UPDATE email_verifications SET verified = 1 WHERE id = ?').run(otpRecord.id);
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const userId = generateId();
      const role = isAdmin ? 'admin' : 'student';
      const status = isAdmin ? 'approved' : 'pending';

      const insertStmt = db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, role, status, semester, department)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await insertStmt.run(
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
        const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
        const notifyStmt = db.prepare(`
          INSERT INTO notifications (id, user_id, type, title, message, link)
          VALUES (?, ?, 'registration', 'New Recruit Pending Approval', ?, '/admin/registrations')
        `);

        for (const admin of admins) {
          await notifyStmt.run(
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
      let user = await db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
      if (!user) {
        // Auto-provision permanent admin on first login with default admin password
        if (isPermanentAdmin(normalizedEmail) && password === 'Donkey@6769') {
          const salt = await bcrypt.genSalt(10);
          const passwordHash = await bcrypt.hash(password, salt);
          const adminId = generateId();
          const defaultName = normalizedEmail.split('@')[0];

          await db.prepare(`
            INSERT INTO users (id, email, password_hash, full_name, role, status, semester, department, total_points, study_streak)
            VALUES (?, ?, ?, ?, 'admin', 'approved', 7, 'Computer Engineering', 0, 0)
          `).run(adminId, normalizedEmail, passwordHash, defaultName);

          user = await db.prepare('SELECT * FROM users WHERE id = ?').get(adminId);
        } else {
          return res.status(401).json({ error: 'Invalid email or password.' });
        }
      }

      // Check permanent admin auto-promotion
      if (isPermanentAdmin(normalizedEmail)) {
        if (user.role !== 'admin' || user.status !== 'approved') {
          await db.prepare("UPDATE users SET role = 'admin', status = 'approved' WHERE id = ?").run(user.id);
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
      const setting = await db.prepare("SELECT value FROM platform_settings WHERE key = 'max_sessions_per_user'").get();
      const maxSessions = setting ? parseInt(setting.value, 10) : 1;

      const activeSessions = await db.prepare(
        "SELECT id FROM sessions WHERE user_id = ? AND is_active = 1 ORDER BY created_at ASC"
      ).all(user.id);

      if (activeSessions.length >= maxSessions) {
        // Deactivate oldest sessions to respect max session limit
        const toRevoke = activeSessions.slice(0, activeSessions.length - maxSessions + 1);
        const deactivateStmt = db.prepare("UPDATE sessions SET is_active = 0 WHERE id = ?");
        for (const s of toRevoke) {
          await deactivateStmt.run(s.id);
        }
      }

      // Create new session
      const sessionId = generateId();
      const rawToken = generateToken();
      const tokenHash = hashToken(rawToken);
      const userAgent = req.headers['user-agent'] || 'Unknown Device';
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';

      // 7 days expiration
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await db.prepare(`
        INSERT INTO sessions (id, user_id, token_hash, device_info, ip_address, is_active, expires_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `).run(sessionId, user.id, tokenHash, userAgent, ipAddress, expiresAt);

      // Update last active
      await db.prepare("UPDATE users SET last_active_date = datetime('now') WHERE id = ?").run(user.id);

      // Create JWT and set cookie
      const jwtToken = createToken(user);
      setAuthCookie(res, jwtToken);

      return res.status(200).json({
        success: true,
        message: `Welcome back, ${user.full_name}!`,
        token: jwtToken,
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
router.post('/logout', authenticate, async (req, res) => {
  try {
    const db = getDb();
    if (req.sessionId) {
      await db.prepare('UPDATE sessions SET is_active = 0 WHERE id = ?').run(req.sessionId);
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
    const user = await db.prepare('SELECT id, full_name FROM users WHERE email = ?').get(normalizedEmail);

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

    await db.prepare(`
      INSERT INTO password_resets (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(generateId(), user.id, tokenHash, expiresAt);

    // Send email or log to console
    await sendPasswordReset(normalizedEmail, resetToken, req.get('origin'));

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
    const nowIso = new Date().toISOString();

    const resetRecord = await db.prepare(`
      SELECT * FROM password_resets
      WHERE token_hash = ? AND used = 0 AND expires_at > ?
    `).get(tokenHash, nowIso);

    if (!resetRecord) {
      return res.status(400).json({ error: 'Password reset link is invalid or has expired.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(password, salt);

    await db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      newPasswordHash,
      resetRecord.user_id
    );
    await db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRecord.id);
    await db.prepare('UPDATE sessions SET is_active = 0 WHERE user_id = ?').run(resetRecord.user_id);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
