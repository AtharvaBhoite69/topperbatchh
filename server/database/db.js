// =============================================================================
// TopperBatch - Unified Production Database Adapter
// Supports Supabase PostgreSQL in Production / Vercel with automatic connection
// pooling, and native SQLite for offline local development.
// =============================================================================

const path = require('path');
const fs = require('fs');
const env = require('../config/env');

let dbInstance = null;
let pgPool = null;

/**
 * Convert SQLite query syntax with '?' placeholders to PostgreSQL '$1, $2, ...' placeholders
 * and replace common SQLite date/random idioms.
 */
function convertSqlToPostgres(sql) {
  let paramIndex = 1;
  let inString = false;
  let stringChar = '';
  let converted = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if ((char === "'" || char === '"') && (i === 0 || sql[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
      converted += char;
    } else if (char === '?' && !inString) {
      converted += `$${paramIndex++}`;
    } else {
      converted += char;
    }
  }

  // Common function mappings
  return converted
    .replace(/\bdatetime\('now'\)/gi, 'NOW()')
    .replace(/\bdate\('now'\)/gi, 'CURRENT_DATE')
    .replace(/\bRANDOM\(\)/gi, 'RANDOM()');
}

/**
 * Initialize and get database instance.
 */
function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;

  // ---------------------------------------------------------------------------
  // 1. PRODUCTION MODE: Supabase PostgreSQL
  // ---------------------------------------------------------------------------
  if (databaseUrl) {
    console.log('🔌 Connecting to Production Supabase PostgreSQL pool...');
    const { Pool } = require('pg');

    pgPool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }, // Necessary for Supabase SSL pooler
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pgPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client pool:', err.message);
    });

    dbInstance = {
      isPostgres: true,
      isSqlite: false,
      raw: pgPool,
      
      // Native query
      query: async (sql, params = []) => {
        const pgSql = convertSqlToPostgres(sql);
        const res = await pgPool.query(pgSql, params);
        return res.rows;
      },

      // Unified prepare method matching SQLite API
      prepare: (sql) => {
        const pgSql = convertSqlToPostgres(sql);
        return {
          get: async (...args) => {
            const params = args.flat();
            const res = await pgPool.query(pgSql, params);
            return res.rows[0] || null;
          },
          all: async (...args) => {
            const params = args.flat();
            const res = await pgPool.query(pgSql, params);
            return res.rows || [];
          },
          run: async (...args) => {
            const params = args.flat();
            const res = await pgPool.query(pgSql, params);
            return {
              changes: res.rowCount || 0,
              rowCount: res.rowCount || 0,
            };
          },
        };
      },

      // PostgreSQL Transaction helper
      transaction: (fn) => {
        return async function (...args) {
          const client = await pgPool.connect();
          try {
            await client.query('BEGIN');
            const res = await fn(client, ...args);
            await client.query('COMMIT');
            return res;
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }
        };
      },

      exec: async (sql) => {
        return await pgPool.query(sql);
      },

      close: async () => {
        if (pgPool) {
          await pgPool.end();
        }
      },
    };

    console.log('✅ Supabase PostgreSQL adapter initialized.');
    return dbInstance;
  }

  // ---------------------------------------------------------------------------
  // 2. LOCAL OFFLINE MODE: SQLite (DatabaseSync)
  // ---------------------------------------------------------------------------
  const { DatabaseSync } = require('node:sqlite');
  const dbDir = path.dirname(env.DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const rawDb = new DatabaseSync(env.DB_PATH);

  try {
    rawDb.exec('PRAGMA foreign_keys = ON;');
    rawDb.exec('PRAGMA journal_mode = WAL;');
    rawDb.exec('PRAGMA synchronous = NORMAL;');
  } catch (e) {
    console.warn('SQLite pragma setup warning:', e.message);
  }

  dbInstance = {
    isPostgres: false,
    isSqlite: true,
    raw: rawDb,

    query: (sql, params = []) => {
      const stmt = rawDb.prepare(sql);
      return stmt.all(...params);
    },

    prepare: (sql) => {
      const stmt = rawDb.prepare(sql);
      return {
        get: (...args) => {
          const params = args.flat();
          return stmt.get(...params) || null;
        },
        all: (...args) => {
          const params = args.flat();
          return stmt.all(...params) || [];
        },
        run: (...args) => {
          const params = args.flat();
          const result = stmt.run(...params);
          return {
            changes: result?.changes || 0,
            lastInsertRowid: result?.lastInsertRowid || 0,
          };
        },
      };
    },

    transaction: (fn) => {
      return function (...args) {
        rawDb.exec('BEGIN TRANSACTION');
        try {
          const res = fn(...args);
          rawDb.exec('COMMIT');
          return res;
        } catch (err) {
          rawDb.exec('ROLLBACK');
          throw err;
        }
      };
    },

    exec: (sql) => rawDb.exec(sql),
    close: () => rawDb.close(),
  };

  console.log(`✅ Database connected (SQLite Local Mode): ${env.DB_PATH}`);
  return dbInstance;
}

/**
 * Close database connection
 */
function closeDb() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (_) {}
    dbInstance = null;
    pgPool = null;
  }
}

module.exports = {
  getDb,
  closeDb,
  convertSqlToPostgres,
};
