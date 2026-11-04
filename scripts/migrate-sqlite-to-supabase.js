// =============================================================================
// TopperBatch - SQLite to Supabase PostgreSQL Data Migration Script
// Copies all records, preserves IDs, password hashes, and relations.
// =============================================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { Pool } = require('pg');

async function migrate() {
  console.log('🚀 Starting SQLite -> Supabase PostgreSQL Data Migration...\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is not defined.');
    console.error('Please set DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres in your .env or command line.');
    process.exit(1);
  }

  const sqlitePath = path.join(__dirname, '..', 'server', 'topperbatch.db');
  if (!fs.existsSync(sqlitePath)) {
    console.error(`❌ SQLite source database not found at: ${sqlitePath}`);
    process.exit(1);
  }

  // 1. Connect to SQLite
  console.log(`📦 Reading SQLite database from: ${sqlitePath}`);
  const sqlite = new DatabaseSync(sqlitePath);

  // 2. Connect to PostgreSQL
  console.log('🔌 Connecting to Supabase PostgreSQL pool...');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Required for Supabase SSL pooler
  });

  const client = await pool.connect();
  console.log('✅ Connected to Supabase PostgreSQL.\n');

  try {
    // 3. Apply Schema DDL
    const schemaSqlPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
    if (fs.existsSync(schemaSqlPath)) {
      console.log('📄 Applying schema DDL (supabase/schema.sql)...');
      const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
      await client.query(schemaSql);
      console.log('✅ Schema tables, constraints, and indexes verified in PostgreSQL.\n');
    }

    // Ordered list of tables to migrate respecting foreign keys
    const tablesToMigrate = [
      'users',
      'sessions',
      'password_resets',
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
      'user_achievements',
      'notifications',
      'announcements',
      'reports',
      'audit_logs',
      'platform_settings',
      'saved_documents',
      'mcq_draft_sessions',
    ];

    const migrationSummary = [];

    // Migrate each table
    for (const tableName of tablesToMigrate) {
      // Check if table exists in SQLite
      const tableCheck = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
      if (!tableCheck) {
        continue;
      }

      const rows = sqlite.prepare(`SELECT * FROM "${tableName}"`).all();
      const sqliteCount = rows.length;

      if (sqliteCount === 0) {
        migrationSummary.push({ table: tableName, sqlite: 0, postgres: 0, status: 'SKIPPED (0 rows)' });
        continue;
      }

      console.log(`⏳ Migrating table "${tableName}" (${sqliteCount} records)...`);

      // Get columns
      const sample = rows[0];
      const columns = Object.keys(sample);
      const colList = columns.map((c) => `"${c}"`).join(', ');

      await client.query('BEGIN');

      try {
        for (const row of rows) {
          const values = columns.map((col) => {
            const val = row[col];
            // Format dates or booleans if necessary
            if (val === undefined) return null;
            return val;
          });

          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

          // Determine Primary Key for conflict handling
          let conflictClause = 'ON CONFLICT DO NOTHING';
          if (columns.includes('id')) {
            const updateSet = columns.filter((c) => c !== 'id').map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');
            conflictClause = updateSet.length > 0 ? `ON CONFLICT (id) DO UPDATE SET ${updateSet}` : 'ON CONFLICT (id) DO NOTHING';
          } else if (columns.includes('key')) {
            conflictClause = 'ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at';
          } else if (tableName === 'saved_documents') {
            conflictClause = 'ON CONFLICT (user_id, document_id) DO NOTHING';
          } else if (tableName === 'message_reactions') {
            conflictClause = 'ON CONFLICT (message_id, user_id, emoji) DO NOTHING';
          }

          const insertQuery = `
            INSERT INTO public."${tableName}" (${colList})
            VALUES (${placeholders})
            ${conflictClause}
          `;

          await client.query(insertQuery, values);
        }

        await client.query('COMMIT');

        // Check PostgreSQL count
        const pgCountRes = await client.query(`SELECT COUNT(*) as c FROM public."${tableName}"`);
        const pgCount = parseInt(pgCountRes.rows[0].c, 10);

        migrationSummary.push({
          table: tableName,
          sqlite: sqliteCount,
          postgres: pgCount,
          status: pgCount >= sqliteCount ? '✅ MATCHED' : '⚠️ MISMATCH',
        });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Error migrating table "${tableName}":`, err.message);
        migrationSummary.push({ table: tableName, sqlite: sqliteCount, postgres: 0, status: `FAILED: ${err.message}` });
      }
    }

    console.log('\n========================================================================');
    console.log('📊 MIGRATION VERIFICATION SUMMARY');
    console.log('========================================================================');
    console.table(migrationSummary);

    console.log('\n🎉 SQLite to Supabase PostgreSQL Migration Complete!');
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

migrate().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});

