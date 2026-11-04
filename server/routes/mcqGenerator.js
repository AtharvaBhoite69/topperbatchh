// =============================================================================
// TopperBatch - Admin AI PDF-to-MCQ Generator Routes
// STRICT ADMIN ONLY: Students are blocked by requireAdmin on every endpoint
// Production-Ready: Supabase PostgreSQL & Gemini API
// =============================================================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { getDb } = require('../database/db');
const { generateId } = require('../utils/helpers');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { generateMCQsFromPDF, regenerateSingleQuestion } = require('../services/mcqGenerator');

// STRICT ADMIN ENFORCEMENT: All routes require active Admin credentials
router.use(authenticate, requireAdmin);

// Multer storage for MCQ generator PDF uploads (temporary /tmp on Vercel)
const uploadDir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (_) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `mcq_${generateId()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF documents are supported for MCQ generation.'));
    }
  },
});

/**
 * POST /api/admin/mcq-generator/generate
 * Generate MCQs from an uploaded PDF or an existing vault document.
 */
router.post('/generate', upload.single('file'), async (req, res, next) => {
  try {
    const {
      document_id,
      count = 10,
      difficulty = 'mixed',
      question_style = 'mixed',
      topic = '',
      instructions = '',
    } = req.body;

    const db = getDb();
    let filePath = null;
    let originalName = 'Uploaded Material.pdf';
    let docId = document_id || null;

    if (req.file) {
      filePath = req.file.path;
      originalName = req.file.originalname;
    } else if (document_id) {
      const doc = await db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id);
      if (!doc) {
        return res.status(404).json({ error: 'Vault document not found.' });
      }
      originalName = doc.original_name || doc.title;
      filePath = path.join(uploadDir, doc.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Document PDF file is missing on storage.' });
      }
    } else {
      return res.status(400).json({ error: 'Please upload a PDF file or select an existing document from the vault.' });
    }

    const questionCount = Math.max(1, Math.min(25, parseInt(count, 10) || 10));

    // Generate MCQs via Gemini Service
    const result = await generateMCQsFromPDF({
      filePath,
      originalName,
      count: questionCount,
      difficulty,
      questionStyle: question_style,
      topic: topic ? topic.trim() : '',
      instructions: instructions ? instructions.trim() : '',
    });

    // Save as draft session
    const sessionId = generateId();
    await db.prepare(`
      INSERT INTO mcq_draft_sessions (
        id, admin_id, document_id, source_pdf_name, topic,
        difficulty, question_style, question_count, instructions,
        status, generated_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'review', ?)
    `).run(
      sessionId,
      req.user.id,
      docId,
      originalName,
      topic || null,
      difficulty,
      question_style,
      result.questions.length,
      instructions || null,
      JSON.stringify(result.questions)
    );

    return res.status(200).json({
      success: true,
      sessionId,
      sourcePdf: originalName,
      pageCount: result.pageCount,
      summary: result.summary,
      insufficientContentReason: result.insufficientContentReason,
      questions: result.questions,
    });
  } catch (err) {
    console.error('MCQ Generation error:', err.message);
    return res.status(500).json({
      error: err.message || 'Failed to generate MCQs from the provided document.',
    });
  }
});

/**
 * POST /api/admin/mcq-generator/regenerate-question
 * Regenerate a specific individual question
 */
router.post('/regenerate-question', async (req, res, next) => {
  try {
    const {
      sessionId,
      document_id,
      source_pdf_name,
      page_number = 1,
      topic = '',
      difficulty = 'medium',
      question_style = 'mixed',
      existing_question = '',
      instructions = '',
    } = req.body;

    const db = getDb();
    let filePath = null;
    let originalName = source_pdf_name || 'Document.pdf';

    if (document_id) {
      const doc = await db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id);
      if (doc) {
        filePath = path.join(uploadDir, doc.filename);
        originalName = doc.original_name || doc.title;
      }
    }

    if (!filePath && sessionId) {
      const session = await db.prepare('SELECT * FROM mcq_draft_sessions WHERE id = ?').get(sessionId);
      if (session && session.document_id) {
        const doc = await db.prepare('SELECT * FROM documents WHERE id = ?').get(session.document_id);
        if (doc) {
          filePath = path.join(uploadDir, doc.filename);
          originalName = doc.original_name || doc.title;
        }
      }
    }

    // If still no direct path, check most recent uploads
    if (!filePath || !fs.existsSync(filePath)) {
      const files = fs.readdirSync(uploadDir).filter((f) => f.endsWith('.pdf'));
      if (files.length > 0) {
        filePath = path.join(uploadDir, files[files.length - 1]);
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Original PDF file could not be located to regenerate.' });
    }

    const newQuestion = await regenerateSingleQuestion({
      pdfFilePath: filePath,
      originalName,
      pageNumber: parseInt(page_number, 10) || 1,
      topic,
      difficulty,
      questionStyle: question_style,
      existingQuestion: existing_question,
      instructions,
    });

    return res.status(200).json({
      success: true,
      question: newQuestion,
    });
  } catch (err) {
    console.error('Question regeneration error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to regenerate question.' });
  }
});

/**
 * GET /api/admin/mcq-generator/drafts
 * List all saved draft sessions
 */
router.get('/drafts', async (req, res, next) => {
  try {
    const db = getDb();
    const drafts = await db.prepare(`
      SELECT id, source_pdf_name, topic, difficulty, question_style,
             question_count, status, created_at, updated_at
      FROM mcq_draft_sessions
      WHERE admin_id = ?
      ORDER BY updated_at DESC
      LIMIT 20
    `).all(req.user.id);

    return res.status(200).json({ success: true, drafts });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/mcq-generator/drafts/:id
 * Retrieve a specific draft session with questions
 */
router.get('/drafts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();
    const draft = await db.prepare('SELECT * FROM mcq_draft_sessions WHERE id = ?').get(id);

    if (!draft) {
      return res.status(404).json({ error: 'Draft session not found.' });
    }

    const questions = draft.generated_data ? JSON.parse(draft.generated_data) : [];

    return res.status(200).json({
      success: true,
      draft: {
        ...draft,
        questions,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/mcq-generator/drafts/:id
 * Save updated question edits into the draft session
 */
router.put('/drafts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questions } = req.body;

    if (!Array.isArray(questions)) {
      return res.status(400).json({ error: 'Questions array is required.' });
    }

    const db = getDb();
    await db.prepare(`
      UPDATE mcq_draft_sessions
      SET generated_data = ?, question_count = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(questions), questions.length, id);

    return res.status(200).json({ success: true, message: 'Draft updated successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/mcq-generator/drafts/:id
 */
router.delete('/drafts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();
    await db.prepare('DELETE FROM mcq_draft_sessions WHERE id = ?').run(id);
    return res.status(200).json({ success: true, message: 'Draft deleted.' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/mcq-generator/publish
 * Publish approved questions as a Daily Challenge or into the Question Bank.
 * Unapproved questions are strictly excluded.
 */
router.post('/publish', async (req, res, next) => {
  try {
    const {
      sessionId,
      publishType = 'challenge', // 'challenge' | 'question_bank' | 'both'
      challengeTitle,
      challengeDate,
      durationMinutes = 15,
      scoringCorrect = 10,
      subjectId = null,
      approvedQuestions = [],
    } = req.body;

    if (!Array.isArray(approvedQuestions) || approvedQuestions.length === 0) {
      return res.status(400).json({ error: 'Please select and approve at least one MCQ to publish.' });
    }

    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const targetDate = challengeDate || today;

    let challengeId = null;

    // 1. Create Challenge if requested
    if (publishType === 'challenge' || publishType === 'both') {
      challengeId = generateId();
      const title = challengeTitle
        ? challengeTitle.trim()
        : `Daily Battle: ${approvedQuestions[0]?.topic || 'Syllabus Sprint'} (${targetDate})`;

      await db.prepare(`
        INSERT INTO mcq_challenges (
          id, title, description, subject_id, challenge_date,
          duration_minutes, question_count, is_active, is_published,
          scoring_correct, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
      `).run(
        challengeId,
        title,
        `AI-forged challenge from ${approvedQuestions[0]?.source_pdf || 'curated question bank'}. 9-pointer practice!`,
        subjectId || null,
        targetDate,
        parseInt(durationMinutes, 10) || 15,
        approvedQuestions.length,
        parseInt(scoringCorrect, 10) || 10,
        req.user.id
      );
    }

    // 2. Insert approved questions & 4 answer options
    const insertQuestionStmt = db.prepare(`
      INSERT INTO questions (
        id, challenge_id, question_text, explanation, difficulty,
        subject_id, is_approved, page_number, topic, source_pdf_name, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `);

    const insertOptionStmt = db.prepare(`
      INSERT INTO answer_options (
        id, question_id, option_text, is_correct, option_order
      ) VALUES (?, ?, ?, ?, ?)
    `);

    for (const q of approvedQuestions) {
      const qId = generateId();
      await insertQuestionStmt.run(
        qId,
        challengeId, // linked to challenge or null for question bank only
        q.question.trim(),
        q.explanation || null,
        ['easy', 'medium', 'hard'].includes((q.difficulty || '').toLowerCase()) ? q.difficulty.toLowerCase() : 'medium',
        subjectId || null,
        parseInt(q.source_page || 1, 10),
        q.topic || null,
        q.source_pdf || null,
        req.user.id
      );

      const correctLabel = (q.correct_answer || 'A').toUpperCase().trim();
      const options = Array.isArray(q.options) ? q.options : [];

      for (let idx = 0; idx < options.length; idx++) {
        const opt = options[idx];
        const optLabel = (opt.label || ['A', 'B', 'C', 'D'][idx] || '').toUpperCase().trim();
        const isCorrect = optLabel === correctLabel ? 1 : 0;
        await insertOptionStmt.run(
          generateId(),
          qId,
          (opt.text || `Option ${optLabel}`).trim(),
          isCorrect,
          idx + 1
        );
      }
    }

    // 3. Mark session as published if session ID provided
    if (sessionId) {
      await db.prepare("UPDATE mcq_draft_sessions SET status = 'published', updated_at = datetime('now') WHERE id = ?").run(sessionId);
    }

    return res.status(201).json({
      success: true,
      message:
        publishType === 'challenge' || publishType === 'both'
          ? `🎉 Successfully published ${approvedQuestions.length} approved MCQs to Daily Challenge!`
          : `🎉 Successfully saved ${approvedQuestions.length} approved MCQs to the Question Bank!`,
      challengeId,
      publishedCount: approvedQuestions.length,
    });
  } catch (err) {
    console.error('MCQ Publish error:', err.message);
    next(err);
  }
});

module.exports = router;
