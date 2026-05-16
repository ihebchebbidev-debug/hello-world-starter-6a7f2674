/**
 * GPS service.
 *
 * Business rules enforced here (not just at the route layer):
 *   - The bus must belong to the caller's organization.
 *   - The bus must have an active route_assignment.
 *   - There must be an in_progress trip for that assignment, and if the
 *     caller passes a tripId it must match.
 *   - Drivers may only push GPS for their own active trip.
 *
 * After persistence, we run lightweight stop-arrival detection using each
 * route's stops + a 75m radius, recording one stop_event per (trip, stop).
 * Detected arrivals are returned so the route layer can fan them out over
 * websocket and as parent notifications.
 */
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { haversineMeters } from './etaService.js';
import { enqueue as enqueueGpsLog } from './gpsBatcher.js';

const STOP_ARRIVAL_RADIUS_M = 75;

/**
 * Resolve and authorize the trip context for this GPS ping.
 * Returns { tripId, routeId, driverId, busId } or throws ApiError.
 */
const resolveActiveTrip = async (user, busId, providedTripId) => {
  const { rows } = await query(
    `SELECT t.id AS trip_id, t.route_id, ra.driver_id, ra.bus_id, b.organization_id
     FROM buses b
     JOIN route_assignments ra
       ON ra.bus_id = b.id AND ra.is_active = TRUE
     JOIN trips t
       ON t.assignment_id = ra.id AND t.status = 'in_progress'
     WHERE b.id = $1 AND b.deleted_at IS NULL`,
    [busId],
  );
  const ctx = rows[0];
  if (!ctx) {
    throw ApiError.badRequest(
      'No active trip for this bus — start a trip before sending GPS',
    );
  }
  if (ctx.organization_id !== user.organizationId) {
    throw ApiError.forbidden('Bus does not belong to your organization');
  }
  if (providedTripId && providedTripId !== ctx.trip_id) {
    throw ApiError.badRequest('tripId does not match the bus\'s active trip');
  }
  // Drivers can only push GPS for their own assignment.
  const isDriver = (user.roles || []).includes('driver');
  if (isDriver && ctx.driver_id !== user.id) {
    throw ApiError.forbidden('Drivers may only push GPS for their own trip');
  }
  return ctx;
};

/**
 * Detect arrivals at any not-yet-visited stop on this route, within radius.
 *
 * Two passes — both single-shot SQL, no transaction held while we loop:
 *   1. SELECT candidate stops (one query).
 *   2. Compute distances in JS (cheap, in-process).
 *   3. Bulk INSERT every candidate within radius via one statement using
 *      `unnest($::uuid[])` + `ON CONFLICT DO NOTHING RETURNING stop_id`.
 *      The partial unique index `uq_stop_events_trip_stop_arrival`
 *      guarantees idempotency across concurrent pings.
 *
 * The previous implementation looped INSERTs inside a transaction, which
 * held a writer connection for the duration and serialised every concurrent
 * GPS ping. This version takes one connection from the pool, briefly.
 */
const detectArrivals = async ({ tripId, routeId, latitude, longitude }) => {
  const { rows: stops } = await query(
    `SELECT rs.id, rs.name, rs.latitude, rs.longitude, rs.stop_order
     FROM route_stops rs
     LEFT JOIN stop_events se
       ON se.stop_id = rs.id AND se.trip_id = $1 AND se.arrival_time IS NOT NULL
     WHERE rs.route_id = $2 AND se.id IS NULL
     ORDER BY rs.stop_order ASC`,
    [tripId, routeId],
  );

  const lat = Number(latitude);
  const lng = Number(longitude);
  const candidates = [];
  for (const stop of stops) {
    const dist = haversineMeters(
      { lat, lng },
      { lat: Number(stop.latitude), lng: Number(stop.longitude) },
    );
    if (dist <= STOP_ARRIVAL_RADIUS_M) {
      candidates.push({
        stopId: stop.id,
        name: stop.name,
        stopOrder: stop.stop_order,
        distanceMeters: Math.round(dist),
      });
    }
  }
  if (candidates.length === 0) return [];

  const ids = candidates.map((c) => c.stopId);
  const { rows: inserted } = await query(
    `INSERT INTO stop_events (trip_id, stop_id, arrival_time, status)
     SELECT $1, sid, NOW(), 'arrived'
     FROM unnest($2::uuid[]) AS sid
     ON CONFLICT DO NOTHING
     RETURNING stop_id`,
    [tripId, ids],
  );
  const wonRace = new Set(inserted.map((r) => r.stop_id));
  return candidates.filter((c) => wonRace.has(c.stopId));
};

