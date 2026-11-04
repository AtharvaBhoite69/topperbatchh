// =============================================================================
// TopperBatch - Purge All Sample / Demo Data
// Leaves only the 2 Permanent Admins, default channels, semesters, & achievements
// =============================================================================

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { getDb } = require('./db');
const env = require('../config/env');

async function purgeSampleData() {
  const db = getDb();
  console.log('🧹 Purging all sample data from TopperBatch database...');

  // Disable FK constraints during batch purge
  db.exec('PRAGMA foreign_keys = OFF;');

  const adminEmails = ['parthkadu05@gmail.com', 'atharvabhoite697@gmail.com'];
  const salt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash('Donkey@6769', salt);

  // 1. Ensure permanent admins exist and have Donkey@6769 password
  const upsertAdmin = db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, status, semester, department, total_points, study_streak)
    VALUES (?, ?, ?, ?, 'admin', 'approved', 7, 'Computer Engineering', 0, 0)
    ON CONFLICT(email) DO UPDATE SET
      password_hash = excluded.password_hash,
      role = 'admin',
      status = 'approved'
  `);

  upsertAdmin.run('admin-1-parth', 'parthkadu05@gmail.com', adminHash, 'Parth Kadu');
  upsertAdmin.run('admin-2-atharva', 'atharvabhoite697@gmail.com', adminHash, 'Atharva Bhoite');
  console.log('  ✅ Permanent admins verified with Donkey@6769');

  // 2. Remove all other users
  const delUsers = db.prepare(`DELETE FROM users WHERE email NOT IN ('parthkadu05@gmail.com', 'atharvabhoite697@gmail.com')`);
  const userResult = delUsers.run();
  console.log(`  ✅ Removed ${userResult.changes} non-admin demo users`);

  // 3. Clear all sample documents and chunks
  db.prepare('DELETE FROM saved_documents').run();
  db.prepare('DELETE FROM document_chunks').run();
  db.prepare('DELETE FROM document_pages').run();
  db.prepare('DELETE FROM documents').run();
  db.prepare('DELETE FROM units').run();
  db.prepare('DELETE FROM subjects').run();
  console.log('  ✅ Cleared documents, chunks, units, and subjects');

  // 4. Clear all sample challenges, questions, options, attempts
  db.prepare('DELETE FROM student_answers').run();
  db.prepare('DELETE FROM quiz_attempts').run();
  db.prepare('DELETE FROM answer_options').run();
  db.prepare('DELETE FROM questions').run();
  db.prepare('DELETE FROM mcq_challenges').run();
  console.log('  ✅ Cleared challenges, questions, and quiz attempts');

  // 5. Clear sample announcements, community messages, reactions
  db.prepare('DELETE FROM message_reactions').run();
  db.prepare('DELETE FROM community_messages').run();
  db.prepare('DELETE FROM announcements').run();
  db.prepare('DELETE FROM notifications').run();
  db.prepare('DELETE FROM reports').run();
  db.prepare('DELETE FROM audit_logs').run();
  db.prepare('DELETE FROM sessions').run();
  console.log('  ✅ Cleared messages, announcements, notifications, and logs');

  // 6. Delete sample PDF files in server/uploads
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const f of files) {
      if (f.startsWith('sample-') || f.endsWith('.pdf')) {
        try {
          fs.unlinkSync(path.join(uploadsDir, f));
          console.log(`  🗑️ Deleted sample file: ${f}`);
        } catch (err) {
          console.warn(`  Could not delete ${f}:`, err.message);
        }
      }
    }
  }

  db.exec('PRAGMA foreign_keys = ON;');
  console.log('🎉 All sample data successfully purged! Clean state ready.');
}

if (require.main === module) {
  purgeSampleData().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { purgeSampleData };
