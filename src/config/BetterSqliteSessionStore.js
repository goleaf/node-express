import session from 'express-session';
import db from './database.js';

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const normalizeTableName = (value) => {
  const table = String(value || 'sessions').trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
    throw new Error(`Invalid session table name: ${table}`);
  }

  return table;
};

const resolveExpiresAt = (sessionData, defaultTtlMs) => {
  const expires = sessionData?.cookie?.expires;

  if (expires) {
    const expiresAt = new Date(expires).getTime();

    if (Number.isFinite(expiresAt)) {
      return expiresAt;
    }
  }

  const maxAge = Number(sessionData?.cookie?.maxAge);

  if (Number.isFinite(maxAge) && maxAge > 0) {
    return Date.now() + maxAge;
  }

  return Date.now() + defaultTtlMs;
};

export class BetterSqliteSessionStore extends session.Store {
  constructor(options = {}) {
    super();

    this.db = options.db || db;
    this.table = normalizeTableName(options.table);
    this.defaultTtlMs = Number(options.defaultTtlMs) > 0 ? Number(options.defaultTtlMs) : DEFAULT_TTL_MS;
    this.cleanupIntervalMs =
      Number(options.cleanupIntervalMs) > 0 ? Number(options.cleanupIntervalMs) : 15 * 60 * 1000;

    this.bootstrap();
    this.prepareStatements();
    this.cleanupExpiredSessions();
    this.startCleanupTimer();
  }

  bootstrap() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );
      CREATE INDEX IF NOT EXISTS ${this.table}_expires_at_idx
      ON ${this.table} (expires_at);
    `);
  }

  prepareStatements() {
    this.selectStatement = this.db.prepare(`
      SELECT sid, sess, expires_at
      FROM ${this.table}
      WHERE sid = ?
    `);

    this.upsertStatement = this.db.prepare(`
      INSERT INTO ${this.table} (sid, sess, expires_at, created_at, updated_at)
      VALUES (@sid, @sess, @expires_at, @now, @now)
      ON CONFLICT(sid) DO UPDATE SET
        sess = excluded.sess,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `);

    this.deleteStatement = this.db.prepare(`
      DELETE FROM ${this.table}
      WHERE sid = ?
    `);

    this.deleteExpiredStatement = this.db.prepare(`
      DELETE FROM ${this.table}
      WHERE expires_at <= ?
    `);
  }

  startCleanupTimer() {
    if (!this.cleanupIntervalMs) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.cleanupIntervalMs);

    this.cleanupTimer.unref?.();
  }

  cleanupExpiredSessions() {
    this.deleteExpiredStatement.run(Date.now());
  }

  get(sid, callback = () => {}) {
    try {
      const row = this.selectStatement.get(String(sid));

      if (!row) {
        callback(null, null);
        return;
      }

      if (Number(row.expires_at) <= Date.now()) {
        this.deleteStatement.run(String(sid));
        callback(null, null);
        return;
      }

      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sessionData, callback = () => {}) {
    try {
      const now = Date.now();

      this.upsertStatement.run({
        sid: String(sid),
        sess: JSON.stringify(sessionData),
        expires_at: resolveExpiresAt(sessionData, this.defaultTtlMs),
        now,
      });

      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.deleteStatement.run(String(sid));
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sessionData, callback = () => {}) {
    this.set(sid, sessionData, callback);
  }

  close() {
    clearInterval(this.cleanupTimer);
  }
}

export default BetterSqliteSessionStore;
