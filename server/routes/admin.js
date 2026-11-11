// =============================================================================
// TopperBatch - Admin Routes
// Production-Ready: Supabase PostgreSQL
// =============================================================================

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();

const env = require('../config/env');
const { getDb } = require('../database/db');
const { generateId, paginate, sanitizeUser } = require('../utils/helpers');
const { authenticate, requireAdmin } = require('../middleware/auth');
const {
  sendEmail,
  sendBatchUpdateEmail,
  sendApprovalNotification,
  sendRejectionNotification,
  resetTransporter,
  getSmtpConfig,
} = require('../services/email');

// All routes require authentication and admin role
router.use(authenticate, requireAdmin);

/**
 * Middleware requiring Control Room passcode verification via short-lived token.
 */
function requireControlRoomUnlock(req, res, next) {
  const unlockToken = req.headers['x-control-room-token'];
  if (!unlockToken) {
    return res.status(423).json({
      error: 'Control Room is locked. Passcode required.',
      locked: true,
    });
  }

  try {
    const decoded = jwt.verify(unlockToken, env.JWT_SECRET);
    if (decoded.scope !== 'control_room' || decoded.userId !== req.user.id) {
      return res.status(423).json({
        error: 'Control Room lock session invalid. Please re-enter passcode.',
        locked: true,
      });
    }
    return next();
  } catch (err) {
    return res.status(423).json({
      error: 'Control Room lock expired. Please re-enter passcode.',
      locked: true,
    });
  }
}

/**
 * POST /api/admin/control-room/unlock
 * Verify Control Room passcode and issue a temporary unlock token.
 */
