// =============================================================================
// TopperBatch - Exam Calendar & Timetable Routes
// Department + Semester Role-Based Access Control
// Allows Admins to add, edit, or delete exams for any particular department & semester.
// Students can only view exams belonging to their assigned department and semester.
// =============================================================================

const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { generateId } = require('../utils/helpers');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/calendar
 * Fetch exam calendar events.
 * - Students: strictly restricted to their department and semester.
 * - Admins: full access, optionally filterable by query params (?department=...&semester=...).
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const isAdmin = req.user.role === 'admin';
    const { department, semester } = req.query;

    let query = 'SELECT * FROM exam_calendar_events';
    const params = [];
    const conditions = [];

    if (!isAdmin) {
      // Student Access: strictly their assigned department & semester (plus common/All)
      const studentDept = req.user.department || 'AI & ML';
      const studentSem = parseInt(req.user.semester, 10) || 5;

      conditions.push("(department = ? OR department = 'All' OR department IS NULL)");
      params.push(studentDept);

      conditions.push('semester = ?');
      params.push(studentSem);
    } else {
      // Admin Access: optional filters
      if (department && department !== 'All' && department !== 'all') {
        conditions.push('(department = ? OR department = \'All\')');
        params.push(department.trim());
      }
      if (semester && parseInt(semester, 10)) {
        conditions.push('semester = ?');
        params.push(parseInt(semester, 10));
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY exam_date ASC, start_time ASC';

    const events = await db.prepare(query).all(...params);

    return res.status(200).json({
      success: true,
      events: events || [],
      department: !isAdmin ? (req.user.department || 'AI & ML') : (department || 'All'),
      semester: !isAdmin ? (req.user.semester || 5) : (semester ? parseInt(semester, 10) : 'All'),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/calendar
 * Admin: Add a new exam calendar event for a specific department and semester.
 */
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const {
      department,
      semester,
      subject,
      short_subject,
      paper_code,
      exam_date,
      start_time = '02:30 PM',
      end_time = '04:30 PM',
      reporting_time = '02:00 PM',
      duration = '2 Hours (120 Mins)',
      category = 'Core Course (PCC)',
      accent = 'yellow',
    } = req.body;

    if (!department || !semester || !subject || !exam_date) {
      return res.status(400).json({
        error: 'Department, Semester, Subject Name, and Exam Date are required.',
      });
    }

    const db = getDb();
    const id = generateId();
    const cleanDept = department.trim();
    const cleanSem = parseInt(semester, 10);
    const cleanSubject = subject.trim();
    const cleanShort = (short_subject || subject).trim();
    const cleanPaperCode = (paper_code || '').trim() || null;
    const cleanDate = exam_date.trim();

    await db.prepare(`
      INSERT INTO exam_calendar_events (
        id, department, semester, subject, short_subject, paper_code,
        exam_date, start_time, end_time, reporting_time, duration,
        category, accent, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      cleanDept,
      cleanSem,
      cleanSubject,
      cleanShort,
      cleanPaperCode,
      cleanDate,
      start_time.trim(),
      end_time.trim(),
      reporting_time.trim(),
      duration.trim(),
      category.trim(),
      accent.trim(),
      req.user.id
    );

    const createdEvent = await db.prepare('SELECT * FROM exam_calendar_events WHERE id = ?').get(id);

    return res.status(201).json({
      success: true,
      event: createdEvent,
      message: `Exam "${cleanShort}" scheduled successfully for ${cleanDept} (Sem ${cleanSem})!`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/calendar/:id
 * Admin: Update an existing exam calendar event.
 */
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      department,
      semester,
      subject,
      short_subject,
      paper_code,
      exam_date,
      start_time,
      end_time,
      reporting_time,
      duration,
      category,
      accent,
    } = req.body;

    const db = getDb();
    const existing = await db.prepare('SELECT * FROM exam_calendar_events WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Exam calendar event not found.' });
    }

    const updatedDept = department ? department.trim() : existing.department;
    const updatedSem = semester ? parseInt(semester, 10) : existing.semester;
    const updatedSubject = subject ? subject.trim() : existing.subject;
    const updatedShort = short_subject ? short_subject.trim() : existing.short_subject;
    const updatedPaperCode = paper_code !== undefined ? (paper_code ? paper_code.trim() : null) : existing.paper_code;
    const updatedDate = exam_date ? exam_date.trim() : existing.exam_date;
    const updatedStartTime = start_time ? start_time.trim() : existing.start_time;
    const updatedEndTime = end_time ? end_time.trim() : existing.end_time;
    const updatedReporting = reporting_time ? reporting_time.trim() : existing.reporting_time;
    const updatedDuration = duration ? duration.trim() : existing.duration;
    const updatedCategory = category ? category.trim() : existing.category;
    const updatedAccent = accent ? accent.trim() : existing.accent;

    await db.prepare(`
      UPDATE exam_calendar_events
      SET department = ?, semester = ?, subject = ?, short_subject = ?,
          paper_code = ?, exam_date = ?, start_time = ?, end_time = ?,
          reporting_time = ?, duration = ?, category = ?, accent = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      updatedDept,
      updatedSem,
      updatedSubject,
      updatedShort,
      updatedPaperCode,
      updatedDate,
      updatedStartTime,
      updatedEndTime,
      updatedReporting,
      updatedDuration,
      updatedCategory,
      updatedAccent,
      id
    );

    const updatedEvent = await db.prepare('SELECT * FROM exam_calendar_events WHERE id = ?').get(id);

    return res.status(200).json({
      success: true,
      event: updatedEvent,
      message: `Exam "${updatedShort}" updated successfully!`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/calendar/:id
 * Admin: Delete an exam calendar event.
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const existing = await db.prepare('SELECT * FROM exam_calendar_events WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Exam calendar event not found.' });
    }

    await db.prepare('DELETE FROM exam_calendar_events WHERE id = ?').run(id);

    return res.status(200).json({
      success: true,
      message: `Exam "${existing.short_subject || existing.subject}" removed from timetable.`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
