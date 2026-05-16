/**
 * GPS log batcher.
 *
 * Why: gps_logs is the hottest write table in the system. With N buses
 * pinging every ~3s, a naive INSERT-per-ping strategy turns into thousands
 * of synchronous round-trips per second, holds pool connections, and blows
 * up disk usage. Worse, when those inserts run inside the same transaction
 * as bus_live_status + stop-event detection, every ping holds a writer lock
 * for far too long.
 *
 * Strategy:
 *   - Each ping is queued in memory (O(1)).
 *   - A worker flushes the queue on whichever comes first:
 *       * GPS_FLUSH_INTERVAL_MS  (default 1000ms)
 *       * GPS_FLUSH_BATCH_SIZE   (default 500 rows)
 *   - Flush uses a single multi-row INSERT outside any transaction.
 *   - The buffer is bounded (GPS_BUFFER_MAX, default 50_000). When full,
 *     the oldest entries are dropped with a warning — backpressure beats
 *     OOM.
 *   - On SIGINT/SIGTERM the buffer is flushed before exit.
 *
 * For true scale, swap gps_logs for a TimescaleDB hypertable
 * (see migration 010_gps_timescale.up.sql) — this batcher then continues
 * to work as the write path with no code changes.
 */
import { pool } from '../config/db.js';
import { logger } from '../utils/logger.js';

const FLUSH_INTERVAL_MS = Number(process.env.GPS_FLUSH_INTERVAL_MS || 1000);
const FLUSH_BATCH_SIZE = Number(process.env.GPS_FLUSH_BATCH_SIZE || 500);
const BUFFER_MAX = Number(process.env.GPS_BUFFER_MAX || 50_000);

const buffer = [];
let timer = null;
let flushing = false;
let dropped = 0;

export const enqueue = (row) => {
  if (buffer.length >= BUFFER_MAX) {
    // Drop oldest to keep memory bounded. Surfacing this loudly is important.
    buffer.shift();
    dropped += 1;
    if (dropped % 1000 === 1) {
      logger.warn('gpsBatcher: buffer full, dropping oldest pings', {
        dropped, bufferMax: BUFFER_MAX,
      });
    }
  }
  buffer.push(row);
  if (buffer.length >= FLUSH_BATCH_SIZE) {
    // Don't await — fire-and-forget so the request returns fast.
    flush().catch((err) =>
      logger.error('gpsBatcher: size-triggered flush failed', { err: err.message }));
  }
};

const buildBulkInsert = (rows) => {
  const cols = 9; // trip_id, bus_id, lat, lng, speed, heading, accuracy, battery, recorded_at
  const values = [];
  const params = [];
  rows.forEach((r, i) => {
    const o = i * cols;
    values.push(
      `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9})`,
    );
    params.push(
      r.tripId, r.busId, r.latitude, r.longitude,
      r.speed ?? null, r.heading ?? null, r.accuracy ?? null,
      r.batteryLevel ?? null, r.recordedAt,
    );
  });
  return {
    text: `INSERT INTO gps_logs
             (trip_id, bus_id, latitude, longitude, speed, heading,
              accuracy, battery_level, recorded_at)
           VALUES ${values.join(',')}`,
    values: params,
  };
};

export const flush = async () => {
  if (flushing || buffer.length === 0) return { inserted: 0 };
  flushing = true;
  // Drain in chunks of FLUSH_BATCH_SIZE so a single huge flush doesn't
  // exceed PostgreSQL's parameter limit (~32k).
  let inserted = 0;
  try {
    while (buffer.length > 0) {
      const chunk = buffer.splice(0, FLUSH_BATCH_SIZE);
      const stmt = buildBulkInsert(chunk);
      try {
        await pool.query(stmt);
        inserted += chunk.length;
      } catch (err) {
        // Don't lose data on a transient DB error: requeue at the front,
        // bail out of this flush, and let the next tick retry.
        buffer.unshift(...chunk);
        logger.error('gpsBatcher: flush failed, will retry next tick', {
          err: err.message, requeued: chunk.length,
        });
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { inserted };
};

export const startGpsBatcher = () => {
  if (timer) return;
  timer = setInterval(() => {
    flush().catch((err) =>
      logger.error('gpsBatcher: tick flush failed', { err: err.message }));
  }, FLUSH_INTERVAL_MS);
  timer.unref?.();
  logger.info('gpsBatcher started', {
    flushIntervalMs: FLUSH_INTERVAL_MS,
    flushBatchSize: FLUSH_BATCH_SIZE,
    bufferMax: BUFFER_MAX,
  });
};

export const stopGpsBatcher = async () => {
  if (timer) clearInterval(timer);
  timer = null;
  // Final drain — best effort so we don't lose pings on graceful shutdown.
  await flush().catch((err) =>
    logger.error('gpsBatcher: shutdown flush failed', { err: err.message }));
};

export const stats = () => ({
  buffered: buffer.length,
  dropped,
});