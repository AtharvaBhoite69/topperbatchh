// =============================================================================
// TopperBatch - Notifications Routes
// =============================================================================

const express = require('express');
const router = express.Router();

const { getDb } = require('../database/db');
const { paginate } = require('../utils/helpers');
const { authenticate, requireApproved } = require('../middleware/auth');

router.use(authenticate, requireApproved);

/**
 * GET /api/notifications
 * List user's notifications
 */
router.get('/', (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const db = getDb();
    const { limit: l, offset: o } = paginate(page, limit);

    const total = db.prepare('SELECT COUNT(*) as total FROM notifications WHERE user_id = ?').get(req.user.id).total;

    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, l, o);

    return res.status(200).json({
      success: true,
      notifications,
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
 * GET /api/notifications/unread-count
 */
router.get('/unread-count', (req, res, next) => {
  try {
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(
      req.user.id
    ).count;

    return res.status(200).json({ success: true, count });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, req.user.id);
    return res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/notifications/read-all
 */
router.put('/read-all', (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    return res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

