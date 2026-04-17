const tableExists = (db, tableName) => {
  const row = db
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
      `,
    )
    .get(tableName);

  return Boolean(row);
};

export const up = (db) => {
  if (tableExists(db, 'password_resets')) {
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);
  `);
};
