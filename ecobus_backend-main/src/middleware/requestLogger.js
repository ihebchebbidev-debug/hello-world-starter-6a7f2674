import { logger } from '../utils/logger.js';

/**
 * Structured per-request logger.
 *
 * Emits one JSON log line per completed request, enriched with the correlation
 * id set by `requestId` middleware. Replaces morgan's free-text output so log
 * aggregators can filter/trace by `requestId`.
 */
export const requestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const meta = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
    };

    if (res.statusCode >= 500) logger.error('http', meta);
    else if (res.statusCode >= 400) logger.warn('http', meta);
    else logger.info('http', meta);
  });

  next();
};