router.post('/control-room/unlock', async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Control Room password is required.' });
    }

    const expected = String(env.CONTROL_ROOM_PASSWORD || '');
    const providedHash = crypto.createHash('sha256').update(password).digest();
    const expectedHash = crypto.createHash('sha256').update(expected).digest();

    if (!crypto.timingSafeEqual(providedHash, expectedHash)) {
      await logAudit(req.user.id, 'CONTROL_ROOM_UNLOCK_FAILED', 'control_room', null, null, req);
      return res.status(403).json({ error: 'Incorrect Control Room password.' });
    }

    const unlockToken = jwt.sign(
      { userId: req.user.id, scope: 'control_room' },
      env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    await logAudit(req.user.id, 'CONTROL_ROOM_UNLOCKED', 'control_room', null, null, req);

    return res.status(200).json({
      success: true,
      unlockToken,
      message: 'Control Room unlocked.',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Helper to log admin actions into audit_logs table
 */
async function logAudit(adminId, action, targetType, targetId, details, req) {
  try {
    const db = getDb();
    const ip = req ? (req.ip || req.connection?.remoteAddress || '127.0.0.1') : null;
    await db.prepare(`
      INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(),
      adminId,
      action,
      targetType || null,
      targetId || null,
      details ? JSON.stringify(details) : null,
      ip
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

/**
 * GET /api/admin/stats
 * Real database counts
 */
router.get('/stats', async (req, res, next) => {
  try {
    const db = getDb();

    const totalStudentsRow = await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get();
    const totalStudents = totalStudentsRow ? parseInt(totalStudentsRow.count, 10) : 0;

    const approvedStudentsRow = await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND status = 'approved'").get();
    const approvedStudents = approvedStudentsRow ? parseInt(approvedStudentsRow.count, 10) : 0;

    const pendingStudentsRow = await db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'pending'").get();
    const pendingStudents = pendingStudentsRow ? parseInt(pendingStudentsRow.count, 10) : 0;

    const suspendedStudentsRow = await db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'suspended'").get();
    const suspendedStudents = suspendedStudentsRow ? parseInt(suspendedStudentsRow.count, 10) : 0;

    const totalDocumentsRow = await db.prepare('SELECT COUNT(*) as count FROM documents').get();
    const totalDocuments = totalDocumentsRow ? parseInt(totalDocumentsRow.count, 10) : 0;

    const totalQuizAttemptsRow = await db.prepare('SELECT COUNT(*) as count FROM quiz_attempts WHERE is_submitted = 1').get();
    const totalQuizAttempts = totalQuizAttemptsRow ? parseInt(totalQuizAttemptsRow.count, 10) : 0;

    const activeTodayRow = await db.prepare("SELECT COUNT(DISTINCT user_id) as count FROM sessions WHERE is_active = 1 AND date(created_at) = date('now')").get();
    const activeToday = activeTodayRow ? parseInt(activeTodayRow.count, 10) : 0;

    const totalAnnouncementsRow = await db.prepare('SELECT COUNT(*) as count FROM announcements WHERE is_active = 1').get();
    const totalAnnouncements = totalAnnouncementsRow ? parseInt(totalAnnouncementsRow.count, 10) : 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        approvedStudents,
        pendingStudents,
        suspendedStudents,
        totalDocuments,
        totalQuizAttempts,
        activeToday,
        totalAnnouncements,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/registrations
 * List pending registrations
 */
router.get('/registrations', async (req, res, next) => {
  try {
    const db = getDb();
    const pending = await db.prepare(`
      SELECT id, email, full_name, semester, department, created_at
      FROM users
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `).all();

    return res.status(200).json({ success: true, registrations: pending });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/registrations/:id/approve
 */
router.put('/registrations/:id/approve', async (req, res, next) => {
  req.body = { ...req.body, action: 'approve' };
  return handleRegistrationAction(req, res, next);
});

/**
 * PUT /api/admin/registrations/:id/reject
 */
router.put('/registrations/:id/reject', async (req, res, next) => {
  req.body = { ...req.body, action: 'reject' };
  return handleRegistrationAction(req, res, next);
});

/**
 * PUT /api/admin/registrations/:id
 * Approve or Reject a registration
 */
router.put('/registrations/:id', handleRegistrationAction);

async function handleRegistrationAction(req, res, next) {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // 'approve' | 'reject'
    const db = getDb();

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "Action must be 'approve' or 'reject'." });
    }

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await db.prepare('UPDATE users SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newStatus, id);

    // Create user notification
    await db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, link)
      VALUES (?, ?, 'account', ?, ?, ?)
    `).run(
      generateId(),
      id,
      action === 'approve' ? '🎉 Welcome to TopperBatch!' : 'Registration Status Update',
      action === 'approve'
        ? 'Your account has been approved by an administrator! You can now access all features. ISS SEM, 9 POINTER FIX!'
        : `Your registration request was not approved. ${reason ? 'Reason: ' + reason : ''}`,
      action === 'approve' ? '/dashboard' : '/login'
    );

    // Audit log
    await logAudit(
      req.user.id,
      action === 'approve' ? 'APPROVE_USER' : 'REJECT_USER',
      'user',
      id,
      { email: user.email, name: user.full_name, reason },
      req
    );

    // Attempt email notification gracefully
    try {
      if (action === 'approve') {
        await sendApprovalNotification(user.email, user.full_name);
      } else {
        await sendRejectionNotification(user.email, user.full_name);
      }
    } catch (emailErr) {
      console.warn('Student status notification email warning:', emailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `User ${user.full_name} has been ${newStatus}.`,
      status: newStatus,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/students
 * List all students with search & status filters
 */
router.get('/students', async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const db = getDb();
    const { limit: l, offset: o } = paginate(page, limit);

    let whereConditions = ["role = 'student'"];
    let params = [];

    if (status && status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (search) {
      whereConditions.push('(full_name LIKE ? OR email LIKE ? OR department LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = whereConditions.join(' AND ');

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM users WHERE ${whereClause}`);
    const countRow = await countStmt.get(...params);
    const total = countRow ? parseInt(countRow.total, 10) : 0;

    const studentsStmt = db.prepare(`
      SELECT id, email, full_name, role, status, semester, department, total_points, study_streak, last_active_date, created_at
      FROM users
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const students = await studentsStmt.all(...params, l, o);

    return res.status(200).json({
      success: true,
      students,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: l,
        pages: Math.ceil(total / l),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/students/:id
 * Detailed student profile + history
 */
router.get('/students/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const attempts = await db.prepare(`
      SELECT a.*, c.title as challenge_title
      FROM quiz_attempts a
      LEFT JOIN mcq_challenges c ON a.challenge_id = c.id
      WHERE a.user_id = ?
      ORDER BY a.started_at DESC
      LIMIT 10
    `).all(id);

    const sessions = await db.prepare(`
      SELECT id, device_info, ip_address, is_active, created_at, expires_at
      FROM sessions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(id);

    const auditLogs = await db.prepare(`
      SELECT * FROM audit_logs
      WHERE target_id = ? OR (target_type = 'user' AND target_id = ?)
      ORDER BY created_at DESC
      LIMIT 10
    `).all(id, id);

    return res.status(200).json({
      success: true,
      student: sanitizeUser(user),
      attempts,
      sessions,
      auditLogs,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/students/:id/status
 * Suspend, reactivate or update status
 */
router.put('/students/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const db = getDb();

    if (!['approved', 'suspended', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    // Do not allow modifying status of permanent admins
    if (user.role === 'admin') {
      return res.status(403).json({ error: 'Cannot modify status of an administrator.' });
    }

    await db.prepare('UPDATE users SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, id);

    // If suspended, deactivate all active sessions immediately
    if (status === 'suspended') {
      await db.prepare('UPDATE sessions SET is_active = 0 WHERE user_id = ?').run(id);
    }

    await logAudit(req.user.id, `UPDATE_STATUS_${status.toUpperCase()}`, 'user', id, { email: user.email, reason }, req);

    return res.status(200).json({
      success: true,
      message: `Student status updated to ${status}.`,
      status,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/sessions/user/:userId
 */
router.delete('/sessions/user/:userId', async (req, res, next) => {
  req.params.id = req.params.userId;
  try {
    const { id } = req.params;
    const db = getDb();
    const info = await db.prepare('UPDATE sessions SET is_active = 0 WHERE user_id = ?').run(id);
    await logAudit(req.user.id, 'REVOKE_USER_SESSIONS', 'user', id, { count: info.changes }, req);
    return res.status(200).json({
      success: true,
      message: `Revoked ${info.changes} active session(s).`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/students/:id/sessions
 * Revoke all sessions for a student
 */
router.delete('/students/:id/sessions', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const info = await db.prepare('UPDATE sessions SET is_active = 0 WHERE user_id = ?').run(id);
    await logAudit(req.user.id, 'REVOKE_USER_SESSIONS', 'user', id, { count: info.changes }, req);

    return res.status(200).json({
      success: true,
      message: `Revoked ${info.changes} active session(s).`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/audit-logs
 */
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { page = 1, limit = 30, action } = req.query;
    const db = getDb();
    const { limit: l, offset: o } = paginate(page, limit);

    let whereClause = '';
    let params = [];

    if (action) {
      whereClause = 'WHERE a.action LIKE ?';
      params.push(`%${action}%`);
    }

    const countRow = await db.prepare(`SELECT COUNT(*) as total FROM audit_logs a ${whereClause}`).get(...params);
    const total = countRow ? parseInt(countRow.total, 10) : 0;

    const logs = await db.prepare(`
      SELECT a.*, u.full_name as admin_name, u.email as admin_email
      FROM audit_logs a
      LEFT JOIN users u ON a.admin_id = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, l, o);

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: l,
        pages: Math.ceil(total / l),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/announcements
 */
router.post('/announcements', async (req, res, next) => {
  try {
    const { title, content, priority = 'normal', expiresAt, sendEmail: shouldEmail = false, audience = 'approved' } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const db = getDb();
    const announcementId = generateId();

    await db.prepare(`
      INSERT INTO announcements (id, title, content, priority, created_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(announcementId, title.trim(), content.trim(), priority, req.user.id, expiresAt || null);

    // Notify all approved students in-app
    const students = await db.prepare("SELECT id, email FROM users WHERE status = 'approved'").all();
    const notifyStmt = db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, link)
      VALUES (?, ?, 'announcement', ?, ?, '/dashboard')
    `);

    for (const student of students) {
      await notifyStmt.run(generateId(), student.id, `📢 ${title}`, content.slice(0, 100));
    }

    let emailResult = null;
    if (shouldEmail) {
      let recipientRows = students;
      if (audience === 'all') {
        recipientRows = await db.prepare("SELECT email FROM users WHERE status IN ('approved', 'pending')").all();
      }
      const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
      emailResult = await sendBatchUpdateEmail({
        recipients: recipientRows.map((r) => r.email),
        subject: `[TopperBatch] ${title.trim()}`,
        title: title.trim(),
        message: content.trim(),
        ctaUrl: `${origin}/dashboard`,
      });
    }

    await logAudit(
      req.user.id,
      'CREATE_ANNOUNCEMENT',
      'announcement',
      announcementId,
      { title, priority, sendEmail: Boolean(shouldEmail), emailSentCount: emailResult?.sentCount || 0 },
      req
    );

    return res.status(201).json({
      success: true,
      message: emailResult && !emailResult.skipped
        ? `Announcement published & emailed to ${emailResult.sentCount} registered user(s)!`
        : emailResult?.skipped
          ? `Announcement published in-app! (Email skipped: ${emailResult.error})`
          : 'Announcement published to batch!',
      announcementId,
      emailResult,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/email-broadcast
 * Send a direct email update to registered users on their registered email IDs.
 */
router.post('/email-broadcast', async (req, res, next) => {
  try {
    const { subject, title, message, audience = 'approved' } = req.body;
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Email subject and message are required.' });
    }

    const db = getDb();
    let query = "SELECT email FROM users WHERE status = 'approved'";
    if (audience === 'all') {
      query = "SELECT email FROM users WHERE status IN ('approved', 'pending')";
    } else if (audience === 'pending') {
      query = "SELECT email FROM users WHERE status = 'pending'";
    }

    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const rows = await db.prepare(query).all();
    const result = await sendBatchUpdateEmail({
      recipients: rows.map((r) => r.email),
      subject: subject.trim(),
      title: (title || subject).trim(),
      message: message.trim(),
      ctaUrl: `${origin}/dashboard`,
    });

    await logAudit(
      req.user.id,
      'SEND_EMAIL_BROADCAST',
      'email',
      null,
      { subject: subject.trim(), audience, totalRecipients: result.totalRecipients, sentCount: result.sentCount },
      req
    );

    if (result.skipped) {
      return res.status(400).json({
        error: result.error || 'Email could not be sent. Check SMTP settings in Control Room.',
        result,
      });
    }

    if (result.sentCount === 0 && result.error) {
      return res.status(502).json({
        error: `SMTP Error: ${result.error}`,
        result,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Update emailed to ${result.sentCount} registered user(s)!`,
      result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/email-test
 * Send a test email to the logged-in admin to verify SMTP configuration.
 */
router.post('/email-test', requireControlRoomUnlock, async (req, res, next) => {
  try {
    const cfg = await getSmtpConfig();
    if (!cfg.host || !cfg.user || !cfg.pass) {
      return res.status(400).json({
        error: 'SMTP settings are incomplete. Please fill SMTP Host, Sender Email, and App Password and save first.',
      });
    }

    const info = await sendEmail(
      req.user.email,
      'TopperBatch Email Configuration Test',
      `<div style="font-family: Arial, sans-serif; padding: 16px; border: 2px solid #171510; background: #F5E9D1;">
        <h2 style="margin-top:0;">TopperBatch Email Service Working</h2>
        <p>Hi ${req.user.full_name},</p>
        <p>Your SMTP configuration (${cfg.from}) is verified. You can now send updates directly to registered users' email IDs.</p>
      </div>`,
      `Hi ${req.user.full_name},\n\nYour TopperBatch SMTP configuration (${cfg.from}) is verified. You can now send updates directly to registered users' email IDs.`
    );

    if (info?.skipped || info?.error) {
      return res.status(502).json({
        error: info?.error || 'Failed to send test email.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Test email sent to ${req.user.email}! Check Primary, Updates, or Spam folder.`,
      sentTo: req.user.email,
      messageId: info.messageId,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/announcements
 */
router.get('/announcements', async (req, res, next) => {
  try {
    const db = getDb();
    const announcements = await db.prepare(`
      SELECT a.*, u.full_name as author_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
    `).all();

    return res.status(200).json({ success: true, announcements });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/announcements/:id
 */
router.put('/announcements/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, priority, isActive } = req.body;
    const db = getDb();

    await db.prepare(`
      UPDATE announcements
      SET title = COALESCE(?, title),
          content = COALESCE(?, content),
          priority = COALESCE(?, priority),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(title, content, priority, isActive !== undefined ? (isActive ? 1 : 0) : null, id);

    await logAudit(req.user.id, 'UPDATE_ANNOUNCEMENT', 'announcement', id, { title }, req);

    return res.status(200).json({ success: true, message: 'Announcement updated.' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/announcements/:id
 */
router.delete('/announcements/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
    await logAudit(req.user.id, 'DELETE_ANNOUNCEMENT', 'announcement', id, null, req);
    return res.status(200).json({ success: true, message: 'Announcement removed.' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/settings
 */
router.get('/settings', requireControlRoomUnlock, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db.prepare('SELECT key, value FROM platform_settings').all();
    const settings = {};
    let smtpPassConfigured = false;
    for (const r of rows) {
      if (r.key === 'smtp_pass') {
        smtpPassConfigured = Boolean(r.value);
        settings.smtp_pass = '';
      } else {
        settings[r.key] = r.value;
      }
    }

    const activeSmtp = await getSmtpConfig();
    return res.status(200).json({
      success: true,
      settings,
      meta: {
        smtp_pass_configured: smtpPassConfigured,
        smtp_ready: Boolean(activeSmtp.host && activeSmtp.user && activeSmtp.pass),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/settings
 */
router.put('/settings', requireControlRoomUnlock, async (req, res, next) => {
  try {
    const settings = req.body || {};
    const db = getDb();

    const upsertStmt = db.prepare(`
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `);

    const auditSafeSettings = {};
    for (const [k, v] of Object.entries(settings)) {
      // Preserve existing SMTP password if admin leaves the masked password field blank
      if (k === 'smtp_pass' && !String(v || '').trim()) {
        continue;
      }
      await upsertStmt.run(k, String(v));
      auditSafeSettings[k] = k === 'smtp_pass' ? '***REDACTED***' : String(v);
    }

    resetTransporter();
    await logAudit(req.user.id, 'UPDATE_SETTINGS', 'platform_settings', null, auditSafeSettings, req);

    return res.status(200).json({ success: true, message: 'Platform settings saved.' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/sessions
 */
router.get('/sessions', async (req, res, next) => {
  try {
    const db = getDb();
    const sessions = await db.prepare(`
      SELECT s.id, s.user_id, s.device_info, s.ip_address, s.is_active, s.created_at, s.expires_at,
             u.full_name, u.email, u.role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.is_active = 1 AND s.expires_at > datetime('now')
      ORDER BY s.created_at DESC
      LIMIT 100
    `).all();

    return res.status(200).json({ success: true, sessions });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/sessions/:id
 */
router.delete('/sessions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.prepare('UPDATE sessions SET is_active = 0 WHERE id = ?').run(id);
    await logAudit(req.user.id, 'REVOKE_SESSION', 'session', id, null, req);
    return res.status(200).json({ success: true, message: 'Session terminated.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
