import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { listLogFiles, tail, followCurrentFile } from '../utils/logReader.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Token-based protection so logs are not world-readable.
// Set LOG_VIEWER_TOKEN in env. Pass via ?token= or X-Log-Token header.
const requireToken = (req, _res, next) => {
  const expected = process.env.LOG_VIEWER_TOKEN;
  if (!expected) {
    return next(ApiError.forbidden('LOG_VIEWER_TOKEN is not configured on the server'));
  }
  const provided = req.query.token || req.headers['x-log-token'];
  if (provided !== expected) return next(ApiError.unauthorized('Invalid log token'));
  next();
};

/**
 * @openapi
 * /logs/files:
 *   get:
 *     tags: [Logs]
 *     summary: List rotated log files
 *     security: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.get('/files', requireToken, asyncHandler(async (_req, res) => {
  res.json(listLogFiles().map((f) => ({
    name: f.name, size: f.size, mtime: f.mtime,
  })));
}));

/**
 * @openapi
 * /logs/tail:
 *   get:
 *     tags: [Logs]
 *     summary: Tail recent log entries (JSON, newest first)
 *     security: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 200, maximum: 2000 }
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [all, error, warn, info, http, verbose, debug] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: file
 *         schema: { type: string, description: "Specific filename, e.g. ecobus-2026-04-24.log" }
 *     responses:
 *       200: { description: OK }
 */
router.get('/tail', requireToken, asyncHandler(async (req, res) => {
  const entries = tail({
    limit: Number(req.query.limit || 200),
    level: req.query.level,
    search: req.query.search,
    file: req.query.file,
  });
  res.json({ count: entries.length, entries });
}));

/**
 * @openapi
 * /logs/stream:
 *   get:
 *     tags: [Logs]
 *     summary: Live stream new log lines (Server-Sent Events)
 *     security: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: SSE stream of `data: <json>\\n\\n`
 */
router.get('/stream', requireToken, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`event: ready\ndata: {"ok":true}\n\n`);

  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 15_000);
  const stop = followCurrentFile((entry) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  });

  req.on('close', () => { clearInterval(heartbeat); stop(); });
});

// Serve the static viewer UI at /api/v1/logs/viewer
// (token still required from inside the page).
router.get('/viewer', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'log-viewer.html'));
});

export default router;
