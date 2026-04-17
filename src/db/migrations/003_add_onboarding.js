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

const columnExists = (db, tableName, columnName) => {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().some((column) => column.name === columnName);
};

export const up = (db) => {
  if (!tableExists(db, 'users') || columnExists(db, 'users', 'onboarding_completed')) {
    return;
  }

  db.exec('ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0;');
};
