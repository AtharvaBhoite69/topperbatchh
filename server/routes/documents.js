// =============================================================================
// TopperBatch - Documents & Question Bank Routes
// Production-Ready: Supabase PostgreSQL & Supabase Storage
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
const {
  uploadToStorage,
  getSignedDownloadUrl,
  deleteFromStorage,
  BUCKET_DOCUMENTS,
} = require('../services/supabaseStorage');

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

function normalizeDept(dept) {
  if (!dept) return '';
  const d = String(dept).trim().toUpperCase();
  if (d === 'AIML' || d === 'AI&ML' || d === 'AI & ML' || d === 'AI AND ML') return 'AI & ML';
  if (d === 'CS' || d === 'CSE' || d === 'COMPUTER SCIENCE') return 'Computer Science';
  if (d === 'IT' || d === 'INFORMATION TECH' || d === 'INFORMATION TECHNOLOGY') return 'Information Tech';
  if (d === 'DS' || d === 'DATA SCIENCE') return 'Data Science';
  if (d === 'EXTC' || d === 'ELECTRONICS') return 'Electronics';
  if (d === 'CE' || d === 'COMPUTER ENGINEERING') return 'Computer Engineering';
  return dept;
}

// =============================================================================
// Student Routes (Approved & Admin)
// =============================================================================

/**
 * GET /api/documents
 * List visible documents with search and filters
 */
