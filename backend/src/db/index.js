'use strict';

/**
 * Thin, framework-agnostic data access layer on top of Node's built-in
 * `node:sqlite` driver. Everything the rest of the app does goes through
 * this module, so migrating to another relational database (e.g. PostgreSQL)
 * only requires re-implementing `get/all/run/transaction` with the same
 * contract.
 *
 * Only parameterised statements are exposed: callers never concatenate
 * user input into SQL.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

let connection = null;

function openDatabase(dbPath = config.paths.db) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath, {
    enableForeignKeyConstraints: true,
  });

  // WAL keeps readers from blocking writers; busy_timeout avoids spurious
  // "database is locked" errors under concurrent requests.
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  return db;
}

function getConnection() {
  if (!connection) {
    connection = openDatabase();
  }
  return connection;
}

/** Run a SELECT returning every row. */
function all(sql, params = []) {
  return getConnection().prepare(sql).all(...params);
}

/** Run a SELECT returning the first row (or undefined). */
function get(sql, params = []) {
  return getConnection().prepare(sql).get(...params);
}

/** Execute a write statement. Returns { changes, lastInsertRowid }. */
function run(sql, params = []) {
  return getConnection().prepare(sql).run(...params);
}

/** Execute raw SQL (schema files, pragmas). Never pass user input here. */
function exec(sql) {
  return getConnection().exec(sql);
}

/**
 * Run `fn` inside an immediate transaction. Nested calls reuse the outer
 * transaction; savepoints are not needed for the current workload.
 */
function transaction(fn) {
  const db = getConnection();
  if (db.isTransaction) {
    return fn();
  }
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      /* ignore rollback errors, rethrow the original */
    }
    throw error;
  }
}

function closeDatabase() {
  if (connection) {
    connection.close();
    connection = null;
  }
}

module.exports = {
  openDatabase,
  getConnection,
  all,
  get,
  run,
  exec,
  transaction,
  closeDatabase,
};
