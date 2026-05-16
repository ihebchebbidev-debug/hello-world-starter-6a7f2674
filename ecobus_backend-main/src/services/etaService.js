/**
 * ETA module — estimates when a child's bus will reach the child's pickup or
 * dropoff stop, based on the bus's current live position and average speed.
 *
 * Algorithm (simple, dependency-free):
 *   1. Resolve child → route → relevant stop (pickup if upcoming today,
 *      otherwise dropoff).
 *   2. Find the most recent active route_assignment for that route → bus.
 *   3. Read bus_live_status. If GPS is stale (> 60s) or missing → return
 *      { available: false, reason }.
 *   4. Distance to stop via Haversine.
 *   5. ETA = distance / max(currentSpeed, fallbackSpeed).
 */
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

const FALLBACK_SPEED_KMH = 25;
const STALE_GPS_MS = 60_000;

/**
 * Great-circle distance in meters between two lat/lng pairs.
 */
export const haversineMeters = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const loadChildContext = async (orgId, childId) => {
  const { rows } = await query(
    `SELECT c.id AS child_id, c.parent_id,
            cr.route_id, cr.pickup_stop_id, cr.dropoff_stop_id,
            ps.latitude AS pickup_lat, ps.longitude AS pickup_lng, ps.name AS pickup_name,
            ds.latitude AS dropoff_lat, ds.longitude AS dropoff_lng, ds.name AS dropoff_name
     FROM children c
     JOIN child_routes cr ON cr.child_id = c.id
     LEFT JOIN route_stops ps ON ps.id = cr.pickup_stop_id
     LEFT JOIN route_stops ds ON ds.id = cr.dropoff_stop_id
     WHERE c.id = $1 AND c.organization_id = $2 AND c.deleted_at IS NULL
     ORDER BY cr.created_at DESC
     LIMIT 1`,
    [childId, orgId],
  );
  if (!rows[0]) throw ApiError.notFound('Child has no route assigned');
  return rows[0];
};

const loadActiveBus = async (orgId, routeId) => {
  const { rows } = await query(
    `SELECT ra.bus_id, ra.driver_id,
            bls.latitude, bls.longitude, bls.speed, bls.heading,
            bls.gps_status, bls.last_update, bls.trip_id
     FROM route_assignments ra
     LEFT JOIN bus_live_status bls ON bls.bus_id = ra.bus_id
     WHERE ra.route_id = $1 AND ra.organization_id = $2 AND ra.is_active = TRUE
     ORDER BY ra.created_at DESC
     LIMIT 1`,
    [routeId, orgId],
  );
  return rows[0] || null;
};

/**
 * Pick the most useful stop for an ETA right now: prefer pickup if it has
 * coordinates; fall back to dropoff. (A more sophisticated implementation
 * would compare current trip direction; this is sufficient for v1.)
 */
const pickTargetStop = (ctx) => {
  if (ctx.pickup_lat != null && ctx.pickup_lng != null) {
    return {
      stopId: ctx.pickup_stop_id,
      name: ctx.pickup_name,
      lat: Number(ctx.pickup_lat),
      lng: Number(ctx.pickup_lng),
      kind: 'pickup',
    };
  }
  if (ctx.dropoff_lat != null && ctx.dropoff_lng != null) {
    return {
      stopId: ctx.dropoff_stop_id,
      name: ctx.dropoff_name,
      lat: Number(ctx.dropoff_lat),
      lng: Number(ctx.dropoff_lng),
      kind: 'dropoff',
    };
  }
  return null;
};

export const etaForChild = async (orgId, childId) => {
  const ctx = await loadChildContext(orgId, childId);
  const target = pickTargetStop(ctx);
  if (!target) {
    return { available: false, reason: 'No stop coordinates configured for this child' };
  }

  const bus = await loadActiveBus(orgId, ctx.route_id);
  if (!bus) {
    return { available: false, reason: 'No active bus assigned to this route', target };
  }
  if (bus.latitude == null || bus.longitude == null || !bus.last_update) {
    return { available: false, reason: 'Bus has not reported its location yet', target };
  }
  const ageMs = Date.now() - new Date(bus.last_update).getTime();
  if (ageMs > STALE_GPS_MS) {
    return {
      available: false,
      reason: `Bus GPS is stale (${Math.round(ageMs / 1000)}s old)`,
      target,
      bus: { id: bus.bus_id, lastUpdate: bus.last_update },
    };
  }

  const distanceMeters = haversineMeters(
    { lat: Number(bus.latitude), lng: Number(bus.longitude) },
    target,
  );
  const speedKmh = Math.max(Number(bus.speed) || 0, FALLBACK_SPEED_KMH);
  const speedMps = (speedKmh * 1000) / 3600;
  const etaSeconds = Math.round(distanceMeters / speedMps);

  return {
    available: true,
    target,
    bus: {
      id: bus.bus_id,
      tripId: bus.trip_id,
      latitude: Number(bus.latitude),
      longitude: Number(bus.longitude),
      speedKmh: Number(bus.speed) || 0,
      lastUpdate: bus.last_update,
    },
    distanceMeters: Math.round(distanceMeters),
    etaSeconds,
    etaAt: new Date(Date.now() + etaSeconds * 1000).toISOString(),
  };
};