router.get('/', requireApproved, async (req, res, next) => {
  try {
    const { semester, department, subject_id, unit_id, search, page = 1, limit = 20 } = req.query;
    const db = getDb();
    const { limit: l, offset: o } = paginate(page, limit);

    let whereConditions = ['d.is_visible = 1'];
    let params = [];

    // STRICT ROLE-BASED ACCESS CONTROL
    if (req.user.role === 'student') {
      // Students can ONLY see documents for their assigned semester and department
      if (req.user.semester) {
        whereConditions.push('d.semester_id = ?');
        params.push(req.user.semester);
      }
      if (req.user.department) {
        const normDept = normalizeDept(req.user.department);
        whereConditions.push('(d.department = ? OR d.department = ? OR d.department IS NULL)');
        params.push(normDept, req.user.department);
      }
    } else {
      // Admins have unrestricted access and can filter by any semester or department
      if (semester) {
        whereConditions.push('d.semester_id = ?');
        params.push(semester);
      }
      if (department) {
        whereConditions.push('d.department = ?');
        params.push(department);
      }
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
    const countRow = await countStmt.get(...params);
    const total = countRow ? parseInt(countRow.total, 10) : 0;

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

    const documents = await queryStmt.all(req.user.id, ...params, l, o);

    return res.status(200).json({
      success: true,
      documents,
      pagination: {
        page: parseInt(page, 10),
        limit: l,
        total,
        totalPages: Math.ceil(total / l),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/subjects
 */
router.get('/subjects', requireApproved, async (req, res, next) => {
  try {
    const { semester_id, department } = req.query;
    const db = getDb();

    let sql = 'SELECT * FROM subjects';
    let whereConditions = [];
    let params = [];

    if (req.user.role === 'student') {
      if (req.user.semester) {
        whereConditions.push('semester_id = ?');
        params.push(req.user.semester);
      }
      if (req.user.department) {
        const normDept = normalizeDept(req.user.department);
        whereConditions.push('(department = ? OR department = ? OR department IS NULL)');
        params.push(normDept, req.user.department);
      }
    } else {
      if (semester_id) {
        whereConditions.push('semester_id = ?');
        params.push(semester_id);
      }
      if (department) {
        whereConditions.push('(department = ? OR department IS NULL)');
        params.push(department);
      }
    }

    if (whereConditions.length > 0) {
      sql += ' WHERE ' + whereConditions.join(' AND ');
    }

    sql += ' ORDER BY name ASC';
    const subjects = await db.prepare(sql).all(...params);

    return res.status(200).json({ success: true, subjects });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/subjects/:subjectId/units
 */
router.get('/subjects/:subjectId/units', requireApproved, async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    const db = getDb();
    const units = await db.prepare('SELECT * FROM units WHERE subject_id = ? ORDER BY number ASC').all(subjectId);
    return res.status(200).json({ success: true, units });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/semesters
 */
router.get('/semesters', requireApproved, async (req, res, next) => {
  try {
    const db = getDb();
    const semesters = await db.prepare('SELECT * FROM semesters ORDER BY number ASC').all();
    return res.status(200).json({ success: true, semesters });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/saved
 * List user's saved/bookmarked documents
 */
router.get('/saved', requireApproved, async (req, res, next) => {
  try {
    const db = getDb();
    const saved = await db.prepare(`
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
router.get('/:id', requireApproved, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const doc = await db.prepare(`
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

    // Role-based Department & Semester enforcement
    if (req.user.role === 'student') {
      if (doc.semester_id && req.user.semester && doc.semester_id !== req.user.semester) {
        return res.status(403).json({ error: 'Access denied: This material belongs to a different semester.' });
      }
      if (doc.department && req.user.department && normalizeDept(doc.department) !== normalizeDept(req.user.department)) {
        return res.status(403).json({ error: 'Access denied: This material belongs to a different department.' });
      }
    }

    return res.status(200).json({ success: true, document: doc });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/documents/:id/view
 * Protected delivery of PDF file (Supabase Signed URL or secure stream)
 */
router.get('/:id/view', requireApproved, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const doc = await db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    if (!doc.is_visible && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Document access is currently disabled.' });
    }

    // Role-based Department & Semester enforcement
    if (req.user.role === 'student') {
      if (doc.semester_id && req.user.semester && doc.semester_id !== req.user.semester) {
        return res.status(403).json({ error: 'Access denied: This material belongs to a different semester.' });
      }
      if (doc.department && req.user.department && normalizeDept(doc.department) !== normalizeDept(req.user.department)) {
        return res.status(403).json({ error: 'Access denied: This material belongs to a different department.' });
      }
    }

    // 1. Check Supabase Storage Private Signed URL (1-hour validity)
    const signedUrl = await getSignedDownloadUrl(BUCKET_DOCUMENTS, doc.filename, 3600);
    if (req.query.format === 'url') {
      return res.status(200).json({
        success: true,
        url: signedUrl || `/api/documents/${id}/view`,
        isSignedUrl: !!signedUrl,
      });
    }

    if (signedUrl) {
      return res.redirect(signedUrl);
    }

    // 2. Fall back to local file streaming if running offline
    const filePath = path.join(uploadDir, doc.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF file is missing on storage.' });
    }

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
router.post('/:id/save', requireApproved, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const doc = await db.prepare('SELECT id FROM documents WHERE id = ?').get(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    await db.prepare(`
      INSERT INTO saved_documents (id, user_id, document_id)
      VALUES (?, ?, ?)
      ON CONFLICT DO NOTHING
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
router.delete('/:id/save', requireApproved, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    await db.prepare('DELETE FROM saved_documents WHERE user_id = ? AND document_id = ?').run(req.user.id, id);
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
 * Admin PDF upload & auto-indexing for RAG + Supabase Storage sync
 */
router.post('/', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }

    const { title, description, semester_id, department, subject_id, unit_id, topic } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Document title is required.' });
    }

    const db = getDb();
    const docId = generateId();
    const filePath = req.file.path;

    // Upload to Supabase Storage in parallel/background
    await uploadToStorage(BUCKET_DOCUMENTS, req.file.filename, filePath, 'application/pdf');

    // Extract text from PDF
    let pageCount = 0;
    try {
      const extracted = await extractText(filePath);
      pageCount = extracted.pageCount || 0;

      // Save document record with Department and Semester
      await db.prepare(`
        INSERT INTO documents (
          id, title, description, filename, original_name, file_size,
          subject_id, unit_id, semester_id, department, topic, uploaded_by, page_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        department ? department.trim() : null,
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
          await pageInsert.run(generateId(), docId, p.pageNumber, p.content || '');
        }
      }

      // Trigger RAG indexing in background
      indexDocument(docId).catch((err) => {
        console.error('Background RAG index error:', err.message);
      });

      // Notify only students who belong to this department & semester
      let studentSql = "SELECT id FROM users WHERE status = 'approved' AND role = 'student'";
      let notifyParams = [];
      if (semester_id) {
        studentSql += ' AND semester = ?';
        notifyParams.push(parseInt(semester_id, 10));
      }
      if (department) {
        studentSql += ' AND (department = ? OR department IS NULL)';
        notifyParams.push(department.trim());
      }
      const students = await db.prepare(studentSql).all(...notifyParams);
      const notifyStmt = db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link)
        VALUES (?, ?, 'document', '📚 New Material Dropped!', ?, ?)
      `);
      for (const s of students) {
        await notifyStmt.run(generateId(), s.id, `New PDF: ${title}`, `/document/${docId}`);
      }

      return res.status(201).json({
        success: true,
        message: 'PDF uploaded and indexing started!',
        documentId: docId,
        pageCount,
      });
    } catch (parseErr) {
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
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
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, semester_id, department, subject_id, unit_id, topic, is_visible } = req.body;
    const db = getDb();

    await db.prepare(`
      UPDATE documents
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          semester_id = COALESCE(?, semester_id),
          department = COALESCE(?, department),
          subject_id = COALESCE(?, subject_id),
          unit_id = COALESCE(?, unit_id),
          topic = COALESCE(?, topic),
          is_visible = COALESCE(?, is_visible),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title ? title.trim() : null,
      description !== undefined ? (description ? description.trim() : null) : null,
      semester_id !== undefined ? (semester_id ? parseInt(semester_id, 10) : null) : null,
      department !== undefined ? (department ? department.trim() : null) : null,
      subject_id !== undefined ? (subject_id || null) : null,
      unit_id !== undefined ? (unit_id || null) : null,
      topic !== undefined ? (topic ? topic.trim() : null) : null,
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
 * Delete document, unbind foreign key dependencies, remove RAG chunks, and clean up storage.
 */
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const doc = await db.prepare('SELECT filename FROM documents WHERE id = ?').get(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // 1. Unlink foreign references in chat conversations and MCQs so chat histories are preserved
    try {
      await db.prepare('UPDATE chat_conversations SET document_id = NULL WHERE document_id = ?').run(id);
    } catch (_) {}

    try {
      await db.prepare('UPDATE questions SET document_id = NULL WHERE document_id = ?').run(id);
    } catch (_) {}

    try {
      await db.prepare('UPDATE mcq_draft_sessions SET document_id = NULL WHERE document_id = ?').run(id);
    } catch (_) {}

    // 2. Cascade delete dependent child records (bookmarks, RAG vector chunks, extracted pages)
    try {
      await db.prepare('DELETE FROM saved_documents WHERE document_id = ?').run(id);
    } catch (_) {}

    try {
      await db.prepare('DELETE FROM document_chunks WHERE document_id = ?').run(id);
    } catch (_) {}

    try {
      await db.prepare('DELETE FROM document_pages WHERE document_id = ?').run(id);
    } catch (_) {}

    // 3. Delete document row from documents table
    await db.prepare('DELETE FROM documents WHERE id = ?').run(id);

    // 4. Clean up cloud storage and local temp file
    if (doc.filename) {
      await deleteFromStorage(BUCKET_DOCUMENTS, doc.filename);
      const filePath = path.join(uploadDir, doc.filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('File cleanup failed:', e.message);
        }
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
router.post('/subjects', requireAdmin, async (req, res, next) => {
  try {
    const { name, code, semester_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Subject name is required.' });

    const db = getDb();
    const id = generateId();

    await db.prepare(`
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
router.post('/units', requireAdmin, async (req, res, next) => {
  try {
    const { name, number, subject_id } = req.body;
    if (!name || !subject_id) {
      return res.status(400).json({ error: 'Unit name and subject are required.' });
    }

    const db = getDb();
    const id = generateId();

    await db.prepare(`
      INSERT INTO units (id, name, number, subject_id)
      VALUES (?, ?, ?, ?)
    `).run(id, name.trim(), number ? parseInt(number, 10) : 1, subject_id);

    return res.status(201).json({ success: true, message: 'Unit created.', id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
