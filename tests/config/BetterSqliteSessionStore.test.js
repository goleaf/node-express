import { afterEach, describe, expect, it } from '@jest/globals';
import Database from 'better-sqlite3';
import BetterSqliteSessionStore from '../../src/config/BetterSqliteSessionStore.js';

const invokeStore = (store, method, ...args) =>
  new Promise((resolve, reject) => {
    store[method](...args, (error, value) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(value);
    });
  });

const stores = [];

describe('BetterSqliteSessionStore', () => {
  afterEach(() => {
    while (stores.length > 0) {
      const store = stores.pop();
      store.close();
      store.db.close();
    }
  });

  it('persists and retrieves a session', async () => {
    const memoryDb = new Database(':memory:');
    const store = new BetterSqliteSessionStore({
      db: memoryDb,
      cleanupIntervalMs: 0,
    });

    stores.push(store);

    await invokeStore(store, 'set', 'sid-1', {
      cookie: { maxAge: 60_000 },
      userId: 42,
      theme: 'dark',
    });

    const sessionData = await invokeStore(store, 'get', 'sid-1');

    expect(sessionData).toMatchObject({
      userId: 42,
      theme: 'dark',
    });
  });

  it('returns null and clears expired sessions', async () => {
    const memoryDb = new Database(':memory:');
    const store = new BetterSqliteSessionStore({
      db: memoryDb,
      cleanupIntervalMs: 0,
    });

    stores.push(store);

    await invokeStore(store, 'set', 'sid-expired', {
      cookie: { expires: new Date(Date.now() - 1_000).toISOString() },
      userId: 7,
    });

    const sessionData = await invokeStore(store, 'get', 'sid-expired');
    const row = memoryDb.prepare('SELECT sid FROM sessions WHERE sid = ?').get('sid-expired');

    expect(sessionData).toBeNull();
    expect(row).toBeUndefined();
  });

  it('destroys sessions explicitly', async () => {
    const memoryDb = new Database(':memory:');
    const store = new BetterSqliteSessionStore({
      db: memoryDb,
      cleanupIntervalMs: 0,
    });

    stores.push(store);

    await invokeStore(store, 'set', 'sid-destroy', {
      cookie: { maxAge: 60_000 },
      userId: 11,
    });

    await invokeStore(store, 'destroy', 'sid-destroy');
    const sessionData = await invokeStore(store, 'get', 'sid-destroy');

    expect(sessionData).toBeNull();
  });
});
