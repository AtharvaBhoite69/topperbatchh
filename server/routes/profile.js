// =============================================================================
// TopperBatch - Student Profile Routes
// Production-Ready: Supabase PostgreSQL
// =============================================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { getDb } = require('../database/db');
const { generateId, sanitizeUser } = require('../utils/helpers');
const { authenticate, requireApproved } = require('../middleware/auth');

const avatarDir = process.env.VERCEL
  ? '/tmp/uploads/avatars'
  : path.join(__dirname, '..', 'uploads', 'avatars');
try {
  if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true });
  }
} catch (e) {
  console.warn('Avatars upload directory setup warning:', e.message);
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar_${generateId()}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
});

router.use(authenticate, requireApproved);

/**
 * GET /api/profile
 * Get logged-in student's full profile
 */
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Calculate current rank
    const rankRow = await db.prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM users
      WHERE role = 'student' AND status = 'approved' AND total_points > ?
    `).get(user.total_points || 0);

    // Get earned achievements
    const achievements = await db.prepare(`
      SELECT a.*, ua.earned_at
      FROM achievements a
      JOIN user_achievements ua ON a.id = ua.achievement_id
      WHERE ua.user_id = ?
    `).all(req.user.id);

    // Get recent activity (quiz attempts)
    const recentActivity = await db.prepare(`
      SELECT qa.id, qa.score, qa.total_correct, qa.submitted_at, c.title as challenge_title
      FROM quiz_attempts qa
      JOIN mcq_challenges c ON qa.challenge_id = c.id
      WHERE qa.user_id = ? AND qa.is_submitted = 1
      ORDER BY qa.submitted_at DESC
      LIMIT 5
    `).all(req.user.id);

    return res.status(200).json({
      success: true,
      profile: {
        ...sanitizeUser(user),
        rank: rankRow ? rankRow.rank : 1,
        achievements,
        recentActivity,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/profile
 * Update student profile permitted fields only
 */
router.put('/', async (req, res, next) => {
  try {
    const { full_name, semester, department, bio, avatar_url } = req.body;
    const db = getDb();

    await db.prepare(`
      UPDATE users
      SET full_name = COALESCE(?, full_name),
          semester = COALESCE(?, semester),
          department = COALESCE(?, department),
          bio = COALESCE(?, bio),
          avatar_url = COALESCE(?, avatar_url),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      full_name ? full_name.trim() : null,
      semester ? parseInt(semester, 10) : null,
      department ? department.trim() : null,
      bio ? bio.trim() : null,
      avatar_url || null,
      req.user.id
    );

    const updatedUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Profile updated!',
      profile: sanitizeUser(updatedUser),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/profile/:id
 * View peer student's public profile
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const user = await db.prepare(`
      SELECT id, full_name, avatar_url, semester, department, bio, total_points, study_streak, created_at
      FROM users
      WHERE id = ? AND status = 'approved'
    `).get(id);

    if (!user) return res.status(404).json({ error: 'Student profile not found.' });

    const rankRow = await db.prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM users
      WHERE role = 'student' AND status = 'approved' AND total_points > ?
    `).get(user.total_points || 0);

    const achievements = await db.prepare(`
      SELECT a.name, a.icon, a.badge_color, ua.earned_at
      FROM achievements a
      JOIN user_achievements ua ON a.id = ua.achievement_id
      WHERE ua.user_id = ?
    `).all(id);

    return res.status(200).json({
      success: true,
      profile: {
        ...user,
        rank: rankRow ? rankRow.rank : 1,
        achievements,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/profile/avatar
 * Upload avatar image
 */
router.post('/avatar', uploadAvatar.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

    const avatarUrl = `/api/profile/avatar-file/${req.file.filename}`;
    const db = getDb();
    await db.prepare("UPDATE users SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?").run(avatarUrl, req.user.id);

    return res.status(200).json({ success: true, avatarUrl });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/profile/avatar-file/:filename
 * Serve avatar image
 */
router.get('/avatar-file/:filename', (req, res) => {
  const filePath = path.join(avatarDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Avatar not found');
  }
});

/**
 * POST /api/profile/screenshot-attempt
 * Log a detected screenshot / screen-capture attempt by the authenticated user
 */
router.post('/screenshot-attempt', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const { path: pagePath = null, method = 'detected' } = req.body || {};

    await db
      .prepare(
        `INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details, ip_address)
         VALUES (?, ?, 'SCREENSHOT_ATTEMPT', 'user', ?, ?, ?)`
      )
      .run(
        generateId(),
        req.user.id,
        req.user.id,
        JSON.stringify({
          path: typeof pagePath === 'string' ? pagePath.slice(0, 200) : null,
          method: typeof method === 'string' ? method.slice(0, 60) : 'detected',
        }),
        req.ip || null
      );

    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
