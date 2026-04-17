import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, 'migrations');

const ensureMigrationsTable = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      run_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

const getMigrationFiles = () => {
  return readdirSync(migrationsDir)
    .filter((fileName) => /^\d+_.*\.js$/.test(fileName))
    .sort();
};

export const runMigrations = async (db) => {
  ensureMigrationsTable(db);

  const appliedMigrations = new Set(
    db.prepare('SELECT name FROM schema_migrations ORDER BY name').all().map((row) => row.name),
  );
  const insertMigration = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');

  for (const fileName of getMigrationFiles()) {
    if (appliedMigrations.has(fileName)) {
      continue;
    }

    const migrationUrl = pathToFileURL(path.join(migrationsDir, fileName)).href;
    const migrationModule = await import(migrationUrl);

    if (typeof migrationModule.up !== 'function') {
      throw new TypeError(`Migration ${fileName} must export an up() function.`);
    }

    db.transaction(() => {
      migrationModule.up(db);
      insertMigration.run(fileName);
    })();
  }
};

export default runMigrations;
