// =============================================================================
// TopperBatch - Community & Channels Routes
// Exactly Three Channels: Announcements, Exam Discussion, Notes & Resources
// =============================================================================

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { getDb } = require('../database/db');
const { generateId, paginate } = require('../utils/helpers');
const { authenticate, requireApproved, requireAdmin } = require('../middleware/auth');
const env = require('../config/env');

// Ensure community uploads folder exists (using /tmp on Vercel)
const uploadsDir = process.env.VERCEL
  ? '/tmp/uploads/community'
  : path.join(__dirname, '..', 'uploads', 'community');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn('Community uploads directory setup warning:', e.message);
}

// Multer storage for community file attachments (Notes & Resources)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const unique = `${Date.now()}-${generateId().slice(0, 8)}`;
    cb(null, `${cleanBase}-${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx', '.zip', '.png', '.jpg', '.jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, TXT, PPT, PPTX, ZIP, PNG, JPG'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
});

function logAdminAction(db, adminId, action, details) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (id, admin_id, action, details)
      VALUES (?, ?, ?, ?)
    `).run(generateId(), adminId, action, typeof details === 'string' ? details : JSON.stringify(details));
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

// All community routes require active approved user
router.use(authenticate, requireApproved);

/**
 * GET /api/community/channels
 * List all 3 community channels strictly in display_order
 */
