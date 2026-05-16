/**
 * Background jobs.
 *
 * Lightweight setInterval-based scheduler — no external cron dependency.
 * Each job logs a single summary line; failures never crash the process.
 *
 *   gpsOffDetection      — every 60s   marks bus_live_status.gps_status='offline'
 *                                       when last_update older than 30s
 *   delayDetection       — every 120s  raises 'delay' alerts when current time
 *                                       is past planned_time at the next stop
 *   autoCloseStaleTrips  — every 300s  closes in_progress trips whose last
 *                                       gps_log is older than 30 minutes
 */
import { query } from '../config/db.js';
import { autoCloseStaleTrips } from '../services/tripService.js';
import { logger } from '../utils/logger.js';
import { getIO } from '../sockets/io.js';

const STALE_GPS_SECONDS = 30;
const AUTO_CLOSE_MINUTES = 30;

const safe = (name, fn) => async () => {
  try {
    const result = await fn();
    if (result !== undefined) logger.info(`cron.${name} ok`, { result });
  } catch (err) {
    logger.error(`cron.${name} failed`, { err: err.message });
  }
};

const gpsOffDetection = safe('gpsOff', async () => {
  const { rows } = await query(
    `UPDATE bus_live_status
     SET gps_status = 'offline', updated_at = NOW()
     WHERE gps_status <> 'offline'
       AND last_update < NOW() - ($1 || ' seconds')::interval
     RETURNING bus_id`,
    [String(STALE_GPS_SECONDS)],
  );
  if (!rows.length) return;
  const ns = getIO()?.of('/ws');
  rows.forEach((r) => ns?.to(`bus:${r.bus_id}`).emit('bus.gps.offline', { busId: r.bus_id }));
  return { offline: rows.length };
});

const delayDetection = safe('delay', async () => {
  // Compare current time against planned_time of the next stop on each
  // active trip. If we are >5 minutes past planned_time and no stop_event
  // arrival has been recorded yet, raise a delay alert (idempotent per stop).
  const { rows } = await query(
    `WITH active AS (
       SELECT t.id AS trip_id, t.organization_id, t.route_id
       FROM trips t WHERE t.status = 'in_progress'
     ),
     next_stop AS (
       SELECT a.trip_id, a.organization_id, rs.id AS stop_id, rs.planned_time
       FROM active a
       JOIN route_stops rs ON rs.route_id = a.route_id
       LEFT JOIN stop_events se
         ON se.trip_id = a.trip_id AND se.stop_id = rs.id AND se.arrival_time IS NOT NULL
       WHERE rs.planned_time IS NOT NULL AND se.id IS NULL
       ORDER BY rs.stop_order ASC
     )
     INSERT INTO alerts (organization_id, type, severity, trip_id, message)
     SELECT DISTINCT organization_id, 'delay', 'warning', trip_id,
            'Trip is past planned arrival time at next stop'
     FROM next_stop
     WHERE (CURRENT_TIME - planned_time) > INTERVAL '5 minutes'
     RETURNING id`,
  );
  if (rows.length) return { raised: rows.length };
});

const closeStale = safe('autoClose', async () => {
  const closed = await autoCloseStaleTrips(AUTO_CLOSE_MINUTES);
  if (!closed.length) return;
  const ns = getIO()?.of('/ws');
  closed.forEach((id) => ns?.emit('trip.stopped', { id, reason: 'auto-closed' }));
  return { closed: closed.length };
});

let timers = [];

export const startCronJobs = () => {
  if (process.env.DISABLE_CRON === 'true') {
    logger.info('cron disabled (DISABLE_CRON=true)');
    return;
  }
  timers = [
    setInterval(gpsOffDetection, 60_000),
    setInterval(delayDetection, 120_000),
    setInterval(closeStale, 300_000),
  ];
  timers.forEach((t) => t.unref?.());
  logger.info('cron jobs started', {
    jobs: ['gpsOffDetection', 'delayDetection', 'autoCloseStaleTrips'],
  });
};

export const stopCronJobs = () => {
  timers.forEach(clearInterval);
  timers = [];
};
