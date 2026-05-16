import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initSocket } from './sockets/io.js';
import { logger } from './utils/logger.js';
import { pool } from './config/db.js';
import { runPendingMigrations } from './config/autoMigrate.js';
import { startGitSync } from './config/gitSync.js';
import { startCronJobs, stopCronJobs } from './jobs/index.js';
import { startGpsBatcher, stopGpsBatcher } from './services/gpsBatcher.js';

const AUTO_MIGRATE = process.env.AUTO_MIGRATE !== 'false'; // default ON

const start = async () => {
  // Verify DB connectivity up-front so a bad DATABASE_URL fails fast with
  // a readable error instead of cascading through migrations.
  try {
    const { rows } = await pool.query('SELECT current_database() AS db, version() AS version');
    logger.info('Database connection OK', {
      database: rows[0].db,
      server: rows[0].version.split(' on ')[0],
    });
  } catch (err) {
    logger.error('Database connection FAILED — check DATABASE_URL / PGSSL', {
      err: err.message,
    });
    process.exit(1);
  }

  if (AUTO_MIGRATE) {
    try {
      await runPendingMigrations();
    } catch (err) {
      logger.error('Auto-migrate failed, aborting startup', { err: err.message });
      process.exit(1);
    }
  } else {
    logger.info('Auto-migrate disabled (AUTO_MIGRATE=false)');
  }

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);
  startCronJobs();
  startGpsBatcher();

  // gitSync was removed (insecure, blocking, replaces code at runtime).
  // The shim below logs a warning if the legacy env var is still set.
  const sync = startGitSync();

  server.listen(env.port, () => {
    logger.info(`EcoBus API listening on :${env.port} (${env.nodeEnv})`);
    logger.info(`Base path: ${env.apiPrefix}`);
    logger.info(`Docs:      ${env.apiPrefix.replace(/\/v\d+$/, '')}/docs`);
    logger.info(`Logs UI:   ${env.apiPrefix}/logs/viewer  (LOG_VIEWER_TOKEN required)`);
  });

  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    sync.stop();
    stopCronJobs();
    await stopGpsBatcher();
    server.close(() => logger.info('HTTP closed'));
    await pool.end().catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => logger.error('unhandledRejection', { err }));
  process.on('uncaughtException', (err) => logger.error('uncaughtException', { err }));
};

start();
