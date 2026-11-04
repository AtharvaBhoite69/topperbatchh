// =============================================================================
// TopperBatch - Documents & Question Bank Routes
// =============================================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { getDb } = require('../database/db');
const { generateId, paginate } = require('../utils/helpers');
const { authenticate, requireAdmin, requireApproved } = require('../middleware/auth');
const { extractText } = require('../services/pdf');
const { indexDocument } = require('../services/rag');

// Multer storage configuration - private uploads folder (using /tmp on Vercel)
const uploadDir = process.env.VERCEL
  ? '/tmp/uploads'
  : path.join(__dirname, '..', 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('Documents uploads directory setup warning:', e.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${generateId()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF documents are allowed.'));
    }
  },
});

// All document routes require authentication
router.use(authenticate);

// =============================================================================
// Student Routes (Approved & Admin)
// =============================================================================

/**
 * GET /api/documents
 * List visible documents with search and filters
 */
router.get('/', requireApproved, (req, res, next) => {
  try {
    const { semester, subject_id, unit_id, search, page = 1, limit = 20 } = req.query;
    const db = getDb();
    const { limit: l, offset: o } = paginate(page, limit);

    let whereConditions = ['d.is_visible = 1'];
    let params = [];

    if (semester) {
      whereConditions.push('d.semester_id = ?');
      params.push(semester);
    }

    if (subject_id) {
      whereConditions.push('d.subject_id = ?');
      params.push(subject_id);
    }

    if (unit_id) {
      whereConditions.push('d.unit_id = ?');
      params.push(unit_id);
    }

    if (search) {
      whereConditions.push('(d.title LIKE ? OR d.description LIKE ? OR d.topic LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = whereConditions.join(' AND ');

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM documents d WHERE ${whereClause}`);
    const total = countStmt.get(...params).total;

    const queryStmt = db.prepare(`
      SELECT d.*, s.name as subject_name, s.code as subject_code,
             u.name as unit_name, sem.name as semester_name,
             CASE WHEN sd.id IS NOT NULL THEN 1 ELSE 0 END as is_saved
      FROM documents d
      LEFT JOIN subjects s ON d.subject_id = s.id
      LEFT JOIN units u ON d.unit_id = u.id
      LEFT JOIN semesters sem ON d.semester_id = sem.id
      LEFT JOIN saved_documents sd ON sd.document_id = d.id AND sd.user_id = ?
      WHERE ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const documents = queryStmt.all(req.user.id, ...params, l, o);

    return res.status(200).json({
      success: true,
      documents,
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
 * GET /api/documents/subjects
 * Get all subjects grouped by semester
 */
router.get('/subjects', requireApproved, (req, res, next) => {
  try {
    const db = getDb();
    const subjects = db.prepare(`
      SELECT s.*, sem.name as semester_name, sem.number as semester_number,
             (SELECT COUNT(*) FROM documents d WHERE d.subject_id = s.id AND d.is_visible = 1) as document_count
      FROM subjects s
      LEFT JOIN semesters sem ON s.semester_id = sem.id
      ORDER BY sem.number ASC, s.name ASC
    `).all();

    return res.status(200).json({ success: true, subjects });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/semesters
 */
router.get('/semesters', requireApproved, (req, res, next) => {
  try {
    const db = getDb();
    const semesters = db.prepare('SELECT * FROM semesters ORDER BY number ASC').all();
    return res.status(200).json({ success: true, semesters });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/saved
 * List user's saved/bookmarked documents
 */
router.get('/saved', requireApproved, (req, res, next) => {
  try {
    const db = getDb();
    const saved = db.prepare(`
      SELECT d.*, s.name as subject_name, u.name as unit_name, sd.created_at as saved_at
      FROM saved_documents sd
      JOIN documents d ON sd.document_id = d.id
      LEFT JOIN subjects s ON d.subject_id = s.id
      LEFT JOIN units u ON d.unit_id = u.id
      WHERE sd.user_id = ? AND d.is_visible = 1
      ORDER BY sd.created_at DESC
    `).all(req.user.id);

    return res.status(200).json({ success: true, savedDocuments: saved });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/:id
 * Get single document details
 */
router.get('/:id', requireApproved, (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const doc = db.prepare(`
      SELECT d.*, s.name as subject_name, u.name as unit_name, sem.name as semester_name,
             CASE WHEN sd.id IS NOT NULL THEN 1 ELSE 0 END as is_saved
      FROM documents d
      LEFT JOIN subjects s ON d.subject_id = s.id
      LEFT JOIN units u ON d.unit_id = u.id
      LEFT JOIN semesters sem ON d.semester_id = sem.id
      LEFT JOIN saved_documents sd ON sd.document_id = d.id AND sd.user_id = ?
      WHERE d.id = ?
    `).get(req.user.id, id);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (!doc.is_visible && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access to this document is restricted.' });
    }

    return res.status(200).json({ success: true, document: doc });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/:id/view
 * Protected inline streaming of PDF file with watermark metadata
 */
router.get('/:id/view', requireApproved, (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (!doc.is_visible && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Document access is currently disabled.' });
    }

    const filePath = path.join(uploadDir, doc.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF file is missing on storage.' });
    }

    // Set secure delivery headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_name)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/documents/:id/save
 * Bookmark a document
 */
router.post('/:id/save', requireApproved, (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const doc = db.prepare('SELECT id FROM documents WHERE id = ?').get(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO saved_documents (id, user_id, document_id)
      VALUES (?, ?, ?)
    `).run(generateId(), req.user.id, id);

    return res.status(200).json({ success: true, message: 'Document saved to your vault!' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/documents/:id/save
 * Remove bookmark
 */
router.delete('/:id/save', requireApproved, (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    db.prepare('DELETE FROM saved_documents WHERE user_id = ? AND document_id = ?').run(req.user.id, id);
    return res.status(200).json({ success: true, message: 'Removed from saved documents.' });
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// Admin Routes (Upload, Edit, Delete, Subjects, Units)
// =============================================================================

/**
 * POST /api/documents
 * Admin PDF upload & auto-indexing for RAG
 */
router.post('/', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }

    const { title, description, semester_id, subject_id, unit_id, topic } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Document title is required.' });
    }

    const db = getDb();
    const docId = generateId();
    const filePath = req.file.path;

    // Extract text from PDF
    let pageCount = 0;
    try {
      const extracted = await extractText(filePath);
      pageCount = extracted.pageCount || 0;

      // Save document record
      db.prepare(`
        INSERT INTO documents (
          id, title, description, filename, original_name, file_size,
          subject_id, unit_id, semester_id, topic, uploaded_by, page_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        docId,
        title.trim(),
        description ? description.trim() : null,
        req.file.filename,
        req.file.originalname,
        req.file.size,
        subject_id || null,
        unit_id || null,
        semester_id ? parseInt(semester_id, 10) : null,
        topic ? topic.trim() : null,
        req.user.id,
        pageCount
      );

      // Save document pages
      if (extracted.pages && extracted.pages.length > 0) {
        const pageInsert = db.prepare(`
          INSERT INTO document_pages (id, document_id, page_number, content)
          VALUES (?, ?, ?, ?)
        `);
        for (const p of extracted.pages) {
          pageInsert.run(generateId(), docId, p.pageNumber, p.content || '');
        }
      }

      // Trigger RAG indexing in background
      indexDocument(docId).catch((err) => {
        console.error('Background RAG index error:', err.message);
      });

      // Notify students
      const students = db.prepare("SELECT id FROM users WHERE status = 'approved'").all();
      const notifyStmt = db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link)
        VALUES (?, ?, 'document', '📚 New Material Dropped!', ?, ?)
      `);
      for (const s of students) {
        notifyStmt.run(generateId(), s.id, `New PDF: ${title}`, `/document/${docId}`);
      }

      return res.status(201).json({
        success: true,
        message: 'PDF uploaded and indexing started!',
        documentId: docId,
        pageCount,
      });
    } catch (parseErr) {
      // Clean up uploaded file if extraction fails critically
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(400).json({ error: `Failed to process PDF: ${parseErr.message}` });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/documents/:id
 * Admin update document metadata
 */
router.put('/:id', requireAdmin, (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, semester_id, subject_id, unit_id, topic, is_visible } = req.body;
    const db = getDb();

    db.prepare(`
      UPDATE documents
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          semester_id = COALESCE(?, semester_id),
          subject_id = COALESCE(?, subject_id),
          unit_id = COALESCE(?, unit_id),
          topic = COALESCE(?, topic),
          is_visible = COALESCE(?, is_visible),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title,
      description,
      semester_id ? parseInt(semester_id, 10) : null,
      subject_id,
      unit_id,
      topic,
      is_visible !== undefined ? (is_visible ? 1 : 0) : null,
      id
    );

    return res.status(200).json({ success: true, message: 'Document updated successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/documents/:id
 * Delete document and remove stored file
 */
router.delete('/:id', requireAdmin, (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const doc = db.prepare('SELECT filename FROM documents WHERE id = ?').get(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // Delete DB record
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);

    // Delete disk file
    const filePath = path.join(uploadDir, doc.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn('File cleanup failed:', e.message);
      }
    }

    return res.status(200).json({ success: true, message: 'Document deleted from vault.' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/documents/subjects (Admin)
 */
router.post('/subjects', requireAdmin, (req, res, next) => {
  try {
    const { name, code, semester_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Subject name is required.' });

    const db = getDb();
    const id = generateId();

    db.prepare(`
      INSERT INTO subjects (id, name, code, semester_id)
      VALUES (?, ?, ?, ?)
    `).run(id, name.trim(), code ? code.trim() : null, semester_id ? parseInt(semester_id, 10) : null);

    return res.status(201).json({ success: true, message: 'Subject created.', id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/documents/units (Admin)
 */
router.post('/units', requireAdmin, (req, res, next) => {
  try {
    const { name, number, subject_id } = req.body;
    if (!name || !subject_id) {
      return res.status(400).json({ error: 'Unit name and subject are required.' });
    }

    const db = getDb();
    const id = generateId();

    db.prepare(`
      INSERT INTO units (id, name, number, subject_id)
      VALUES (?, ?, ?, ?)
    `).run(id, name.trim(), number ? parseInt(number, 10) : 1, subject_id);

    return res.status(201).json({ success: true, message: 'Unit created.', id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

