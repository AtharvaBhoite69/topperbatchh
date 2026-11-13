// =============================================================================
// TopperBatch - Database Migrations
// =============================================================================

const { getDb } = require('./db');

/**
 * Run all migrations to create the database schema.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */
function runMigrations() {
  const db = getDb();

  console.log('🔄 Running database migrations...');

  db.exec(`
    -- =========================================================================
    -- Users
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','admin')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')),
      avatar_url TEXT,
      semester INTEGER,
      department TEXT,
      bio TEXT,
      total_points INTEGER DEFAULT 0,
      study_streak INTEGER DEFAULT 0,
      last_active_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Sessions
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      device_info TEXT,
      ip_address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    -- =========================================================================
    -- Password Reset Tokens
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Email OTP Verifications (Batch Registration Verification)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS email_verifications (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Semesters
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS semesters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      number INTEGER NOT NULL
    );

    -- =========================================================================
    -- Subjects
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      semester_id INTEGER REFERENCES semesters(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Units
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      number INTEGER,
      subject_id TEXT REFERENCES subjects(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Documents (PDFs)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT DEFAULT 'application/pdf',
      subject_id TEXT REFERENCES subjects(id),
      unit_id TEXT REFERENCES units(id),
      semester_id INTEGER REFERENCES semesters(id),
      topic TEXT,
      uploaded_by TEXT REFERENCES users(id),
      is_visible INTEGER DEFAULT 1,
      is_indexed INTEGER DEFAULT 0,
      page_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Document Pages (extracted text per page)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS document_pages (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL,
      content TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Document Chunks (for RAG)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      page_number INTEGER,
      chunk_index INTEGER,
      content TEXT NOT NULL,
      embedding TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Chat Conversations (AI Chatbot)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      document_id TEXT REFERENCES documents(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Chat Messages
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      sources TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Community Channels
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS community_channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      display_order INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      is_private INTEGER DEFAULT 0,
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Community Messages
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS community_messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES community_channels(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      reply_to_id TEXT REFERENCES community_messages(id),
      is_pinned INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      attachment_url TEXT,
      attachment_name TEXT,
      attachment_size INTEGER,
      attachment_type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Message Reactions
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(message_id, user_id, emoji)
    );

    -- =========================================================================
    -- MCQ Challenges
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS mcq_challenges (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      subject_id TEXT REFERENCES subjects(id),
      challenge_date TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 15,
      question_count INTEGER DEFAULT 10,
      is_active INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 0,
      scoring_correct INTEGER DEFAULT 10,
      scoring_incorrect INTEGER DEFAULT 0,
      scoring_unanswered INTEGER DEFAULT 0,
      participation_bonus INTEGER DEFAULT 5,
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Questions
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      challenge_id TEXT REFERENCES mcq_challenges(id) ON DELETE CASCADE,
      document_id TEXT REFERENCES documents(id),
      question_text TEXT NOT NULL,
      explanation TEXT,
      difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
      subject_id TEXT REFERENCES subjects(id),
      is_approved INTEGER DEFAULT 0,
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Answer Options
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS answer_options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL,
      is_correct INTEGER DEFAULT 0,
      option_order INTEGER
    );

    -- =========================================================================
    -- Quiz Attempts
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL REFERENCES mcq_challenges(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      started_at TEXT DEFAULT (datetime('now')),
      submitted_at TEXT,
      score INTEGER DEFAULT 0,
      total_correct INTEGER DEFAULT 0,
      total_incorrect INTEGER DEFAULT 0,
      total_unanswered INTEGER DEFAULT 0,
      time_taken_seconds INTEGER,
      is_submitted INTEGER DEFAULT 0,
      UNIQUE(challenge_id, user_id)
    );

    -- =========================================================================
    -- Student Answers
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS student_answers (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES questions(id),
      selected_option_id TEXT REFERENCES answer_options(id),
      is_correct INTEGER,
      answered_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Achievements
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      badge_color TEXT,
      criteria TEXT,
      points INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- User Achievements
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS user_achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL REFERENCES achievements(id),
      earned_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, achievement_id)
    );

    -- =========================================================================
    -- Notifications
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Announcements
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
      is_active INTEGER DEFAULT 1,
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    );

    -- =========================================================================
    -- Reports
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL REFERENCES users(id),
      reported_message_id TEXT REFERENCES community_messages(id),
      reported_user_id TEXT REFERENCES users(id),
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','reviewed','resolved','dismissed')),
      admin_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    -- =========================================================================
    -- Audit Logs
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      admin_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Platform Settings
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- =========================================================================
    -- Saved Documents (bookmarks)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS saved_documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, document_id)
    );

    -- =========================================================================
    -- AI MCQ Draft Sessions (Admin-Only MCQ Generator)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS mcq_draft_sessions (
      id TEXT PRIMARY KEY,
      admin_id TEXT REFERENCES users(id),
      document_id TEXT REFERENCES documents(id),
      source_pdf_name TEXT,
      topic TEXT,
      difficulty TEXT DEFAULT 'mixed',
      question_style TEXT DEFAULT 'mixed',
      question_count INTEGER DEFAULT 10,
      instructions TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'review', 'published')),
      generated_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // =========================================================================
  // Create Indexes
  // =========================================================================
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)',
    'CREATE INDEX IF NOT EXISTS idx_documents_subject_id ON documents(subject_id)',
    'CREATE INDEX IF NOT EXISTS idx_documents_semester_id ON documents(semester_id)',
    'CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON document_pages(document_id)',
    'CREATE INDEX IF NOT EXISTS idx_document_pages_doc_page ON document_pages(document_id, page_number)',
    'CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id)',
    'CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_chunk ON document_chunks(document_id, chunk_index)',
    'CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated ON chat_conversations(user_id, updated_at)',
    'CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created ON chat_messages(conversation_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_community_messages_channel_id ON community_messages(channel_id)',
    'CREATE INDEX IF NOT EXISTS idx_community_messages_channel_created ON community_messages(channel_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_quiz_attempts_challenge_user ON quiz_attempts(challenge_id, user_id)',
    'CREATE INDEX IF NOT EXISTS idx_questions_challenge ON questions(challenge_id)',
    'CREATE INDEX IF NOT EXISTS idx_questions_approved ON questions(is_approved)',
    'CREATE INDEX IF NOT EXISTS idx_answer_options_question ON answer_options(question_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email)',
    'CREATE INDEX IF NOT EXISTS idx_mcq_draft_sessions_admin ON mcq_draft_sessions(admin_id)',
  ];

  for (const idx of indexes) {
    db.exec(idx);
  }

  // Safe progressive column migrations
  try { db.exec('ALTER TABLE community_channels ADD COLUMN display_order INTEGER DEFAULT 0'); } catch (_) {}
  try { db.exec('ALTER TABLE community_messages ADD COLUMN attachment_url TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE community_messages ADD COLUMN attachment_name TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE community_messages ADD COLUMN attachment_size INTEGER'); } catch (_) {}
  try { db.exec('ALTER TABLE community_messages ADD COLUMN attachment_type TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE questions ADD COLUMN page_number INTEGER'); } catch (_) {}
  try { db.exec('ALTER TABLE questions ADD COLUMN topic TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE questions ADD COLUMN source_pdf_name TEXT'); } catch (_) {}

  console.log('✅ Database migrations completed successfully.');
}

// Allow running as standalone script
if (require.main === module) {
  runMigrations();
  console.log('Migration script finished.');
  process.exit(0);
}

module.exports = { runMigrations };
