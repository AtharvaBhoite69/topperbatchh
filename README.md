# 💥 TOPPERBATCH — ISS SEM, 9 POINTER FIX! 💥

> **Your Batch. Your Rules.**  
> A private, high-performance college student community combining question banks, RAG-grounded Gemini AI, daily MCQ battle competitions, Supabase Realtime live chat, and leaderboards.

---

## 🎨 Visual Design Language

TopperBatch is designed with a **Retro Comic Book + Street Art + Vintage Gaming** aesthetic:
- **Warm Cream & Olive Palettes**: `#F5E9D1` and `#666052`
- **Bold 3px/4px Ink Borders**: `#171510`
- **Thick Offset Comic Drop Shadows**: `6px 6px 0px #171510`
- **High-Impact Typography**: *Anton* (condensed bold headlines), *Bangers* (comic callouts & badges), and *Inter* (body text)
- **Halftone Dot Patterns & Vintage Noise Overlays**
- **Dynamic Starbursts, Speech Bubbles, and Sticker Badges**
- **Vibrant Accent Colors**: Comic Yellow (`#F5B900`), Punch Red (`#F0442E`), Victory Green (`#258C48`)

---

## 🛡️ Permanent Administrators

Permanent administrator privileges are strictly controlled server-side:

```env
ADMIN_EMAIL_1=parthkadu05@gmail.com
ADMIN_EMAIL_2=atharvabhoite697@gmail.com
```

- When these addresses register or log in, the server automatically assigns and guarantees `role = 'admin'` and `status = 'approved'`.
- Normal student accounts are created with `status = 'pending'` and must be approved by one of the administrators in the **Pending Recruits** dashboard before gaining access to protected materials.
- No client-side request or public endpoint can elevate privileges or modify roles.

---

## 🚀 Key Modules & Capabilities

1. **Student Command Post (Dashboard)**:
   - Personalized greeting, daily study streak, total batch points, and rank.
   - Comic quick-access cards linking directly to active features.
   - Official batch broadcast notifications and today's active MCQ battle banner.

2. **Question Bank Vault & Protected Viewer**:
   - Filterable by semester, subject, and unit.
   - Supabase Private Storage integration with 1-hour short-lived signed URLs.
   - Protected inline PDF streaming with **student-specific watermarks** (`email`, `name`, `timestamp`) to deter leaks.
   - Right-click and text-selection deterrents.

3. **Gemini 3.5 Flash Lite RAG AI Study Buddy**:
   - Split-screen chat interface with session history and high-speed SSE streaming.
   - Grounded PDF answering: extracts true per-page text, creates semantic chunks, and cites exact PDF title and page numbers.
   - Pre-loaded high-yield prompts for quick exam preparation.

4. **Admin-Only AI PDF-to-MCQ Generator**:
   - Administrators can upload any question bank PDF or select a vault document.
   - Generates high-accuracy 4-option MCQs citing exact source PDF and page number.
   - Full review & edit interface: edit text, swap answers, regenerate individual questions, and save drafts.
   - One-click publish to the Daily MCQ Battle Challenge or save to Question Bank.

5. **Daily MCQ Battle Arena & Leaderboard**:
   - Daily timed challenge with server-side validation.
   - Scoring: `+10 points` per correct answer, `+5 participation bonus`.
   - Single official attempt enforced per student per challenge.
   - Daily, Weekly, and All-Time Leaderboards with top 3 podium display.

6. **Live Community Arena (Supabase Realtime)**:
   - Exactly **three** official channels in strict order:
     1. **#Announcements**: Official administrative broadcasts. Only permanent admins can post. Students can view announcements but cannot post, reply, or react.
     2. **#Exam Discussion**: Live interactive channel where approved students and admins discuss exams, solve doubts, and collaborate with reactions and replies.
     3. **#Notes & Resources**: Dedicated vault where approved students and admins share permitted notes, PDF attachments, and formula sheets.
   - Instant live messaging powered by **Supabase Realtime Broadcast + PostgreSQL Changes** with automatic reconnection and fallback.

---

## 🏗️ Production Architecture: Vercel + Supabase

- **Hosting & API**: Vercel Serverless Functions (`api/index.js`, `vercel.json`).
- **Database**: Supabase PostgreSQL with pooled connections (`pg.Pool` with SSL).
- **Realtime Delivery**: Supabase Realtime for instant, multi-student chat on serverless infrastructure.
- **Document Storage**: Supabase Private Storage (`documents` and `community_attachments` buckets).
- **Local Development**: Dual-mode database adapter falls back to local SQLite (`node:sqlite DatabaseSync`) when `DATABASE_URL` is unset.

---

## ⚡ Quick Start & Deployment Guide

### 1. Supabase Setup
1. Create a new project in [Supabase](https://supabase.com).
2. Go to **Project Settings** -> **Database** and copy your Connection string (`DATABASE_URL`).
3. Go to **Project Settings** -> **API** and copy `Project URL`, `anon public` key, and `service_role` key.
4. Run the automated database migration script:
   ```bash
   npm run migrate:supabase
   ```
   *(This applies `supabase/schema.sql`, sets up all 28 tables, foreign keys, and enables Realtime publication on `community_messages` and `message_reactions`).*
5. (Optional) Migrate existing local question bank PDFs to Supabase Storage:
   ```bash
   npm run migrate:storage
   ```

### 2. Vercel Deployment
1. Import repository `https://github.com/AtharvaBhoite69/topperbatchh.git` into Vercel.
2. In Project Settings -> **Environment Variables**, add:
   ```env
   NODE_ENV=production
   JWT_SECRET=your-random-32-character-secret
   ADMIN_EMAIL_1=parthkadu05@gmail.com
   ADMIN_EMAIL_2=atharvabhoite697@gmail.com
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   SUPABASE_URL=https://[REF].supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   VITE_SUPABASE_URL=https://[REF].supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   GEMINI_API_KEY=your-gemini-api-key
   ```
3. Deploy! Vercel runs `npm run vercel-build` which compiles the Vite client and serves the backend serverless endpoints from `api/index.js`.

---

## 🧪 Automated Testing
Run automated backend verification tests:
```bash
npm --prefix server test
```
All tests verify database integrity, schemas, and permanent admin authorization.
