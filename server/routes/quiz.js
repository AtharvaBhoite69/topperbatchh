// =============================================================================
// TopperBatch - MCQ Competitions & Leaderboard Routes
// =============================================================================

const express = require('express');
const router = express.Router();

const { getDb } = require('../database/db');
const { generateId, paginate } = require('../utils/helpers');
const { authenticate, requireApproved, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

// =============================================================================
// Student Challenge & Quiz Routes
// =============================================================================

/**
 * GET /api/quiz/daily
 * Get today's active challenge with sanitized questions (no correct flags)
 */
router.get('/daily', requireApproved, (req, res, next) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    // Find active challenge for today or most recent active challenge
    let challenge = db.prepare(`
      SELECT c.*, s.name as subject_name
      FROM mcq_challenges c
      LEFT JOIN subjects s ON c.subject_id = s.id
      WHERE c.is_active = 1 AND (c.challenge_date = ? OR c.challenge_date <= ?)
      ORDER BY c.challenge_date DESC
      LIMIT 1
    `).get(today, today);

    if (!challenge) {
      return res.status(200).json({
        success: true,
        challenge: null,
        message: 'No active competition right now. Check back tomorrow morning!',
      });
    }

    // Check if user already attempted
    const userAttempt = db.prepare(`
      SELECT id, is_submitted, score, time_taken_seconds, submitted_at
      FROM quiz_attempts
      WHERE challenge_id = ? AND user_id = ?
    `).get(challenge.id, req.user.id);

    // Fetch questions linked to this challenge
    const questions = db.prepare(`
      SELECT q.id, q.question_text, q.difficulty, q.subject_id
      FROM questions q
      WHERE q.challenge_id = ?
      ORDER BY q.created_at ASC
    `).all(challenge.id);

    // Fetch options for each question without exposing is_correct
    const questionsWithOptions = questions.map((q) => {
      const options = db.prepare(`
        SELECT id, option_text, option_order
        FROM answer_options
        WHERE question_id = ?
        ORDER BY RANDOM()
      `).all(q.id);
      return { ...q, options };
    });

    return res.status(200).json({
      success: true,
      challenge: {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        subject_name: challenge.subject_name,
        duration_minutes: challenge.duration_minutes,
        scoring_correct: challenge.scoring_correct,
        participation_bonus: challenge.participation_bonus,
        total_questions: questions.length,
      },
      userAttempt: userAttempt || null,
      questions: userAttempt && userAttempt.is_submitted ? [] : questionsWithOptions,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/quiz/:challengeId/start
 */
router.post('/:challengeId/start', requireApproved, (req, res, next) => {
  req.body.challenge_id = req.params.challengeId;
  return handleStartAttempt(req, res, next);
});

/**
 * POST /api/quiz/attempts
 * Start an official quiz attempt
 */
router.post('/attempts', requireApproved, handleStartAttempt);

function handleStartAttempt(req, res, next) {
  try {
    const { challenge_id } = req.body;
    if (!challenge_id) {
      return res.status(400).json({ error: 'challenge_id is required.' });
    }

    const db = getDb();

    // Verify challenge exists and is active
    const challenge = db.prepare('SELECT * FROM mcq_challenges WHERE id = ? AND is_active = 1').get(challenge_id);
    if (!challenge) {
      return res.status(404).json({ error: 'Competition not found or is currently closed.' });
    }

    // Check existing attempt
    const existingAttempt = db.prepare(
      'SELECT id, is_submitted FROM quiz_attempts WHERE challenge_id = ? AND user_id = ?'
    ).get(challenge_id, req.user.id);

    if (existingAttempt) {
      if (existingAttempt.is_submitted) {
        return res.status(400).json({ error: 'You have already submitted your attempt for this challenge!' });
      }
      return res.status(200).json({
        success: true,
        attemptId: existingAttempt.id,
        message: 'Resuming active attempt.',
      });
    }

    const attemptId = generateId();
    db.prepare(`
      INSERT INTO quiz_attempts (id, challenge_id, user_id, started_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(attemptId, challenge_id, req.user.id);

    return res.status(201).json({
      success: true,
      attemptId,
      startedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/quiz/:challengeId/submit
 */
router.post('/:challengeId/submit', requireApproved, (req, res, next) => {
  const db = getDb();
  const attempt = db.prepare('SELECT id FROM quiz_attempts WHERE challenge_id = ? AND user_id = ?').get(
    req.params.challengeId,
    req.user.id
  );
  if (!attempt) return res.status(404).json({ error: 'Attempt not found.' });
  req.params.id = attempt.id;
  return handleSubmitAttempt(req, res, next);
});

/**
 * PUT /api/quiz/attempts/:id/submit
 * Server-side score validation & calculation
 */
router.put('/attempts/:id/submit', requireApproved, handleSubmitAttempt);

function handleSubmitAttempt(req, res, next) {
  try {
    const { id } = req.params;
    const { answers, time_taken_seconds } = req.body; // answers: { [questionId]: optionId }

    const db = getDb();
    const attempt = db.prepare('SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ?').get(id, req.user.id);

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    if (attempt.is_submitted) {
      return res.status(400).json({ error: 'This challenge attempt has already been submitted.' });
    }

    const challenge = db.prepare('SELECT * FROM mcq_challenges WHERE id = ?').get(attempt.challenge_id);
    const questions = db.prepare('SELECT id FROM questions WHERE challenge_id = ?').all(attempt.challenge_id);

    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalUnanswered = 0;

    const correctPts = challenge.scoring_correct || 10;
    const bonusPts = challenge.participation_bonus || 5;

    // Use transaction to record student answers and update score
    const submitTx = db.transaction(() => {
      const answerInsertStmt = db.prepare(`
        INSERT INTO student_answers (id, attempt_id, question_id, selected_option_id, is_correct)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const q of questions) {
        const selectedOptionId = answers ? answers[q.id] : null;

        if (!selectedOptionId) {
          totalUnanswered++;
          answerInsertStmt.run(generateId(), id, q.id, null, 0);
        } else {
          // Check correctness server-side
          const opt = db.prepare('SELECT is_correct FROM answer_options WHERE id = ? AND question_id = ?').get(
            selectedOptionId,
            q.id
          );

          if (opt && opt.is_correct === 1) {
            totalCorrect++;
            answerInsertStmt.run(generateId(), id, q.id, selectedOptionId, 1);
          } else {
            totalIncorrect++;
            answerInsertStmt.run(generateId(), id, q.id, selectedOptionId, 0);
          }
        }
      }

      const rawScore = totalCorrect * correctPts + bonusPts;

      // Update attempt record
      db.prepare(`
        UPDATE quiz_attempts
        SET is_submitted = 1,
            submitted_at = datetime('now'),
            score = ?,
            total_correct = ?,
            total_incorrect = ?,
            total_unanswered = ?,
            time_taken_seconds = ?
        WHERE id = ?
      `).run(rawScore, totalCorrect, totalIncorrect, totalUnanswered, time_taken_seconds || 0, id);

      // Update student's cumulative total_points & study streak
      db.prepare(`
        UPDATE users
        SET total_points = total_points + ?,
            study_streak = study_streak + 1,
            last_active_date = datetime('now')
        WHERE id = ?
      `).run(rawScore, req.user.id);
    });

    submitTx();

    const finalScore = totalCorrect * correctPts + bonusPts;
    const totalQ = questions.length;
    const accuracy = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;

    return res.status(200).json({
      success: true,
      result: {
        score: finalScore,
        totalCorrect,
        totalIncorrect,
        totalUnanswered,
        accuracy,
        timeTakenSeconds: time_taken_seconds || 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/quiz/:challengeId/results
 */
router.get('/:challengeId/results', requireApproved, (req, res, next) => {
  const db = getDb();
  const attempt = db.prepare('SELECT id FROM quiz_attempts WHERE challenge_id = ? AND user_id = ?').get(
    req.params.challengeId,
    req.user.id
  );
  if (!attempt) return res.status(404).json({ error: 'Results not found for this challenge.' });
  req.params.id = attempt.id;
  return handleGetResults(req, res, next);
});

/**
 * GET /api/quiz/attempts/:id/results
 * Detailed result review with correct answers and explanations
 */
router.get('/attempts/:id/results', requireApproved, handleGetResults);

function handleGetResults(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    const attempt = db.prepare(`
      SELECT a.*, c.title as challenge_title
      FROM quiz_attempts a
      JOIN mcq_challenges c ON a.challenge_id = c.id
      WHERE a.id = ? AND (a.user_id = ? OR ? = 'admin')
    `).get(id, req.user.id, req.user.role);

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt result not found.' });
    }

    // Fetch questions and answers
    const studentAnswers = db.prepare(`
      SELECT sa.*, q.question_text, q.explanation
      FROM student_answers sa
      JOIN questions q ON sa.question_id = q.id
      WHERE sa.attempt_id = ?
    `).all(id);

    const detailedQuestions = studentAnswers.map((sa) => {
      const options = db.prepare('SELECT id, option_text, is_correct FROM answer_options WHERE question_id = ?').all(
        sa.question_id
      );
      return {
        questionId: sa.question_id,
        questionText: sa.question_text,
        explanation: sa.explanation,
        selectedOptionId: sa.selected_option_id,
        isCorrect: sa.is_correct === 1,
        options,
      };
    });

    return res.status(200).json({
      success: true,
      attempt,
      review: detailedQuestions,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/quiz/leaderboard
 * Rankings: Daily, Weekly, or All-Time
 */
router.get('/leaderboard', requireApproved, (req, res, next) => {
  try {
    const { type = 'daily' } = req.query;
    const db = getDb();

    let query = '';
    let params = [];

    if (type === 'daily') {
      query = `
        SELECT u.id as user_id, u.full_name, u.avatar_url, u.department, u.semester,
               qa.score, qa.time_taken_seconds, qa.total_correct, qa.submitted_at
        FROM quiz_attempts qa
        JOIN users u ON qa.user_id = u.id
        WHERE qa.is_submitted = 1 AND date(qa.submitted_at) = date('now')
        ORDER BY qa.score DESC, qa.time_taken_seconds ASC
        LIMIT 50
      `;
    } else if (type === 'weekly') {
      query = `
        SELECT u.id as user_id, u.full_name, u.avatar_url, u.department, u.semester,
               SUM(qa.score) as score,
               SUM(qa.time_taken_seconds) as time_taken_seconds,
               SUM(qa.total_correct) as total_correct
        FROM quiz_attempts qa
        JOIN users u ON qa.user_id = u.id
        WHERE qa.is_submitted = 1 AND qa.submitted_at >= datetime('now', '-7 days')
        GROUP BY u.id
        ORDER BY score DESC, time_taken_seconds ASC
        LIMIT 50
      `;
    } else {
      // All-Time Leaderboard
      query = `
        SELECT u.id as user_id, u.full_name, u.avatar_url, u.department, u.semester,
               u.total_points as score, u.study_streak,
               (SELECT COUNT(*) FROM quiz_attempts WHERE user_id = u.id AND is_submitted = 1) as total_attempts
        FROM users u
        WHERE u.status = 'approved' AND u.role = 'student'
        ORDER BY u.total_points DESC, u.study_streak DESC
        LIMIT 50
      `;
    }

    const leaderboard = db.prepare(query).all(...params);

    // Annotate rank numbers
    const ranked = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      isCurrentUser: entry.user_id === req.user.id,
    }));

    return res.status(200).json({
      success: true,
      leaderboard: ranked,
      type,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quiz/practice
 * Random practice questions
 */
router.get('/practice', requireApproved, (req, res, next) => {
  try {
    const { subject_id, count = 10 } = req.query;
    const db = getDb();

    let query = 'SELECT id, question_text, explanation, difficulty FROM questions WHERE is_approved = 1';
    let params = [];

    if (subject_id) {
      query += ' AND subject_id = ?';
      params.push(subject_id);
    }

    query += ' ORDER BY RANDOM() LIMIT ?';
    params.push(Math.min(25, parseInt(count, 10) || 10));

    const questions = db.prepare(query).all(...params);

    const fullQuestions = questions.map((q) => {
      const options = db.prepare('SELECT id, option_text, is_correct FROM answer_options WHERE question_id = ?').all(
        q.id
      );
      return { ...q, options };
    });

    return res.status(200).json({ success: true, questions: fullQuestions });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quiz/daily/history
 */
router.get('/daily/history', requireApproved, (req, res, next) => {
  try {
    const db = getDb();
    const history = db.prepare(`
      SELECT c.id, c.title, c.challenge_date, s.name as subject_name,
             qa.score, qa.total_correct, qa.time_taken_seconds, qa.submitted_at
      FROM mcq_challenges c
      LEFT JOIN subjects s ON c.subject_id = s.id
      LEFT JOIN quiz_attempts qa ON qa.challenge_id = c.id AND qa.user_id = ?
      WHERE c.is_published = 1
      ORDER BY c.challenge_date DESC
      LIMIT 20
    `).all(req.user.id);
    return res.status(200).json({ success: true, history });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quiz/my-attempts
 */
router.get('/my-attempts', requireApproved, (req, res, next) => {
  try {
    const db = getDb();
    const attempts = db.prepare(`
      SELECT qa.*, c.title as challenge_title, c.challenge_date
      FROM quiz_attempts qa
      JOIN mcq_challenges c ON qa.challenge_id = c.id
      WHERE qa.user_id = ? AND qa.is_submitted = 1
      ORDER BY qa.submitted_at DESC
    `).all(req.user.id);
    return res.status(200).json({ success: true, attempts });
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// Admin Question & Challenge Management Routes
// =============================================================================

/**
 * POST /api/quiz/questions (Admin)
 */
router.post('/questions', requireAdmin, (req, res, next) => {
  try {
    const { question_text, explanation, difficulty = 'medium', subject_id, challenge_id, options } = req.body;

    if (!question_text || !options || options.length < 2) {
      return res.status(400).json({ error: 'Question text and at least 2 options are required.' });
    }

    const db = getDb();
    const questionId = generateId();

    const insertTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO questions (id, challenge_id, question_text, explanation, difficulty, subject_id, is_approved, created_by)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      `).run(questionId, challenge_id || null, question_text.trim(), explanation || null, difficulty, subject_id || null, req.user.id);

      const optStmt = db.prepare(`
        INSERT INTO answer_options (id, question_id, option_text, is_correct, option_order)
        VALUES (?, ?, ?, ?, ?)
      `);

      options.forEach((opt, idx) => {
        optStmt.run(generateId(), questionId, opt.text.trim(), opt.isCorrect ? 1 : 0, idx + 1);
      });
    });

    insertTx();

    return res.status(201).json({ success: true, message: 'Question forged successfully!', questionId });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quiz/questions (Admin)
 */
router.get('/questions', requireAdmin, (req, res, next) => {
  try {
    const { subject_id, page = 1, limit = 20 } = req.query;
    const db = getDb();
    const { limit: l, offset: o } = paginate(page, limit);

    let whereClause = '';
    let params = [];

    if (subject_id) {
      whereClause = 'WHERE q.subject_id = ?';
      params.push(subject_id);
    }

    const total = db.prepare(`SELECT COUNT(*) as total FROM questions q ${whereClause}`).get(...params).total;

    const questions = db.prepare(`
      SELECT q.*, s.name as subject_name
      FROM questions q
      LEFT JOIN subjects s ON q.subject_id = s.id
      ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, l, o);

    const questionsWithOptions = questions.map((q) => {
      const options = db.prepare('SELECT * FROM answer_options WHERE question_id = ?').all(q.id);
      return { ...q, options };
    });

    return res.status(200).json({
      success: true,
      questions: questionsWithOptions,
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
 * POST /api/quiz/challenges (Admin)
 */
router.post('/challenges', requireAdmin, (req, res, next) => {
  try {
    const {
      title,
      description,
      subject_id,
      challenge_date,
      duration_minutes = 15,
      scoring_correct = 10,
      participation_bonus = 5,
      question_ids,
    } = req.body;

    if (!title || !challenge_date) {
      return res.status(400).json({ error: 'Title and challenge date are required.' });
    }

    const db = getDb();
    const challengeId = generateId();

    const createTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO mcq_challenges (
          id, title, description, subject_id, challenge_date, duration_minutes,
          scoring_correct, participation_bonus, is_active, is_published, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
      `).run(
        challengeId,
        title.trim(),
        description || null,
        subject_id || null,
        challenge_date,
        duration_minutes,
        scoring_correct,
        participation_bonus,
        req.user.id
      );

      // Link questions if provided
      if (question_ids && Array.isArray(question_ids)) {
        const linkStmt = db.prepare('UPDATE questions SET challenge_id = ? WHERE id = ?');
        for (const qid of question_ids) {
          linkStmt.run(challengeId, qid);
        }
      }
    });

    createTx();

    return res.status(201).json({
      success: true,
      message: 'Competition challenge scheduled!',
      challengeId,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quiz/challenges (Admin)
 */
router.get('/challenges', requireAdmin, (req, res, next) => {
  try {
    const db = getDb();
    const challenges = db.prepare(`
      SELECT c.*, s.name as subject_name,
             (SELECT COUNT(*) FROM questions WHERE challenge_id = c.id) as question_count,
             (SELECT COUNT(*) FROM quiz_attempts WHERE challenge_id = c.id AND is_submitted = 1) as attempt_count
      FROM mcq_challenges c
      LEFT JOIN subjects s ON c.subject_id = s.id
      ORDER BY c.challenge_date DESC
    `).all();

    return res.status(200).json({ success: true, challenges });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