router.get('/channels', (req, res, next) => {
  try {
    const db = getDb();
    const channels = db.prepare(`
      SELECT c.*,
             (SELECT COUNT(*) FROM community_messages m WHERE m.channel_id = c.id AND m.is_deleted = 0) as message_count
      FROM community_channels c
      ORDER BY c.display_order ASC, c.name ASC
    `).all();

    return res.status(200).json({ success: true, channels });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/community/channels/:id/messages
 * Get paginated messages for a channel
 */
router.get('/channels/:id/messages', (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const db = getDb();
    const { limit: l, offset: o } = paginate(page, limit);

    // Verify channel exists
    const channel = db.prepare('SELECT * FROM community_channels WHERE id = ?').get(id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found.' });
    }

    const messages = db.prepare(`
      SELECT m.*, u.full_name as author_name, u.avatar_url as author_avatar, u.role as author_role, u.email as author_email,
             reply_user.full_name as reply_to_author, reply_msg.content as reply_to_snippet
      FROM community_messages m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN community_messages reply_msg ON m.reply_to_id = reply_msg.id
      LEFT JOIN users reply_user ON reply_msg.user_id = reply_user.id
      WHERE m.channel_id = ? AND m.is_deleted = 0
      ORDER BY m.is_pinned DESC, m.created_at ASC
      LIMIT ? OFFSET ?
    `).all(id, l, o);

    // Fetch reactions for these messages
    const messageIds = messages.map((m) => m.id);
    let reactionsMap = {};

    if (messageIds.length > 0) {
      const placeholders = messageIds.map(() => '?').join(',');
      const reactions = db.prepare(`
        SELECT r.message_id, r.emoji, r.user_id, u.full_name
        FROM message_reactions r
        JOIN users u ON r.user_id = u.id
        WHERE r.message_id IN (${placeholders})
      `).all(...messageIds);

      for (const r of reactions) {
        if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = {};
        if (!reactionsMap[r.message_id][r.emoji]) {
          reactionsMap[r.message_id][r.emoji] = { count: 0, users: [], hasReacted: false };
        }
        reactionsMap[r.message_id][r.emoji].count++;
        reactionsMap[r.message_id][r.emoji].users.push(r.full_name);
        if (r.user_id === req.user.id) {
          reactionsMap[r.message_id][r.emoji].hasReacted = true;
        }
      }
    }

    const formattedMessages = messages.map((m) => ({
      ...m,
      reactions: reactionsMap[m.id] || {},
    }));

    return res.status(200).json({
      success: true,
      channel,
      messages: formattedMessages,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/community/channels/:id/messages
 * Send a message to a channel (with strict Announcements permissions enforcement)
 */
router.post('/channels/:id/messages', (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, reply_to_id, attachment_url, attachment_name, attachment_size, attachment_type } = req.body;

    if ((!content || !content.trim()) && !attachment_url) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const db = getDb();
    const channel = db.prepare('SELECT * FROM community_channels WHERE id = ?').get(id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found.' });
    }

    // STRICT PERMISSION CHECK: Announcements Channel
    if (channel.name === 'Announcements') {
      const isPermanentAdmin = req.user.role === 'admin' && env.ADMIN_EMAILS.includes(req.user.email);
      if (!isPermanentAdmin) {
        return res.status(403).json({
          error: 'Access denied: Only permanent administrators can post in the Announcements channel.',
        });
      }
      if (reply_to_id) {
        return res.status(400).json({
          error: 'Replies are disabled in the Announcements channel.',
        });
      }
    }

    const msgId = generateId();

    db.prepare(`
      INSERT INTO community_messages (
        id, channel_id, user_id, content, reply_to_id, attachment_url, attachment_name, attachment_size, attachment_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msgId,
      id,
      req.user.id,
      (content || '').trim(),
      reply_to_id || null,
      attachment_url || null,
      attachment_name || null,
      attachment_size || null,
      attachment_type || null
    );

    const savedMessage = db.prepare(`
      SELECT m.*, u.full_name as author_name, u.avatar_url as author_avatar, u.role as author_role, u.email as author_email
      FROM community_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `).get(msgId);

    const fullMessage = { ...savedMessage, reactions: {} };

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(id).emit('new_message', fullMessage);
    }

    // If admin posted an announcement, record in audit logs
    if (channel.name === 'Announcements') {
      logAdminAction(db, req.user.id, 'create_announcement', {
        channel: channel.name,
        messageId: msgId,
        snippet: (content || '').slice(0, 100),
      });
    }

    return res.status(201).json({ success: true, message: fullMessage });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/community/channels/:id/upload
 * Upload a resource/attachment to a channel (Notes & Resources)
 */
router.post('/channels/:id/upload', upload.single('file'), (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Please attach a valid file (PDF, DOCX, TXT, PPT, ZIP, Image).' });
    }

    const db = getDb();
    const channel = db.prepare('SELECT * FROM community_channels WHERE id = ?').get(id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found.' });
    }

    // Strict check if someone attempts to upload to Announcements
    if (channel.name === 'Announcements') {
      const isPermanentAdmin = req.user.role === 'admin' && env.ADMIN_EMAILS.includes(req.user.email);
      if (!isPermanentAdmin) {
        // Remove uploaded file
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        return res.status(403).json({ error: 'Only permanent administrators can post in Announcements.' });
      }
    }

    const msgId = generateId();
    const attachmentUrl = `/api/community/attachments/${req.file.filename}`;
    const messageContent = (content || `Shared resource: ${req.file.originalname}`).trim();

    db.prepare(`
      INSERT INTO community_messages (
        id, channel_id, user_id, content, attachment_url, attachment_name, attachment_size, attachment_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msgId,
      id,
      req.user.id,
      messageContent,
      attachmentUrl,
      req.file.originalname,
      req.file.size,
      req.file.mimetype
    );

    const savedMessage = db.prepare(`
      SELECT m.*, u.full_name as author_name, u.avatar_url as author_avatar, u.role as author_role, u.email as author_email
      FROM community_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `).get(msgId);

    const fullMessage = { ...savedMessage, reactions: {} };

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(id).emit('new_message', fullMessage);
    }

    return res.status(201).json({ success: true, message: fullMessage });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/community/attachments/:filename
 * Secure, authorized file delivery for shared community notes & resources
 */
router.get('/attachments/:filename', (req, res, next) => {
  try {
    const { filename } = req.params;
    const sanitized = path.basename(filename);
    const filePath = path.join(uploadsDir, sanitized);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Requested file does not exist or has been removed.' });
    }

    res.setHeader('Content-Security-Policy', "default-src 'self'");
    return res.download(filePath, sanitized);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/community/messages/:id OR /api/community/channels/:channelId/messages/:id
 * Edit message content (Author or Admin)
 */
const handleEditMessage = (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Updated message content is required.' });
    }

    const db = getDb();
    const msg = db.prepare(`
      SELECT m.*, c.name as channel_name
      FROM community_messages m
      JOIN community_channels c ON m.channel_id = c.id
      WHERE m.id = ?
    `).get(id);

    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // Permission: If announcements channel, only permanent admin can edit
    if (msg.channel_name === 'Announcements') {
      const isPermanentAdmin = req.user.role === 'admin' && env.ADMIN_EMAILS.includes(req.user.email);
      if (!isPermanentAdmin) {
        return res.status(403).json({ error: 'Only permanent administrators can edit announcements.' });
      }
    } else {
      // Exam Discussion / Notes: Author or Admin
      if (msg.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'You do not have permission to edit this message.' });
      }
    }

    db.prepare(`
      UPDATE community_messages
      SET content = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(content.trim(), id);

    if (req.user.role === 'admin') {
      logAdminAction(db, req.user.id, 'edit_community_message', { messageId: id, channel: msg.channel_name });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(msg.channel_id).emit('message_edited', { messageId: id, content: content.trim() });
    }

    return res.status(200).json({ success: true, message: 'Message updated successfully.' });
  } catch (err) {
    next(err);
  }
};

router.put('/messages/:id', handleEditMessage);
router.put('/channels/:channelId/messages/:id', handleEditMessage);

/**
 * DELETE /api/community/messages/:id OR /api/community/channels/:channelId/messages/:id
 * Delete message (Author or Admin)
 */
const handleDeleteMessage = (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const msg = db.prepare(`
      SELECT m.*, c.name as channel_name
      FROM community_messages m
      JOIN community_channels c ON m.channel_id = c.id
      WHERE m.id = ?
    `).get(id);

    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    // If Announcements channel, only permanent admin can delete
    if (msg.channel_name === 'Announcements') {
      const isPermanentAdmin = req.user.role === 'admin' && env.ADMIN_EMAILS.includes(req.user.email);
      if (!isPermanentAdmin) {
        return res.status(403).json({ error: 'Only permanent administrators can delete announcements.' });
      }
    } else {
      if (msg.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'You do not have permission to delete this message.' });
      }
    }

    db.prepare('UPDATE community_messages SET is_deleted = 1 WHERE id = ?').run(id);

    // If admin action, record audit log
    if (req.user.role === 'admin') {
      logAdminAction(db, req.user.id, 'delete_community_message', {
        messageId: id,
        channel: msg.channel_name,
        originalAuthor: msg.user_id,
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(msg.channel_id).emit('message_deleted', { messageId: id });
    }

    return res.status(200).json({ success: true, message: 'Message removed.' });
  } catch (err) {
    next(err);
  }
};

router.delete('/messages/:id', handleDeleteMessage);
router.delete('/channels/:channelId/messages/:id', handleDeleteMessage);

/**
 * PIN / UNPIN
 * POST /api/community/channels/:channelId/messages/:msgId/pin
 * PUT /api/community/messages/:id/pin
 */
const handlePinMessage = (req, res, next) => {
  try {
    const id = req.params.msgId || req.params.id;
    const db = getDb();

    const msg = db.prepare('SELECT * FROM community_messages WHERE id = ?').get(id);
    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    const newPinned = msg.is_pinned ? 0 : 1;
    db.prepare('UPDATE community_messages SET is_pinned = ? WHERE id = ?').run(newPinned, id);

    logAdminAction(db, req.user.id, newPinned ? 'pin_message' : 'unpin_message', { messageId: id });

    const io = req.app.get('io');
    if (io) {
      io.to(msg.channel_id).emit('message_pinned', { messageId: id, isPinned: !!newPinned });
    }

    return res.status(200).json({
      success: true,
      message: newPinned ? 'Announcement pinned to top!' : 'Announcement unpinned.',
      isPinned: !!newPinned,
    });
  } catch (err) {
    next(err);
  }
};

router.put('/messages/:id/pin', requireAdmin, handlePinMessage);
router.post('/channels/:channelId/messages/:msgId/pin', requireAdmin, handlePinMessage);

/**
 * TOGGLE REACTION
 * POST /api/community/messages/:id/reactions
 * POST /api/community/channels/:channelId/messages/:msgId/reactions
 */
const handleToggleReaction = (req, res, next) => {
  try {
    const id = req.params.msgId || req.params.id;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required.' });
    }

    const db = getDb();
    const existing = db.prepare(
      'SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?'
    ).get(id, req.user.id, emoji);

    let action = '';
    if (existing) {
      db.prepare('DELETE FROM message_reactions WHERE id = ?').run(existing.id);
      action = 'removed';
    } else {
      db.prepare(`
        INSERT INTO message_reactions (id, message_id, user_id, emoji)
        VALUES (?, ?, ?, ?)
      `).run(generateId(), id, req.user.id, emoji);
      action = 'added';
    }

    const io = req.app.get('io');
    const msg = db.prepare('SELECT channel_id FROM community_messages WHERE id = ?').get(id);
    if (io && msg) {
      io.to(msg.channel_id).emit('reaction_update', { messageId: id, emoji, action, userId: req.user.id });
    }

    return res.status(200).json({ success: true, action });
  } catch (err) {
    next(err);
  }
};

router.post('/messages/:id/reactions', handleToggleReaction);
router.post('/channels/:channelId/messages/:msgId/reactions', handleToggleReaction);

/**
 * REPORT MESSAGE
 * POST /api/community/messages/:id/report
 * POST /api/community/channels/:channelId/messages/:msgId/report
 */
const handleReportMessage = (req, res, next) => {
  try {
    const id = req.params.msgId || req.params.id;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Please provide a reason for the report.' });
    }

    const db = getDb();
    const msg = db.prepare('SELECT user_id FROM community_messages WHERE id = ?').get(id);
    if (!msg) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    const reportId = generateId();
    db.prepare(`
      INSERT INTO reports (id, reporter_id, reported_message_id, reported_user_id, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(reportId, req.user.id, id, msg.user_id, reason.trim());

    return res.status(200).json({ success: true, message: 'Report submitted. Admins will review it.' });
  } catch (err) {
    next(err);
  }
};

router.post('/messages/:id/report', handleReportMessage);
router.post('/channels/:channelId/messages/:msgId/report', handleReportMessage);

module.exports = router;
