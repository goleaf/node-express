import session from 'express-session';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import BetterSqliteSessionStore from './BetterSqliteSessionStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const databaseDir = path.join(rootDir, 'database');

mkdirSync(databaseDir, { recursive: true });

const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

const sessionConfig = {
  name: 'todo.sid',
  secret: process.env.SESSION_SECRET ?? 'development-session-secret',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: oneWeekMs,
  },
  store: new BetterSqliteSessionStore({
    table: 'sessions',
    defaultTtlMs: oneWeekMs,
  }),
};

export default sessionConfig;
