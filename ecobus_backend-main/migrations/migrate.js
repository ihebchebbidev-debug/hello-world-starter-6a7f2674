#!/usr/bin/env node
// Simple SQL migration runner for EcoBus.
// Usage: node migrations/migrate.js [up|down|status]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query, withTransaction } from '../src/config/db.js';
import { logger } from '../src/utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_DIR = path.join(__dirname, 'sql');

const ensureTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
};

const listFiles = () =>
  fs.readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.up.sql'))
    .sort()
    .map((f) => ({
      version: f.replace('.up.sql', ''),
      upPath: path.join(SQL_DIR, f),
      downPath: path.join(SQL_DIR, f.replace('.up.sql', '.down.sql')),
    }));

const applied = async () => {
  const { rows } = await query('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(rows.map((r) => r.version));
};

const up = async () => {
  await ensureTable();
  const done = await applied();
  const files = listFiles();
  const pending = files.filter((f) => !done.has(f.version));

  if (!pending.length) {
    logger.info('No pending migrations.');
    return;
  }

  for (const m of pending) {
    const sql = fs.readFileSync(m.upPath, 'utf8');
    logger.info(`Applying ${m.version}...`);
    await withTransaction(async (c) => {
      await c.query(sql);
      await c.query('INSERT INTO schema_migrations (version) VALUES ($1)', [m.version]);
    });
    logger.info(`✓ ${m.version}`);
  }
};

const down = async () => {
  await ensureTable();
  const { rows } = await query(
    'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1',
  );
  const last = rows[0];
  if (!last) {
    logger.info('Nothing to roll back.');
    return;
  }
  const file = path.join(SQL_DIR, `${last.version}.down.sql`);
  if (!fs.existsSync(file)) {
    throw new Error(`Down file missing for ${last.version}`);
  }
  const sql = fs.readFileSync(file, 'utf8');
  logger.info(`Rolling back ${last.version}...`);
  await withTransaction(async (c) => {
    await c.query(sql);
    await c.query('DELETE FROM schema_migrations WHERE version = $1', [last.version]);
  });
  logger.info(`✓ Rolled back ${last.version}`);
};

const status = async () => {
  await ensureTable();
  const done = await applied();
  const files = listFiles();
  for (const f of files) {
    const mark = done.has(f.version) ? '✓ applied' : '… pending';
    console.log(`${mark}  ${f.version}`);
  }
};

const main = async () => {
  const cmd = process.argv[2] || 'up';
  try {
    if (cmd === 'up') await up();
    else if (cmd === 'down') await down();
    else if (cmd === 'status') await status();
    else throw new Error(`Unknown command: ${cmd}`);
  } catch (err) {
    logger.error('Migration failed', { err: err.message });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();
