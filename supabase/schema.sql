-- =============================================================================
-- TopperBatch — Production PostgreSQL Schema for Supabase
-- Motto: "ISS SEM, 9 POINTER FIX!"
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. USERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
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
  last_active_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. SESSIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- =============================================================================
-- 3. PASSWORD RESETS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. SEMESTERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.semesters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  number INTEGER NOT NULL
);

-- =============================================================================
-- 5. SUBJECTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  semester_id INTEGER REFERENCES public.semesters(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 6. UNITS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.units (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  number INTEGER,
  subject_id TEXT REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 7. DOCUMENTS (PDF Question Banks & Study Material)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT DEFAULT 'application/pdf',
  subject_id TEXT REFERENCES public.subjects(id),
  unit_id TEXT REFERENCES public.units(id),
  semester_id INTEGER REFERENCES public.semesters(id),
  topic TEXT,
  uploaded_by TEXT REFERENCES public.users(id),
  is_visible INTEGER DEFAULT 1,
  is_indexed INTEGER DEFAULT 0,
  page_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 8. DOCUMENT PAGES (Per-page extracted text for RAG)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.document_pages (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 9. DOCUMENT CHUNKS (RAG embeddings & retrieval)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  page_number INTEGER,
  chunk_index INTEGER,
  content TEXT NOT NULL,
  embedding TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 10. CHAT CONVERSATIONS (AI Study Companion)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  document_id TEXT REFERENCES public.documents(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 11. CHAT MESSAGES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  sources TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 12. COMMUNITY CHANNELS (Strictly Exactly 3 Official Channels)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  is_private INTEGER DEFAULT 0,
  created_by TEXT REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 13. COMMUNITY MESSAGES (Live Chat)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.community_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES public.community_channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id),
  content TEXT NOT NULL,
  reply_to_id TEXT REFERENCES public.community_messages(id),
  is_pinned INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_size BIGINT,
  attachment_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 14. MESSAGE REACTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES public.community_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- =============================================================================
-- 15. MCQ CHALLENGES (Competitions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mcq_challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject_id TEXT REFERENCES public.subjects(id),
  challenge_date DATE NOT NULL,
  duration_minutes INTEGER DEFAULT 15,
  question_count INTEGER DEFAULT 10,
  is_active INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 0,
  scoring_correct INTEGER DEFAULT 10,
  scoring_incorrect INTEGER DEFAULT 0,
  scoring_unanswered INTEGER DEFAULT 0,
  participation_bonus INTEGER DEFAULT 5,
  created_by TEXT REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 16. QUESTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id TEXT PRIMARY KEY,
  challenge_id TEXT REFERENCES public.mcq_challenges(id) ON DELETE CASCADE,
  document_id TEXT REFERENCES public.documents(id),
  question_text TEXT NOT NULL,
  explanation TEXT,
  difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
  subject_id TEXT REFERENCES public.subjects(id),
  is_approved INTEGER DEFAULT 0,
  page_number INTEGER,
  topic TEXT,
  source_pdf_name TEXT,
  created_by TEXT REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 17. ANSWER OPTIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.answer_options (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct INTEGER DEFAULT 0,
  option_order INTEGER
);

-- =============================================================================
-- 18. QUIZ ATTEMPTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES public.mcq_challenges(id),
  user_id TEXT NOT NULL REFERENCES public.users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  score INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_incorrect INTEGER DEFAULT 0,
  total_unanswered INTEGER DEFAULT 0,
  time_taken_seconds INTEGER,
  is_submitted INTEGER DEFAULT 0,
  UNIQUE(challenge_id, user_id)
);

-- =============================================================================
-- 19. STUDENT ANSWERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.student_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id),
  selected_option_id TEXT REFERENCES public.answer_options(id),
  is_correct INTEGER,
  answered_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 20. ACHIEVEMENTS & USER ACHIEVEMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  badge_color TEXT,
  criteria TEXT,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- =============================================================================
-- 21. NOTIFICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 22. ANNOUNCEMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  is_active INTEGER DEFAULT 1,
  created_by TEXT REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- =============================================================================
-- 23. REPORTS & AUDIT LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES public.users(id),
  reported_message_id TEXT REFERENCES public.community_messages(id),
  reported_user_id TEXT REFERENCES public.users(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','reviewed','resolved','dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES public.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 24. PLATFORM SETTINGS & SAVED DOCUMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.saved_documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, document_id)
);

-- =============================================================================
-- 25. AI MCQ DRAFT SESSIONS (Admin-Only Generator)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mcq_draft_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES public.users(id),
  document_id TEXT REFERENCES public.documents(id),
  source_pdf_name TEXT,
  topic TEXT,
  difficulty TEXT DEFAULT 'mixed',
  question_style TEXT DEFAULT 'mixed',
  question_count INTEGER DEFAULT 10,
  instructions TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'review', 'published')),
  generated_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR MAXIMUM PRODUCTION SPEED
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON public.sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_documents_subject_id ON public.documents(subject_id);
CREATE INDEX IF NOT EXISTS idx_documents_semester_id ON public.documents(semester_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON public.document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_doc_page ON public.document_pages(document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_chunk ON public.document_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated ON public.chat_conversations(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created ON public.chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_messages_channel_id ON public.community_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_channel_created ON public.community_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_challenge_user ON public.quiz_attempts(challenge_id, user_id);
CREATE INDEX IF NOT EXISTS idx_questions_challenge ON public.questions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_questions_approved ON public.questions(is_approved);
CREATE INDEX IF NOT EXISTS idx_answer_options_question ON public.answer_options(question_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON public.audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_mcq_draft_sessions_admin ON public.mcq_draft_sessions(admin_id);

-- =============================================================================
-- SUPABASE REALTIME CONFIGURATION
-- Enable replication on community_messages and reactions for instant delivery
-- =============================================================================
ALTER TABLE public.community_messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;

