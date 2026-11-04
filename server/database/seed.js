// =============================================================================
// TopperBatch - Database Seed Data
// =============================================================================

const bcrypt = require('bcryptjs');
const { getDb } = require('./db');
const { runMigrations } = require('./migrate');
const { generateId } = require('../utils/helpers');

/**
 * Seed default data into the database.
 * Safe to run multiple times (uses INSERT OR IGNORE).
 */
function seedDatabase() {
  const db = getDb();

  console.log('🌱 Seeding database...');

  // =========================================================================
  // Permanent Administrators
  // =========================================================================
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('Donkey@6769', salt);

  const insertAdmin = db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, status, semester, department, total_points, study_streak)
    VALUES (?, ?, ?, ?, 'admin', 'approved', 7, 'Computer Engineering', 0, 0)
    ON CONFLICT(email) DO UPDATE SET
      password_hash = excluded.password_hash,
      role = 'admin',
      status = 'approved'
  `);

  insertAdmin.run('admin-1-parth', 'parthkadu05@gmail.com', adminHash, 'Parth Kadu');
  insertAdmin.run('admin-2-atharva', 'atharvabhoite697@gmail.com', adminHash, 'Atharva Bhoite');
  console.log('  ✅ Permanent admins verified');

  // =========================================================================
  // Exactly Three Official Community Channels (Announcements, Exam Discussion, Notes & Resources)
  // =========================================================================
  // Clean up any other channels to enforce exactly three channels
  db.prepare(`DELETE FROM community_channels WHERE name NOT IN ('Announcements', 'Exam Discussion', 'Notes & Resources')`).run();

  const officialChannels = [
    {
      id: 'chan-announcements',
      name: 'Announcements',
      description: 'Official announcements and verified notices from permanent administrators.',
      display_order: 1,
      is_default: 1,
    },
    {
      id: 'chan-exam-discussion',
      name: 'Exam Discussion',
      description: 'Batch discussion for exams, doubts, question banks, and paper updates.',
      display_order: 2,
      is_default: 1,
    },
    {
      id: 'chan-notes-resources',
      name: 'Notes & Resources',
      description: 'Shared study materials, PDF attachments, formula sheets, and academic links.',
      display_order: 3,
      is_default: 1,
    },
  ];

  const upsertChannel = db.prepare(`
    INSERT INTO community_channels (id, name, description, display_order, is_default)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      description = excluded.description,
      display_order = excluded.display_order,
      is_default = 1
  `);

  for (const channel of officialChannels) {
    upsertChannel.run(channel.id, channel.name, channel.description, channel.display_order, channel.is_default);
  }

  console.log('  ✅ Exactly 3 official community channels seeded in order');

  // =========================================================================
  // Default Semesters (1-8)
  // =========================================================================
  const insertSemester = db.prepare(
    'INSERT OR IGNORE INTO semesters (name, number) VALUES (?, ?)'
  );

  for (let i = 1; i <= 8; i++) {
    insertSemester.run(`Semester ${i}`, i);
  }

  console.log('  ✅ Semesters seeded');

  // =========================================================================
  // Default Achievements
  // =========================================================================
  const achievements = [
    {
      name: 'First Login',
      description: 'Welcome to TopperBatch! You logged in for the first time.',
      icon: '🎉',
      badge_color: '#4CAF50',
      criteria: JSON.stringify({ type: 'first_login' }),
      points: 10,
    },
    {
      name: 'Quiz Streak 3',
      description: 'Completed 3 daily quizzes in a row. Keep it up!',
      icon: '🔥',
      badge_color: '#FF9800',
      criteria: JSON.stringify({ type: 'quiz_streak', count: 3 }),
      points: 30,
    },
    {
      name: 'Quiz Streak 7',
      description: 'Completed 7 daily quizzes in a row. You\'re on fire!',
      icon: '💪',
      badge_color: '#F44336',
      criteria: JSON.stringify({ type: 'quiz_streak', count: 7 }),
      points: 70,
    },
    {
      name: 'Quiz Master',
      description: 'Completed 10 quizzes total. A true quiz master!',
      icon: '🏆',
      badge_color: '#9C27B0',
      criteria: JSON.stringify({ type: 'total_quizzes', count: 10 }),
      points: 100,
    },
    {
      name: 'Top Scorer',
      description: 'Achieved a perfect score on a quiz. Brilliant!',
      icon: '⭐',
      badge_color: '#FFD700',
      criteria: JSON.stringify({ type: 'perfect_score' }),
      points: 50,
    },
    {
      name: 'Community Contributor',
      description: 'Sent 50 messages in the community. Thanks for being active!',
      icon: '💬',
      badge_color: '#2196F3',
      criteria: JSON.stringify({ type: 'community_messages', count: 50 }),
      points: 40,
    },
  ];

  const insertAchievement = db.prepare(
    'INSERT OR IGNORE INTO achievements (id, name, description, icon, badge_color, criteria, points) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  for (const ach of achievements) {
    insertAchievement.run(
      generateId(),
      ach.name,
      ach.description,
      ach.icon,
      ach.badge_color,
      ach.criteria,
      ach.points
    );
  }

  console.log('  ✅ Achievements seeded');

  // =========================================================================
  // Default Platform Settings
  // =========================================================================
  const settings = [
    { key: 'max_sessions_per_user', value: '1' },
    { key: 'enable_private_messaging', value: 'false' },
    { key: 'mcq_questions_per_challenge', value: '10' },
  ];

  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)'
  );

  for (const setting of settings) {
    insertSetting.run(setting.key, setting.value);
  }

  console.log('  ✅ Platform settings seeded');

  console.log('✅ Database seeding completed successfully.');
}

// Allow running as standalone script
if (require.main === module) {
  runMigrations();
  seedDatabase();
  console.log('Seed script finished.');
  process.exit(0);
}

module.exports = { seedDatabase };
