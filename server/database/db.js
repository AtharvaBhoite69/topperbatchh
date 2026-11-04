// =============================================================================
// TopperBatch - Database Connection (node:sqlite DatabaseSync)
// Native SQLite for Node.js 22+ with zero native compilation dependencies.
// =============================================================================

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

let dbInstance = null;

/**
 * Get or create the database connection.
 */
function getDb() {
  if (!dbInstance) {
    const dbDir = path.dirname(env.DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const rawDb = new DatabaseSync(env.DB_PATH);

    // Pragmas
    try {
      rawDb.exec('PRAGMA foreign_keys = ON;');
      rawDb.exec('PRAGMA journal_mode = WAL;');
      rawDb.exec('PRAGMA synchronous = NORMAL;');
    } catch (e) {
      console.warn('Pragma setup warning:', e.message);
    }

    // Wrap rawDb to match better-sqlite3 convenience methods
    dbInstance = {
      raw: rawDb,
      exec: (sql) => rawDb.exec(sql),
      prepare: (sql) => {
        const stmt = rawDb.prepare(sql);
        return {
          get: (...args) => stmt.get(...args),
          all: (...args) => stmt.all(...args),
          run: (...args) => {
            const result = stmt.run(...args);
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
      pragma: (pragmaStr) => {
        try {
          rawDb.exec(`PRAGMA ${pragmaStr};`);
        } catch (e) {
          // ignore
        }
      },
      close: () => rawDb.close(),
    };

    console.log(`✅ Database connected: ${env.DB_PATH}`);
  }

  return dbInstance;
}

/**
 * Close database connection
 */
function closeDb() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (e) {
      // ignore
    }
    dbInstance = null;
    console.log('🔒 Database connection closed.');
  }
}

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

module.exports = {
  getDb,
  closeDb,
};
