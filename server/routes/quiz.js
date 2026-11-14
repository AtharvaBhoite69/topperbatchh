// =============================================================================
// TopperBatch - MCQ Competitions & Leaderboard Routes
// Production-Ready: Supabase PostgreSQL
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

const IST_OFFSET_MS = 330 * 60 * 1000;

function normalizeDept(dept) {
  if (!dept) return '';
  const d = String(dept).trim().toUpperCase();
  if (d === 'AIML' || d === 'AI&ML' || d === 'AI & ML' || d === 'AI AND ML') return 'AI & ML';
  if (d === 'CS' || d === 'CSE' || d === 'COMPUTER SCIENCE') return 'Computer Science';
  if (d === 'IT' || d === 'INFORMATION TECH' || d === 'INFORMATION TECHNOLOGY') return 'Information Tech';
  if (d === 'DS' || d === 'DATA SCIENCE') return 'Data Science';
  if (d === 'EXTC' || d === 'ELECTRONICS') return 'Electronics';
  return dept;
}

function formatSqlUtc(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function parseUtcTimestamp(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  const str = String(ts).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    return new Date(str.replace(' ', 'T') + 'Z');
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Compute the 5:30 PM IST deadline for a challenge based on when it was uploaded.
 * - Uploaded before 5:30 PM IST -> ends at 5:30 PM IST that same day.
 * - Uploaded at/after 5:30 PM IST -> ends at 5:30 PM IST the next day.
 */
function getChallengeExpiresAt(challenge) {
  const createdAt = parseUtcTimestamp(challenge?.created_at);
  if (!createdAt) return null;
  const istCreated = new Date(createdAt.getTime() + IST_OFFSET_MS);
  const istMinutes = istCreated.getUTCHours() * 60 + istCreated.getUTCMinutes();
  const dayOffset = istMinutes >= 17 * 60 + 30 ? 1 : 0;
  const expiresIstMs = Date.UTC(
    istCreated.getUTCFullYear(),
    istCreated.getUTCMonth(),
    istCreated.getUTCDate() + dayOffset,
    17, 30, 0, 0
  );
  return new Date(expiresIstMs - IST_OFFSET_MS);
}

function isChallengeExpired(challenge, now = new Date()) {
  const expiresAt = getChallengeExpiresAt(challenge);
  if (!expiresAt) return false;
  return now.getTime() >= expiresAt.getTime();
}

/**
 * Most recent 5:30 PM IST boundary in UTC.
 * Any challenge created before this boundary has already passed its 5:30 PM IST end time.
 */
function getLast530PmIstUtc(now = new Date()) {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const istMinutes = istNow.getUTCHours() * 60 + istNow.getUTCMinutes();
  const dayOffset = istMinutes >= 17 * 60 + 30 ? 0 : -1;
  const cutoffIstMs = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate() + dayOffset,
    17, 30, 0, 0
  );
  return new Date(cutoffIstMs - IST_OFFSET_MS);
}

async function expireOldChallenges(db) {
  const cutoff530Pm = formatSqlUtc(getLast530PmIstUtc());
  await db.prepare('UPDATE mcq_challenges SET is_active = 0 WHERE is_active = 1 AND created_at < ?').run(cutoff530Pm);
  return cutoff530Pm;
}

/**
 * GET /api/quiz/daily
 * Get today's active challenge with sanitized questions (no correct flags)
 * Challenges automatically complete at 5:30 PM IST.
 */
router.get('/daily', requireApproved, async (req, res, next) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const cutoff530Pm = await expireOldChallenges(db);

    // Find active challenge for the current 5:30 PM IST cycle, matching student department & semester
    let challengeQuery = `
      SELECT c.*, s.name as subject_name
      FROM mcq_challenges c
      LEFT JOIN subjects s ON c.subject_id = s.id
      WHERE c.is_active = 1 AND c.created_at >= ? AND c.challenge_date <= ?
    `;
    let challengeParams = [cutoff530Pm, today];

    if (req.user.role === 'student') {
      const userDept = normalizeDept(req.user.department);
      const userSem = parseInt(req.user.semester, 10);
      challengeQuery += ' AND (c.department = ? OR c.department = ?)';
      challengeParams.push(userDept, req.user.department || '');
      if (userSem) {
        challengeQuery += ' AND c.semester = ?';
        challengeParams.push(userSem);
      }
    } else {
      const { department, semester } = req.query;
      if (department) {
        const normDept = normalizeDept(department);
        challengeQuery += ' AND (c.department = ? OR c.department = ?)';
        challengeParams.push(normDept, department);
      }
      if (semester) {
        challengeQuery += ' AND c.semester = ?';
        challengeParams.push(parseInt(semester, 10));
      }
    }

    challengeQuery += ' ORDER BY c.created_at DESC LIMIT 1';
    let challenge = await db.prepare(challengeQuery).get(...challengeParams);

    if (!challenge) {
      return res.status(200).json({
        success: true,
        challenge: null,
        message: 'No active competition right now. Check back tomorrow morning!',
      });
    }

    // Check if user already attempted
    const userAttempt = await db.prepare(`
      SELECT id, is_submitted, score, time_taken_seconds, submitted_at
      FROM quiz_attempts
      WHERE challenge_id = ? AND user_id = ?
    `).get(challenge.id, req.user.id);

    // Fetch questions linked to this challenge
    const questions = await db.prepare(`
      SELECT q.id, q.question_text, q.difficulty, q.subject_id
      FROM questions q
      WHERE q.challenge_id = ?
      ORDER BY q.created_at ASC
    `).all(challenge.id);

    // Fetch options for each question without exposing is_correct
    const questionsWithOptions = [];
    for (const q of questions) {
      const options = await db.prepare(`
        SELECT id, option_text, option_order
        FROM answer_options
        WHERE question_id = ?
        ORDER BY RANDOM()
      `).all(q.id);
      questionsWithOptions.push({ ...q, options });
    }

    const expiresAtDate = getChallengeExpiresAt(challenge);
    const expiresAt = expiresAtDate ? expiresAtDate.toISOString() : null;

    return res.status(200).json({
      success: true,
      challenge: {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        department: challenge.department,
        semester: challenge.semester,
        subject_name: challenge.subject_name,
        duration_minutes: challenge.duration_minutes,
        scoring_correct: challenge.scoring_correct,
        participation_bonus: challenge.participation_bonus,
        total_questions: questions.length,
        expires_at: expiresAt,
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
router.post('/:challengeId/start', requireApproved, async (req, res, next) => {
  req.body.challenge_id = req.params.challengeId;
  return handleStartAttempt(req, res, next);
});

/**
 * POST /api/quiz/attempts
 * Start an official quiz attempt
 */
router.post('/attempts', requireApproved, handleStartAttempt);

async function handleStartAttempt(req, res, next) {
  try {
    const { challenge_id } = req.body;
    if (!challenge_id) {
      return res.status(400).json({ error: 'challenge_id is required.' });
    }

    const db = getDb();

    // Verify challenge exists, is active, and is within its 24-hour window
    const challenge = await db.prepare('SELECT * FROM mcq_challenges WHERE id = ? AND is_active = 1').get(challenge_id);
    if (!challenge) {
      return res.status(404).json({ error: 'Competition not found or is currently closed.' });
    }
    if (isChallengeExpired(challenge)) {
      await db.prepare('UPDATE mcq_challenges SET is_active = 0 WHERE id = ?').run(challenge.id);
      return res.status(400).json({ error: 'This daily quiz has ended (5:30 PM IST deadline reached).' });
    }

    // Strict Department & Semester verification for students
    if (req.user.role === 'student') {
      const userDept = normalizeDept(req.user.department);
      const chDept = normalizeDept(challenge.department);
      const userSem = parseInt(req.user.semester, 10);
      const chSem = parseInt(challenge.semester, 10);

      if (chSem && userSem && chSem !== userSem) {
        return res.status(403).json({ error: `Access denied: This battle is designated for Semester ${challenge.semester}.` });
      }
      if (chDept && userDept && chDept !== userDept) {
        return res.status(403).json({ error: `Access denied: This battle is designated for ${challenge.department}.` });
      }
    }

    // Check existing attempt
    const existingAttempt = await db.prepare(
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
    await db.prepare(`
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
router.post('/:challengeId/submit', requireApproved, async (req, res, next) => {
  const db = getDb();
  const attempt = await db.prepare('SELECT id FROM quiz_attempts WHERE challenge_id = ? AND user_id = ?').get(
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

async function handleSubmitAttempt(req, res, next) {
  try {
    const { id } = req.params;
    const { answers, time_taken_seconds } = req.body; // answers: { [questionId]: optionId }

    const db = getDb();
    const attempt = await db.prepare('SELECT * FROM quiz_attempts WHERE id = ? AND user_id = ?').get(id, req.user.id);

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found.' });
    }

    if (attempt.is_submitted) {
      return res.status(400).json({ error: 'This challenge attempt has already been submitted.' });
    }

    const challenge = await db.prepare('SELECT * FROM mcq_challenges WHERE id = ?').get(attempt.challenge_id);
    const questions = await db.prepare('SELECT id FROM questions WHERE challenge_id = ?').all(attempt.challenge_id);

    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalUnanswered = 0;

    const correctPts = challenge.scoring_correct || 10;
    const bonusPts = challenge.participation_bonus || 5;

    const answerInsertStmt = db.prepare(`
      INSERT INTO student_answers (id, attempt_id, question_id, selected_option_id, is_correct)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const q of questions) {
      const selectedOptionId = answers ? answers[q.id] : null;

      if (!selectedOptionId) {
        totalUnanswered++;
        await answerInsertStmt.run(generateId(), id, q.id, null, 0);
      } else {
        const opt = await db.prepare('SELECT is_correct FROM answer_options WHERE id = ? AND question_id = ?').get(
          selectedOptionId,
          q.id
        );

        if (opt && opt.is_correct === 1) {
          totalCorrect++;
          await answerInsertStmt.run(generateId(), id, q.id, selectedOptionId, 1);
        } else {
          totalIncorrect++;
          await answerInsertStmt.run(generateId(), id, q.id, selectedOptionId, 0);
        }
      }
    }

    const rawScore = totalCorrect * correctPts + bonusPts;

    // Update attempt record
    await db.prepare(`
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
    await db.prepare(`
      UPDATE users
      SET total_points = total_points + ?,
          study_streak = study_streak + 1,
          last_active_date = datetime('now')
      WHERE id = ?
    `).run(rawScore, req.user.id);

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
router.get('/:challengeId/results', requireApproved, async (req, res, next) => {
  const db = getDb();
  const attempt = await db.prepare('SELECT id FROM quiz_attempts WHERE challenge_id = ? AND user_id = ?').get(
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

async function handleGetResults(req, res, next) {
  try {
    const { id } = req.params;
    const db = getDb();

    const attempt = await db.prepare(`
      SELECT a.*, c.title as challenge_title
      FROM quiz_attempts a
      JOIN mcq_challenges c ON a.challenge_id = c.id
      WHERE a.id = ? AND (a.user_id = ? OR ? = 'admin')
    `).get(id, req.user.id, req.user.role);

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt result not found.' });
    }

    // Fetch questions and answers
    const studentAnswers = await db.prepare(`
      SELECT sa.*, q.question_text, q.explanation
      FROM student_answers sa
      JOIN questions q ON sa.question_id = q.id
      WHERE sa.attempt_id = ?
    `).all(id);

    const detailedQuestions = [];
    for (const sa of studentAnswers) {
      const options = await db.prepare('SELECT id, option_text, is_correct FROM answer_options WHERE question_id = ?').all(
        sa.question_id
      );
      detailedQuestions.push({
        questionId: sa.question_id,
        questionText: sa.question_text,
        explanation: sa.explanation,
        selectedOptionId: sa.selected_option_id,
        isCorrect: sa.is_correct === 1,
        options,
      });
    }

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
 * Compute UTC bounds ('YYYY-MM-DD HH:MM:SS') for IST (+05:30) leaderboard windows.
 * - daily: 5:00 PM IST to 5:00 PM IST
 * - weekly: Monday 00:00:00 IST to Sunday 23:59:59 IST (exclusive next Monday 00:00:00 IST)
 */
function getIstLeaderboardWindow(type, now = new Date()) {
  const IST_OFFSET_MS = 330 * 60 * 1000;
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const formatSqlUtc = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

  if (type === 'daily') {
    const dayOffset = istNow.getUTCHours() >= 17 ? 0 : -1;
    const startIstMs = Date.UTC(
      istNow.getUTCFullYear(),
      istNow.getUTCMonth(),
      istNow.getUTCDate() + dayOffset,
      17, 0, 0, 0
    );
    const startUtc = new Date(startIstMs - IST_OFFSET_MS);
    const endUtc = new Date(startIstMs + 24 * 60 * 60 * 1000 - IST_OFFSET_MS);
    return { start: formatSqlUtc(startUtc), end: formatSqlUtc(endUtc) };
  }

  // weekly: Monday 00:00:00 IST to Sunday 23:59:59.999 IST
  const daysSinceMonday = (istNow.getUTCDay() + 6) % 7;
  const startIstMs = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate() - daysSinceMonday,
    0, 0, 0, 0
  );
  const startUtc = new Date(startIstMs - IST_OFFSET_MS);
  const endUtc = new Date(startIstMs + 7 * 24 * 60 * 60 * 1000 - IST_OFFSET_MS);
  return { start: formatSqlUtc(startUtc), end: formatSqlUtc(endUtc) };
}

/**
 * GET /api/quiz/leaderboard
 * Rankings: Daily (5 PM - 5 PM IST / Active Battle), Weekly (Mon - Sun IST), or All-Time
 * Interconnected: Daily scores roll up into Weekly, and Weekly into All-Time.
 */
router.get('/leaderboard', requireApproved, async (req, res, next) => {
  try {
    const { type = 'daily' } = req.query;
    const db = getDb();

    let query = '';
    let params = [];

    if (type === 'daily') {
      const { start, end } = getIstLeaderboardWindow('daily');
      const activeChallenge = await db.prepare(
        'SELECT id FROM mcq_challenges WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
      ).get();

      if (activeChallenge?.id) {
        query = `
          SELECT u.id as user_id, u.full_name, u.avatar_url, u.department, u.semester,
                 SUM(qa.score) as score,
                 SUM(qa.time_taken_seconds) as time_taken_seconds,
                 SUM(qa.total_correct) as total_correct,
                 COUNT(qa.id) as total_attempts
          FROM quiz_attempts qa
          JOIN users u ON qa.user_id = u.id
          WHERE qa.is_submitted = 1
            AND u.status = 'approved'
            AND (qa.challenge_id = ? OR (qa.submitted_at >= ? AND qa.submitted_at < ?))
          GROUP BY u.id, u.full_name, u.avatar_url, u.department, u.semester
          ORDER BY score DESC, time_taken_seconds ASC
          LIMIT 50
        `;
        params = [activeChallenge.id, start, end];
      } else {
        query = `
          SELECT u.id as user_id, u.full_name, u.avatar_url, u.department, u.semester,
                 SUM(qa.score) as score,
                 SUM(qa.time_taken_seconds) as time_taken_seconds,
                 SUM(qa.total_correct) as total_correct,
                 COUNT(qa.id) as total_attempts
          FROM quiz_attempts qa
          JOIN users u ON qa.user_id = u.id
          WHERE qa.is_submitted = 1
            AND u.status = 'approved'
            AND qa.submitted_at >= ?
            AND qa.submitted_at < ?
          GROUP BY u.id, u.full_name, u.avatar_url, u.department, u.semester
          ORDER BY score DESC, time_taken_seconds ASC
          LIMIT 50
        `;
        params = [start, end];
      }
    } else if (type === 'weekly') {
      const { start, end } = getIstLeaderboardWindow('weekly');
      query = `
        SELECT u.id as user_id, u.full_name, u.avatar_url, u.department, u.semester,
               SUM(qa.score) as score,
               SUM(qa.time_taken_seconds) as time_taken_seconds,
               SUM(qa.total_correct) as total_correct,
               COUNT(qa.id) as total_attempts
        FROM quiz_attempts qa
        JOIN users u ON qa.user_id = u.id
        WHERE qa.is_submitted = 1
          AND u.status = 'approved'
          AND qa.submitted_at >= ?
          AND qa.submitted_at < ?
        GROUP BY u.id, u.full_name, u.avatar_url, u.department, u.semester
        ORDER BY score DESC, time_taken_seconds ASC
        LIMIT 50
      `;
      params = [start, end];
    } else {
      // All-Time Leaderboard - interconnected with quiz attempts and cumulative total_points
      query = `
        SELECT u.id as user_id, u.full_name, u.avatar_url, u.department, u.semester,
               COALESCE(SUM(qa.score), u.total_points, 0) as score,
               COALESCE(SUM(qa.time_taken_seconds), 0) as time_taken_seconds,
               COALESCE(SUM(qa.total_correct), 0) as total_correct,
               COUNT(qa.id) as total_attempts,
               u.study_streak
        FROM users u
        LEFT JOIN quiz_attempts qa ON qa.user_id = u.id AND qa.is_submitted = 1
        WHERE u.status = 'approved'
        GROUP BY u.id, u.full_name, u.avatar_url, u.department, u.semester, u.total_points, u.study_streak
        HAVING COALESCE(SUM(qa.score), u.total_points, 0) > 0
        ORDER BY score DESC, time_taken_seconds ASC, u.study_streak DESC
        LIMIT 50
      `;
    }

    const leaderboard = await db.prepare(query).all(...params);

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
router.get('/practice', requireApproved, async (req, res, next) => {
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

    const questions = await db.prepare(query).all(...params);

    const fullQuestions = [];
    for (const q of questions) {
      const options = await db.prepare('SELECT id, option_text, is_correct FROM answer_options WHERE question_id = ?').all(
        q.id
      );
      fullQuestions.push({ ...q, options });
    }

    return res.status(200).json({ success: true, questions: fullQuestions });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quiz/daily/history
 */
router.get('/daily/history', requireApproved, async (req, res, next) => {
  try {
    const db = getDb();
    await expireOldChallenges(db);

    let activeQuery = 'SELECT id FROM mcq_challenges WHERE is_active = 1';
    let activeParams = [];
    if (req.user.role === 'student') {
      const userDept = normalizeDept(req.user.department);
      const userSem = parseInt(req.user.semester, 10);
      activeQuery += ' AND (department = ? OR department = ?)';
      activeParams.push(userDept, req.user.department || '');
      if (userSem) {
        activeQuery += ' AND semester = ?';
        activeParams.push(userSem);
      }
    }
    activeQuery += ' ORDER BY created_at DESC LIMIT 1';
    const activeChallenge = await db.prepare(activeQuery).get(...activeParams);
    const activeId = activeChallenge?.id || '';

    let historyQuery = `
      SELECT c.id, c.title, c.challenge_date, c.department, c.semester, s.name as subject_name,
             qa.score, qa.total_correct, qa.time_taken_seconds, qa.submitted_at
      FROM mcq_challenges c
      LEFT JOIN subjects s ON c.subject_id = s.id
      LEFT JOIN quiz_attempts qa ON qa.challenge_id = c.id AND qa.user_id = ?
      WHERE c.is_published = 1 AND c.is_active = 0 AND c.id != ?
    `;
    let historyParams = [req.user.id, activeId];

    if (req.user.role === 'student') {
      const userDept = normalizeDept(req.user.department);
      const userSem = parseInt(req.user.semester, 10);
      historyQuery += ' AND (c.department = ? OR c.department = ?)';
      historyParams.push(userDept, req.user.department || '');
      if (userSem) {
        historyQuery += ' AND c.semester = ?';
        historyParams.push(userSem);
      }
    } else {
      const { department, semester } = req.query;
      if (department) {
        const normDept = normalizeDept(department);
        historyQuery += ' AND (c.department = ? OR c.department = ?)';
        historyParams.push(normDept, department);
      }
      if (semester) {
        historyQuery += ' AND c.semester = ?';
        historyParams.push(parseInt(semester, 10));
      }
    }

    historyQuery += ' ORDER BY c.challenge_date DESC, c.created_at DESC LIMIT 20';
    const history = await db.prepare(historyQuery).all(...historyParams);
    return res.status(200).json({ success: true, history });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quiz/my-attempts
 */
router.get('/my-attempts', requireApproved, async (req, res, next) => {
  try {
    const db = getDb();
    const attempts = await db.prepare(`
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
router.post('/questions', requireAdmin, async (req, res, next) => {
  try {
    const { question_text, explanation, difficulty = 'medium', subject_id, challenge_id, options } = req.body;

    if (!question_text || !options || options.length < 2) {
      return res.status(400).json({ error: 'Question text and at least 2 options are required.' });
    }

    const db = getDb();
    const questionId = generateId();

    await db.prepare(`
      INSERT INTO questions (id, challenge_id, question_text, explanation, difficulty, subject_id, is_approved, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(questionId, challenge_id || null, question_text.trim(), explanation || null, difficulty, subject_id || null, req.user.id);

    const optStmt = db.prepare(`
      INSERT INTO answer_options (id, question_id, option_text, is_correct, option_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let idx = 0; idx < options.length; idx++) {
      const opt = options[idx];
      await optStmt.run(generateId(), questionId, opt.text.trim(), opt.isCorrect ? 1 : 0, idx + 1);
    }

    return res.status(201).json({ success: true, message: 'Question forged successfully!', questionId });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quiz/questions (Admin)
 */
router.get('/questions', requireAdmin, async (req, res, next) => {
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

    const countRow = await db.prepare(`SELECT COUNT(*) as total FROM questions q ${whereClause}`).get(...params);
    const total = countRow ? parseInt(countRow.total, 10) : 0;

    const questions = await db.prepare(`
      SELECT q.*, s.name as subject_name
      FROM questions q
      LEFT JOIN subjects s ON q.subject_id = s.id
      ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, l, o);

    const questionsWithOptions = [];
    for (const q of questions) {
      const options = await db.prepare('SELECT * FROM answer_options WHERE question_id = ?').all(q.id);
      questionsWithOptions.push({ ...q, options });
    }

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
router.post('/challenges', requireAdmin, async (req, res, next) => {
  try {
    const {
      title,
      description,
      subject_id,
      department,
      semester,
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

    await db.prepare(`
      INSERT INTO mcq_challenges (
        id, title, description, subject_id, department, semester, challenge_date, duration_minutes,
        scoring_correct, participation_bonus, is_active, is_published, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
    `).run(
      challengeId,
      title.trim(),
      description || null,
      subject_id || null,
      department ? department.trim() : null,
      semester ? parseInt(semester, 10) : null,
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
        await linkStmt.run(challengeId, qid);
      }
    }

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
 * PUT /api/quiz/challenges/:id (Admin)
 */
router.put('/challenges/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      subject_id,
      department,
      semester,
      challenge_date,
      duration_minutes,
      scoring_correct,
      participation_bonus,
      is_active,
    } = req.body;

    const db = getDb();
    await db.prepare(`
      UPDATE mcq_challenges
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          subject_id = COALESCE(?, subject_id),
          department = COALESCE(?, department),
          semester = COALESCE(?, semester),
          challenge_date = COALESCE(?, challenge_date),
          duration_minutes = COALESCE(?, duration_minutes),
          scoring_correct = COALESCE(?, scoring_correct),
          participation_bonus = COALESCE(?, participation_bonus),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      title ? title.trim() : null,
      description !== undefined ? description : null,
      subject_id !== undefined ? subject_id : null,
      department !== undefined ? (department ? department.trim() : null) : null,
      semester !== undefined ? (semester ? parseInt(semester, 10) : null) : null,
      challenge_date || null,
      duration_minutes ? parseInt(duration_minutes, 10) : null,
      scoring_correct ? parseInt(scoring_correct, 10) : null,
      participation_bonus ? parseInt(participation_bonus, 10) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      id
    );

    return res.status(200).json({ success: true, message: 'Challenge updated successfully.' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quiz/challenges (Admin)
 */
router.get('/challenges', requireAdmin, async (req, res, next) => {
  try {
    const db = getDb();
    await expireOldChallenges(db);
    const challenges = await db.prepare(`
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

/**
 * DELETE /api/quiz/challenges/:id (Admin)
 * Permanently delete an MCQ battle and clean up its attempts cleanly.
 */
router.delete('/challenges/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const challenge = await db.prepare('SELECT id, title FROM mcq_challenges WHERE id = ?').get(id);
    if (!challenge) {
      return res.status(404).json({ error: 'MCQ battle not found.' });
    }

    // 1. Clean up student answers linked to attempts in this challenge
    await db.prepare(
      'DELETE FROM student_answers WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE challenge_id = ?)'
    ).run(id);

    // 2. Clean up quiz attempts for this challenge
    await db.prepare('DELETE FROM quiz_attempts WHERE challenge_id = ?').run(id);

    // 3. Unlink questions so reusable Question Bank items are preserved
    await db.prepare('UPDATE questions SET challenge_id = NULL WHERE challenge_id = ?').run(id);

    // 4. Delete the challenge itself
    await db.prepare('DELETE FROM mcq_challenges WHERE id = ?').run(id);

    return res.status(200).json({
      success: true,
      message: `Deleted MCQ battle "${challenge.title}".`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
