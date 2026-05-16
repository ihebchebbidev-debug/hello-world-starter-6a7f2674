// Runs pending SQL migrations programmatically on server boot.
// Mirrors the logic in migrations/migrate.js but is importable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, withTransaction } from './db.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.resolve(__dirname, '../../migrations/sql');

const ensureTable = () => query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW()
  )
`);

export const runPendingMigrations = async () => {
  if (!fs.existsSync(SQL_DIR)) {
    logger.warn(`Migrations dir not found at ${SQL_DIR}, skipping auto-migrate`);
    return { applied: [], skipped: true };
  }

  await ensureTable();

  const { rows } = await query('SELECT version FROM schema_migrations ORDER BY version');
  const done = new Set(rows.map((r) => r.version));

  const pending = fs
    .readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.up.sql'))
    .sort()
    .map((f) => ({ version: f.replace('.up.sql', ''), file: path.join(SQL_DIR, f) }))
    .filter((m) => !done.has(m.version));

  if (!pending.length) {
    logger.info('Auto-migrate: schema up to date');
    return { applied: [] };
  }

  const applied = [];
  for (const m of pending) {
    const sql = fs.readFileSync(m.file, 'utf8');
    logger.info(`Auto-migrate: applying ${m.version}`);
    await withTransaction(async (c) => {
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations (version) VALUES ($1)', [m.version]);
    });
    applied.push(m.version);
    logger.info(`Auto-migrate: ✓ ${m.version}`);
  }
  return { applied };
};
