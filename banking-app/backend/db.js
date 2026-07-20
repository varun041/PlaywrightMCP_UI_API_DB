const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'banking.db');

/**
 * A single, long-lived connection shared by every query/run call, rather than opening (and
 * immediately closing) a brand new sqlite3.Database handle per statement. Under concurrent
 * requests (e.g. several Playwright workers hitting this same backend process in parallel) the
 * previous per-call open/close pattern serialized almost entirely on OS-level file-handle churn
 * and the default rollback-journal's exclusive write lock, turning what should be sub-100ms
 * queries into multi-second stalls and causing UI-side action-timeout failures that had nothing
 * to do with the page under test. WAL journal mode plus a busy_timeout lets concurrent readers
 * proceed while a write is in flight and makes sqlite retry internally instead of immediately
 * erroring with SQLITE_BUSY.
 */
let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err.message);
        return;
      }
      dbInstance.configure('busyTimeout', 5000);
      dbInstance.run('PRAGMA journal_mode = WAL;');
      dbInstance.run('PRAGMA synchronous = NORMAL;');
    });
  }
  return dbInstance;
}

function initializeTables() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.serialize(() => {
      db.run(
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT NOT NULL,
          password TEXT NOT NULL,
          createdAt TEXT NOT NULL
        )`,
        (err) => {
          if (err) {
            console.error('Error creating users table:', err);
            reject(err);
          } else {
            console.log('Users table ready');
            resolve();
          }
        }
      );
    });
  });
}

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function queryOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

initializeTables().catch(console.error);

module.exports = { query, queryOne, run, getDatabase, initializeTables };

