// =============================================================================
// TopperBatch - Global Search Routes
// =============================================================================

const express = require('express');
const router = express.Router();

const { getDb } = require('../database/db');
const { authenticate, requireApproved } = require('../middleware/auth');

router.use(authenticate, requireApproved);

/**
 * GET /api/search
 * Global search across documents, community messages, announcements, and students
 */
router.get('/', (req, res, next) => {
  try {
    const { q, type } = req.query;

    if (!q || !q.trim()) {
      return res.status(200).json({
        success: true,
        results: { documents: [], discussions: [], announcements: [], students: [] },
      });
    }

    const searchTerm = `%${q.trim()}%`;
    const db = getDb();

    let results = { documents: [], discussions: [], announcements: [], students: [] };

    // Search Documents
    if (!type || type === 'documents' || type === 'all') {
      results.documents = db.prepare(`
        SELECT d.id, d.title, d.description, d.topic, s.name as subject_name, sem.name as semester_name
        FROM documents d
        LEFT JOIN subjects s ON d.subject_id = s.id
        LEFT JOIN semesters sem ON d.semester_id = sem.id
        WHERE d.is_visible = 1 AND (d.title LIKE ? OR d.description LIKE ? OR d.topic LIKE ?)
        LIMIT 10
      `).all(searchTerm, searchTerm, searchTerm);
    }

    // Search Discussions
    if (!type || type === 'discussions' || type === 'all') {
      results.discussions = db.prepare(`
        SELECT m.id, m.content, m.created_at, c.id as channel_id, c.name as channel_name, u.full_name as author_name
        FROM community_messages m
        JOIN community_channels c ON m.channel_id = c.id
        JOIN users u ON m.user_id = u.id
        WHERE m.is_deleted = 0 AND m.content LIKE ?
        LIMIT 10
      `).all(searchTerm);
    }

    // Search Announcements
    if (!type || type === 'announcements' || type === 'all') {
      results.announcements = db.prepare(`
        SELECT id, title, content, priority, created_at
        FROM announcements
        WHERE is_active = 1 AND (title LIKE ? OR content LIKE ?)
        LIMIT 5
      `).all(searchTerm, searchTerm);
    }

    // Search Students (Approved only)
    if (!type || type === 'students' || type === 'all') {
      results.students = db.prepare(`
        SELECT id, full_name, avatar_url, semester, department, total_points
        FROM users
        WHERE status = 'approved' AND role = 'student' AND (full_name LIKE ? OR department LIKE ?)
        LIMIT 10
      `).all(searchTerm, searchTerm);
    }

    return res.status(200).json({ success: true, query: q, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

