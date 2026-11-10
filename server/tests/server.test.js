// =============================================================================
// TopperBatch - Automated Backend Test Suite
// =============================================================================

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

test('Environment and Permanent Admins configured', () => {
  const env = require('../config/env');
  assert.strictEqual(env.ADMIN_EMAILS.includes('parthkadu05@gmail.com'), true);
  assert.strictEqual(env.ADMIN_EMAILS.includes('atharvabhoite697@gmail.com'), true);
  assert.strictEqual(env.ADMIN_EMAILS.includes('mishraayush3112@gmail.com'), true);
  assert.strictEqual(env.ADMIN_EMAILS.length, 3);
});

test('Database migrations create all required tables', async () => {
  const { getDb } = require('../database/db');
  const { runMigrations } = require('../database/migrate');
  const { seedDatabase } = require('../database/seed');

  if (!process.env.DATABASE_URL) {
    runMigrations();
    seedDatabase();
  }

  const db = getDb();
  let tableRows = [];
  if (db.isPostgres) {
    tableRows = await db.prepare("SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public'").all();
  } else {
    tableRows = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  }
  const tables = (tableRows || []).map((t) => t.name);

  const expectedTables = [
    'users',
    'sessions',
    'semesters',
    'subjects',
    'units',
    'documents',
    'document_pages',
    'document_chunks',
    'chat_conversations',
    'chat_messages',
    'community_channels',
    'community_messages',
    'message_reactions',
    'mcq_challenges',
    'questions',
    'answer_options',
    'quiz_attempts',
    'student_answers',
    'achievements',
    'notifications',
    'announcements',
    'reports',
    'audit_logs',
    'platform_settings',
    'saved_documents',
  ];

  for (const table of expectedTables) {
    assert.strictEqual(
      tables.includes(table),
      true,
      `Table '${table}' should exist in the database.`
    );
  }
});

test('Default channels and semesters are seeded', async () => {
  const { getDb } = require('../database/db');
  const db = getDb();

  const channels = (await db.prepare('SELECT name FROM community_channels').all()).map((c) => c.name.toLowerCase());
  assert.strictEqual(channels.includes('announcements'), true);
  assert.strictEqual(channels.includes('exam discussion'), true);
  assert.strictEqual(channels.includes('notes & resources'), true);
  assert.strictEqual(channels.length, 3);

  const semesters = (await db.prepare('SELECT COUNT(*) as count FROM semesters').get()).count;
  assert.strictEqual(semesters >= 8, true);
});

test('Password hashing and token helpers work correctly', async () => {
  const { generateId, generateToken, hashToken, sanitizeUser } = require('../utils/helpers');

  const id = generateId();
  assert.strictEqual(typeof id, 'string');
  assert.strictEqual(id.length > 10, true);

  const token = generateToken();
  const hashed = hashToken(token);
  assert.strictEqual(typeof hashed, 'string');
  assert.strictEqual(hashed.length, 64);

  const rawPass = 'Secret123!';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(rawPass, salt);
  const valid = await bcrypt.compare(rawPass, hash);
  assert.strictEqual(valid, true);

  const user = { id: 'u1', email: 'test@college.edu', password_hash: hash, full_name: 'Test Student' };
  const sanitized = sanitizeUser(user);
  assert.strictEqual(sanitized.password_hash, undefined);
  assert.strictEqual(sanitized.email, 'test@college.edu');

  const { closeDb } = require('../database/db');
  await closeDb();
});
