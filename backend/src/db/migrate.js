'use strict';

/**
 * Applies database/schema.sql. The schema is written with `IF NOT EXISTS`
 * guards so this is safe to run repeatedly; applied versions are recorded in
 * `schema_migrations` to leave room for future incremental migrations.
 */
const fs = require('node:fs');
const config = require('../config');
const db = require('./index');

const INITIAL_VERSION = '001_initial';

function migrate({ silent = false } = {}) {
  const sql = fs.readFileSync(config.paths.schema, 'utf8');

  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(sql);

  const existing = db.get('SELECT version FROM schema_migrations WHERE version = ?', [INITIAL_VERSION]);
  if (!existing) {
    db.run('INSERT INTO schema_migrations (version) VALUES (?)', [INITIAL_VERSION]);
  }

  if (!silent) {
    // eslint-disable-next-line no-console
    console.log(`[db] schema ready (${config.paths.db})`);
  }
  return { path: config.paths.db };
}

module.exports = { migrate, INITIAL_VERSION };
