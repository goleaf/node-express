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
  if (!tableExists(db, 'tasks') || columnExists(db, 'tasks', 'deleted_at')) {
    return;
  }

  db.exec('ALTER TABLE tasks ADD COLUMN deleted_at TEXT;');
};
