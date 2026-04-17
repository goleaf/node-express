import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../schema.sql');

export const up = (db) => {
  const schemaSql = readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
};
