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
  if (!tableExists(db, 'users')) {
    return;
  }

  if (!columnExists(db, 'users', 'default_priority')) {
    db.exec("ALTER TABLE users ADD COLUMN default_priority TEXT NOT NULL DEFAULT 'medium';");
  }

  if (!columnExists(db, 'users', 'default_view')) {
    db.exec("ALTER TABLE users ADD COLUMN default_view TEXT NOT NULL DEFAULT 'list';");
  }
};
