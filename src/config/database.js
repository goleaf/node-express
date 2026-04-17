import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../db/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const defaultDatabasePath = path.join(rootDir, 'database', 'todo.sqlite');
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : defaultDatabasePath;
const databaseDir = path.dirname(databasePath);
const schemaPath = path.join(rootDir, 'src/db/schema.sql');
const singletonKey = Symbol.for('node-express.todo.database');
const shouldLogSlowQueries = process.env.NODE_ENV === 'development';

const compactSql = (sql) => String(sql).replace(/\s+/g, ' ').trim();

const withSlowQueryLogging = (instance) => {
  if (!shouldLogSlowQueries) {
    return instance;
  }

  const originalPrepare = instance.prepare.bind(instance);

  const logSlowQuery = (sql, args, durationMs) => {
    try {
      const explainStatement = originalPrepare(`EXPLAIN QUERY PLAN ${sql}`);
      const planRows = explainStatement.all(...args);

      console.warn(
        `[sqlite][slow-query ${durationMs.toFixed(2)}ms] ${compactSql(sql)}\n${JSON.stringify(planRows)}`,
      );
    } catch (error) {
      console.warn(
        `[sqlite][slow-query ${durationMs.toFixed(2)}ms] ${compactSql(sql)}\n[explain failed] ${error.message}`,
      );
    }
  };

  instance.prepare = (sql, ...rest) => {
    const statement = originalPrepare(sql, ...rest);

    if (/^\s*EXPLAIN\b/i.test(sql)) {
      return statement;
    }

    for (const methodName of ['run', 'get', 'all', 'iterate']) {
      if (typeof statement[methodName] !== 'function') {
        continue;
      }

      const originalMethod = statement[methodName].bind(statement);

      statement[methodName] = (...args) => {
        const startedAt = performance.now();
        const result = originalMethod(...args);
        const durationMs = performance.now() - startedAt;

        if (durationMs > 10) {
          logSlowQuery(sql, args, durationMs);
        }

        return result;
      };
    }

    return statement;
  };

  return instance;
};

const createDatabase = () => {
  mkdirSync(databaseDir, { recursive: true });

  const instance = new Database(databasePath);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');

  return withSlowQueryLogging(instance);
};

const getDatabase = () => {
  if (!globalThis[singletonKey]) {
    globalThis[singletonKey] = createDatabase();
  }

  return globalThis[singletonKey];
};

const hasApplicationTables = (instance) => {
  const row = instance
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'users'
      `,
    )
    .get();

  return Boolean(row);
};

const bootstrapSchema = (instance) => {
  if (hasApplicationTables(instance)) {
    return;
  }

  const schemaSql = readFileSync(schemaPath, 'utf8');
  instance.exec(schemaSql);
};

const db = getDatabase();

bootstrapSchema(db);
await runMigrations(db);

export { db, databasePath };
export default db;
