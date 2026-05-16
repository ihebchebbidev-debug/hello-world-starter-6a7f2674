import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { query } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { getIO } from '../sockets/io.js';

const router = Router();

const REQUIRED_TABLES = [
  'organizations', 'users', 'roles', 'permissions', 'role_permissions', 'user_roles',
  'buses', 'routes', 'route_stops', 'route_assignments',
  'children', 'child_routes', 'trips', 'bus_live_status', 'gps_logs',
  'stop_events', 'checkins', 'notifications', 'device_tokens',
  'sos_alerts', 'alerts', 'geofences',
  'visitors', 'sessions', 'page_views', 'events',
];

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe
 *     description: Lightweight check used by load balancers. Always returns 200 if the process is up.
 *     responses:
 *       200:
 *         description: Process is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 uptime: { type: number, example: 123.45 }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * @openapi
 * /health/ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe (DB + schema)
 *     description: Verifies PostgreSQL connectivity and that all required tables exist. Returns 503 when not ready.
 *     responses:
 *       200:
 *         description: API is ready to serve traffic
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ReadinessReport' }
 *       503:
 *         description: Not ready (DB down or missing tables)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ReadinessReport' }
 */
router.get('/ready', asyncHandler(async (_req, res) => {
  const startedAt = Date.now();
  const report = {
    status: 'ok',
    checks: {
      database: { status: 'unknown', latencyMs: null, error: null },
      schema: { status: 'unknown', missing: [], present: 0, required: REQUIRED_TABLES.length },
      websocket: { status: 'unknown', namespaces: [], connections: 0 },
      redis: { status: 'disabled', note: 'Redis is not provisioned for this deployment' },
    },
    timestamp: new Date().toISOString(),
  };

  // 1. DB connectivity
  let dbOk = false;
  try {
    const t0 = Date.now();
    await query('SELECT 1');
    report.checks.database.status = 'ok';
    report.checks.database.latencyMs = Date.now() - t0;
    dbOk = true;
  } catch (err) {
    report.checks.database.status = 'down';
    report.checks.database.error = err.message;
    logger.error('Health: DB check failed', { err: err.message });
  }

  // 2. Required tables
  if (dbOk) {
    try {
      const { rows } = await query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
        [REQUIRED_TABLES],
      );
      const present = new Set(rows.map((r) => r.table_name));
      const missing = REQUIRED_TABLES.filter((t) => !present.has(t));
      report.checks.schema.present = present.size;
      report.checks.schema.missing = missing;
      report.checks.schema.status = missing.length === 0 ? 'ok' : 'incomplete';
    } catch (err) {
      report.checks.schema.status = 'error';
      report.checks.schema.error = err.message;
    }
  } else {
    report.checks.schema.status = 'skipped';
  }

  // 3. WebSocket (Socket.io) — verify the server is initialised and reachable
  try {
    const io = getIO();
    if (!io) {
      report.checks.websocket.status = 'down';
      report.checks.websocket.error = 'Socket.io server not initialised';
    } else {
      const ws = io.of('/ws');
      const defaultCount = io.engine?.clientsCount ?? 0;
      const wsCount = ws.sockets?.size ?? 0;
      report.checks.websocket.status = 'ok';
      report.checks.websocket.namespaces = ['/', '/ws'];
      report.checks.websocket.connections = defaultCount;
      report.checks.websocket.wsNamespaceConnections = wsCount;
    }
  } catch (err) {
    report.checks.websocket.status = 'error';
    report.checks.websocket.error = err.message;
  }

  const ok =
    report.checks.database.status === 'ok' &&
    report.checks.schema.status === 'ok' &&
    report.checks.websocket.status === 'ok';
  report.status = ok ? 'ok' : 'degraded';
  report.totalLatencyMs = Date.now() - startedAt;

  // Envelope middleware wraps 2xx bodies automatically. For 503 we shape the
  // envelope explicitly so the failing report still surfaces in `data`.
  if (ok) {
    res.locals.message = 'All systems operational';
    return res.status(200).json(report);
  }
  return res.status(503).json({
    success: false,
    data: report,
    message: 'One or more dependencies are unhealthy',
    error: 'degraded',
  });
}));

export default router;