export const ingest = async (user, payload) => {
  const {
    busId, tripId: clientTripId, latitude, longitude,
    speed, heading, accuracy, batteryLevel,
  } = payload;

  const ctx = await resolveActiveTrip(user, busId, clientTripId);
  const tripId = ctx.trip_id;
  const recordedAt = new Date();

  // 1. gps_logs — buffered. Survives bursts; no DB round-trip on the hot path.
  enqueueGpsLog({
    tripId, busId, latitude, longitude,
    speed, heading, accuracy, batteryLevel,
    recordedAt,
  });

  // 2. bus_live_status — single UPSERT, no surrounding transaction. This is
  //    the row everyone reads, so freshness matters; one round-trip is fine.
  const { rows } = await query(
    `INSERT INTO bus_live_status
      (bus_id, trip_id, latitude, longitude, speed, heading, accuracy,
       battery_level, gps_status, last_update, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ok', NOW(), NOW())
     ON CONFLICT (bus_id) DO UPDATE SET
       trip_id = EXCLUDED.trip_id,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       speed = EXCLUDED.speed,
       heading = EXCLUDED.heading,
       accuracy = EXCLUDED.accuracy,
       battery_level = EXCLUDED.battery_level,
       gps_status = 'ok',
       last_update = NOW(),
       updated_at = NOW()
     RETURNING bus_id, trip_id, latitude, longitude, speed, heading, last_update`,
    [busId, tripId, latitude, longitude, speed ?? null,
     heading ?? null, accuracy ?? null, batteryLevel ?? null],
  );

  // 3. Stop arrivals — bulk insert (no per-row loop, no transaction).
  const arrivals = await detectArrivals({
    tripId, routeId: ctx.route_id, latitude, longitude,
  });

  return { live: rows[0], arrivals, tripId, routeId: ctx.route_id };
};

export const live = async (orgId, busId) => {
  const { rows } = await query(
    `SELECT bls.* FROM bus_live_status bls
     JOIN buses b ON b.id = bls.bus_id
     WHERE bls.bus_id = $1 AND b.organization_id = $2`,
    [busId, orgId],
  );
  return rows[0] || null;
};

export const liveAll = async (orgId) => {
  const { rows } = await query(
    `SELECT bls.*, b.name AS bus_name, b.plate_number
     FROM bus_live_status bls
     JOIN buses b ON b.id = bls.bus_id
     WHERE b.organization_id = $1
     ORDER BY bls.last_update DESC NULLS LAST`,
    [orgId],
  );
  return rows;
};

export const history = async (orgId, { busId, tripId, since, until, limit = 500 }) => {
  const params = []; const where = [];
  if (busId) {
    params.push(busId, orgId);
    where.push(`g.bus_id = $${params.length - 1}`);
    where.push(`b.organization_id = $${params.length}`);
  } else if (tripId) {
    params.push(tripId);
    where.push(`g.trip_id = $${params.length}`);
    params.push(orgId);
    where.push(`b.organization_id = $${params.length}`);
  } else {
    throw ApiError.badRequest('busId or tripId required');
  }
  if (since) { params.push(since); where.push(`g.recorded_at >= $${params.length}`); }
  if (until) { params.push(until); where.push(`g.recorded_at <= $${params.length}`); }
  params.push(Math.min(limit, 5000));
  const { rows } = await query(
    `SELECT g.id, g.trip_id, g.bus_id, g.latitude, g.longitude, g.speed,
            g.heading, g.accuracy, g.battery_level, g.recorded_at
     FROM gps_logs g
     JOIN buses b ON b.id = g.bus_id
     WHERE ${where.join(' AND ')}
     ORDER BY g.recorded_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
};
