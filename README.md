# 💥 TOPPERBATCH — ISS SEM, 9 POINTER FIX! 💥

> **Your Batch. Your Rules.**  
> A private, high-performance college student community combining question banks, RAG-grounded Gemini AI, daily MCQ battle competitions, Discord-style channel discussions, and live leaderboards.

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

As mandated by the security specification, permanent administrator privileges are strictly controlled server-side:

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
   - 10 Comic Quick-Access Cards linking directly to active features.
   - Official batch broadcast notifications and today's active MCQ battle banner.

2. **Question Bank Vault & Protected Viewer**:
   - Filterable by semester, subject, and unit.
   - Protected inline PDF streaming with **student-specific watermarks** (`email`, `name`, `timestamp`) to deter screenshots and leaks.
   - Right-click and text-selection deterrents.

3. **Gemini 1.5 Flash RAG AI Study Buddy**:
   - Split-screen chat interface with session history.
   - Grounded PDF answering: extracts text, generates vector embeddings, retrieves top-5 relevant chunks, and cites exact PDF title and page numbers.
   - Pre-loaded high-yield prompts for quick exam preparation.

4. **Daily MCQ Battle Arena & Leaderboard**:
   - Daily 10-question timed challenge.
   - Server-side scoring: `+10 points` per correct answer, `+5 participation bonus`.
   - Single official attempt enforced per student per challenge.
   - Daily, Weekly, and All-Time Leaderboards with top 3 podium display and tiebreakers on time and accuracy.

5. **Discord-Style Batch Community**:
   - Real-time channels (`#general`, `#announcements`, `#exam-discussion`, `#programming`, `#dbms`, `#projects`, `#random`).
   - Live socket messaging, typing indicators, emoji reaction counts, and reply threads.
   - Student flag/report mechanism for administrator moderation.

6. **Admin Command HQ**:
   - Real database telemetry: total students, pending approvals, vault documents, quiz attempts, and active users.
   - Student roster management (suspend, reactivate, revoke sessions).
   - Document upload with automated RAG indexing pipeline.
   - Question Forge (create MCQs with 4 options and detailed explanations).
   - Battle Planner (schedule daily challenges and assign question pools).
   - Control Room (single active session enforcement, scoring multipliers).
   - Immutable audit trail logging admin actions and IP addresses.

---

## 🛠️ Tech Stack Architecture

- **Frontend**: React 18, Vite, Tailwind CSS v3, Lucide React, Socket.io-client, Axios, React Hot Toast
- **Backend**: Node.js, Express, Socket.io, Multer, Helmet, CORS, Cookie-Parser, Express-Rate-Limit, Node-Cron
- **Database**: SQLite with `better-sqlite3` (WAL mode enabled, foreign keys enforced, indexed queries)
- **AI Engine**: Google Gemini API (`gemini-1.5-flash` & `text-embedding-004`) via RAG pipeline
- **Auth**: JWT stored in `httpOnly`, `SameSite=Lax` cookies with server-side session tracking and revocation

---

## ⚡ Quick Start & Local Setup

### 1. Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root folder:

```bash
cp .env.example .env
```

Ensure your admin emails and optional Gemini API key are configured:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=topperbatch-super-secret-key-2026
ADMIN_EMAIL_1=parthkadu05@gmail.com
ADMIN_EMAIL_2=atharvabhoite697@gmail.com
GEMINI_API_KEY=your_gemini_api_key_here
CLIENT_URL=http://localhost:5173
```

### 3. Install Dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 4. Run Database Migrations & Seeds
```bash
cd server
npm run migrate
npm run seed
```

### 5. Launch Development Servers
Run both backend and frontend concurrently from root:
```bash
# In one terminal (or root)
npm run dev
```
Or run separately:
```bash
# Terminal 1: Backend API (port 5000)
cd server && npm run dev

# Terminal 2: Frontend UI (port 5173)
cd client && npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 🧪 Automated Testing
Run automated backend tests covering database schemas, table integrity, and admin email verification:
```bash
cd server
npm test
```

---

## 🔒 Security & Deterrent Architecture

- **Private Document Delivery**: PDFs are never exposed via static public URLs. Every view request passes through `authenticate` + `requireApproved` middleware, validating the active JWT session cookie.
- **Watermark Deterrents**: When a student opens a PDF, semi-transparent watermarks carrying their name and email are overlaid across the viewport.
- **Device & Session Restrictions**: The administrator can set `max_sessions_per_user` (default `1`). When a student logs in on a new device, older sessions are automatically revoked.
- **Server-Side Scoring**: Quiz scores, timers, and answer validations are computed entirely server-side. The frontend only receives option IDs and sends user selections.

