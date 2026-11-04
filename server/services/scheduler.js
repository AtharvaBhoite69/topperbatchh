// =============================================================================
// TopperBatch - Scheduler Service (node-cron)
// =============================================================================

const cron = require('node-cron');
const { getDb } = require('../database/db');
const { generateId } = require('../utils/helpers');

/**
 * Start all scheduled tasks.
 */
function startScheduler() {
  console.log('⏰ Starting scheduler...');

  // =========================================================================
  // Every day at midnight: Activate the day's challenge
  // =========================================================================
  cron.schedule('0 0 * * *', () => {
    try {
      const db = getDb();
      const today = new Date().toISOString().split('T')[0];

      // Deactivate yesterday's challenges
      db.prepare('UPDATE mcq_challenges SET is_active = 0 WHERE is_active = 1').run();

      // Activate today's challenge
      const result = db.prepare(
        'UPDATE mcq_challenges SET is_active = 1 WHERE challenge_date = ? AND is_published = 0'
      ).run(today);

      if (result.changes > 0) {
        console.log(`📋 Activated ${result.changes} challenge(s) for ${today}`);

        // Notify all approved users
        const users = db.prepare(
          "SELECT id FROM users WHERE status = 'approved' AND role = 'student'"
        ).all();

        const insertNotification = db.prepare(
          'INSERT INTO notifications (id, user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)'
        );

        const notifyAll = db.transaction(() => {
          for (const user of users) {
            insertNotification.run(
              generateId(),
              user.id,
              'quiz',
              'Daily Challenge Available! 🎯',
              'A new daily quiz challenge is ready. Test your knowledge!',
              '/quiz/daily'
            );
          }
        });

        notifyAll();
      }
    } catch (err) {
      console.error('Scheduler error (activate challenges):', err);
    }
  });

  // =========================================================================
  // Every hour: Clean expired sessions
  // =========================================================================
  cron.schedule('0 * * * *', () => {
    try {
      const db = getDb();
      const result = db.prepare(
        "DELETE FROM sessions WHERE expires_at < datetime('now') OR is_active = 0"
      ).run();

      if (result.changes > 0) {
        console.log(`🧹 Cleaned ${result.changes} expired session(s).`);
      }
    } catch (err) {
      console.error('Scheduler error (clean sessions):', err);
    }
  });

  // =========================================================================
  // Every day at 00:30: Update study streaks
  // =========================================================================
  cron.schedule('30 0 * * *', () => {
    try {
      const db = getDb();
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // Increment streak for users active yesterday
      db.prepare(
        'UPDATE users SET study_streak = study_streak + 1 WHERE last_active_date >= ?'
      ).run(yesterday);

      // Reset streak for users NOT active yesterday
      db.prepare(
        'UPDATE users SET study_streak = 0 WHERE last_active_date < ? OR last_active_date IS NULL'
      ).run(yesterday);

      console.log('📊 Study streaks updated.');
    } catch (err) {
      console.error('Scheduler error (study streaks):', err);
    }
  });

  // =========================================================================
  // Every day at 01:00: Clean expired password reset tokens
  // =========================================================================
  cron.schedule('0 1 * * *', () => {
    try {
      const db = getDb();
      const result = db.prepare(
        "DELETE FROM password_resets WHERE expires_at < datetime('now') OR used = 1"
      ).run();

      if (result.changes > 0) {
        console.log(`🧹 Cleaned ${result.changes} expired password reset token(s).`);
      }
    } catch (err) {
      console.error('Scheduler error (clean password resets):', err);
    }
  });

  console.log('✅ Scheduler started successfully.');
}

module.exports = { startScheduler };
