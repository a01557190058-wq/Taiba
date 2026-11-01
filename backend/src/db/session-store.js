'use strict';

/**
 * SQLite-backed express-session store. Sessions survive server restarts and
 * are shared between the website and the dashboard (same origin).
 */
const { Store } = require('express-session');
const db = require('./index');

class SqliteSessionStore extends Store {
  constructor(options = {}) {
    super();
    this.defaultTtlMs = options.defaultTtlMs || 8 * 60 * 60 * 1000;
    this.cleanupIntervalMs = options.cleanupIntervalMs || 15 * 60 * 1000;

    this.cleanupTimer = setInterval(() => this.pruneExpired(), this.cleanupIntervalMs);
    if (typeof this.cleanupTimer.unref === 'function') this.cleanupTimer.unref();
    this.pruneExpired();
  }

  expiresAt(session) {
    const expires = session && session.cookie && session.cookie.expires;
    const timestamp = expires ? new Date(expires).getTime() : NaN;
    return Number.isFinite(timestamp) ? timestamp : Date.now() + this.defaultTtlMs;
  }

  get(sid, callback) {
    try {
      const row = db.get('SELECT sess, expires_at FROM sessions WHERE sid = ?', [sid]);
      if (!row) return callback(null, null);
      if (row.expires_at <= Date.now()) {
        db.run('DELETE FROM sessions WHERE sid = ?', [sid]);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.sess));
    } catch (error) {
      return callback(error);
    }
  }

  set(sid, session, callback) {
    try {
      db.run(
        `INSERT INTO sessions (sid, sess, expires_at)
         VALUES (?, ?, ?)
         ON CONFLICT (sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at`,
        [sid, JSON.stringify(session), this.expiresAt(session)]
      );
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  touch(sid, session, callback) {
    try {
      db.run('UPDATE sessions SET expires_at = ? WHERE sid = ?', [this.expiresAt(session), sid]);
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  destroy(sid, callback) {
    try {
      db.run('DELETE FROM sessions WHERE sid = ?', [sid]);
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  length(callback) {
    try {
      const row = db.get('SELECT COUNT(*) AS count FROM sessions WHERE expires_at > ?', [Date.now()]);
      return callback(null, row ? row.count : 0);
    } catch (error) {
      return callback(error);
    }
  }

  clear(callback) {
    try {
      db.run('DELETE FROM sessions');
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  pruneExpired() {
    try {
      db.run('DELETE FROM sessions WHERE expires_at <= ?', [Date.now()]);
    } catch {
      /* maintenance only - never crash the server for this */
    }
  }

  close() {
    clearInterval(this.cleanupTimer);
  }
}

module.exports = SqliteSessionStore;
