import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { gpsRateLimiter } from '../middleware/gpsRateLimit.js';
import { gpsSchema, gpsHistoryQuerySchema } from '../validators/schemas.js';
import * as svc from '../services/gpsService.js';
import { createMany as createNotifications } from '../services/notificationService.js';
import { sendToUsers } from '../services/fcmService.js';
import { query } from '../config/db.js';
import { getIO } from '../sockets/io.js';
import { logger } from '../utils/logger.js';
import { enqueue as enqueueJob } from '../jobs/queue.js';

const router = Router();
router.use(requireAuth);

/**
 * Notify all parents impacted by ANY of the arrivals in this ping, in a
 * single DB round-trip and a single bulk insert. Returns the per-parent
 * payloads so the caller can also emit websocket events to user rooms.
 *
 * Designed for the GPS hot path: avoids N+1 queries and N inserts when a
 * bus reaches a stop where many children board.
 */
const fanOutArrivals = async ({ tripId, routeId, busId, arrivals }) => {
  if (arrivals.length === 0) return [];
  const stopIds = arrivals.map((s) => s.stopId);
  const { rows } = await query(
    `SELECT DISTINCT c.parent_id, cr.pickup_stop_id, cr.dropoff_stop_id
     FROM child_routes cr
     JOIN children c ON c.id = cr.child_id AND c.deleted_at IS NULL
     WHERE cr.route_id = $1
       AND (cr.pickup_stop_id = ANY($2::uuid[]) OR cr.dropoff_stop_id = ANY($2::uuid[]))
       AND c.parent_id IS NOT NULL`,
    [routeId, stopIds],
  );
  const stopById = new Map(arrivals.map((s) => [s.stopId, s]));

  const perParent = new Map();
  rows.forEach((r) => {
    const matched = [r.pickup_stop_id, r.dropoff_stop_id].filter((id) => stopById.has(id));
    matched.forEach((stopId) => {
      if (!perParent.has(r.parent_id)) perParent.set(r.parent_id, new Set());
      perParent.get(r.parent_id).add(stopId);
    });
  });

  const items = [];
  const events = [];
  for (const [parentId, stopSet] of perParent) {
    const stops = [...stopSet].map((id) => stopById.get(id));
    const stopName = stops[0]?.name || 'the stop';
    items.push({
      userId: parentId,
      title: 'Bus arriving',
      message: `The bus has reached ${stopName}.`,
      type: 'bus_arrival',
    });
    events.push({ parentId, payload: { tripId, routeId, busId, stops } });
  }

  await createNotifications(items).catch((err) =>
    logger.error('arrival bulk notify failed', { err: err.message, tripId }),
  );
  await sendToUsers(items.map((i) => i.userId), {
    title: 'Bus arriving',
    body: `The bus has reached ${arrivals[0]?.name || 'a stop'}.`,
    data: { tripId: tripId || '', busId, type: 'bus_arrival' },
  }).catch((err) => logger.error('arrival fcm failed', { err: err.message, tripId }));

  return events;
};

/**
 * @openapi
 * /tracking/location:
 *   post:
 *     tags: [GPS]
 *     summary: Ingest a GPS ping (rate-limited per bus to one ping every 3s)
 *     description: >
 *       Bus must belong to the caller's organization and have an
 *       in-progress trip. Drivers may only push GPS for their own trip.
 *       On stop arrival, impacted parents are notified in a single bulk
 *       insert and receive a `stop.arrived` event on their `user:{id}` room.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/GpsInput' }
 *     responses:
 *       202: { description: Accepted }
 *       400: { description: Validation failed or no active trip }
 *       403: { description: Cross-tenant or not the assigned driver }
 *       429: { description: Rate-limited }
 */
// Single ingest handler used by both POST / and POST /location (spec alias).
// Responds 202 first, then performs websocket fan-out + parent notifications
// off the request critical path so GPS writes stay sub-50ms under load.
const ingestHandler = asyncHandler(async (req, res) => {
  const { live, arrivals, tripId, routeId } = await svc.ingest(req.user, req.body);
  const busId = req.body.busId;

  res.status(202).json({ ...live, arrivals });

  const io = getIO();
  if (io) {
    const ns = io.of('/ws');
    // `global:live` is the cross-org room joined only by super-admin sockets
    // (server-controlled in sockets/io.js). Including it here lets platform
    // operators watch every fleet without breaking per-org isolation:
    // regular users are never in that room, so they only get their org's pings.
    const orgRoom = `org:${req.user.organizationId}`;
    const locRooms = [`bus:${busId}`, orgRoom, 'global:live'];
    if (tripId) locRooms.push(`trip:${tripId}`);
    ns.to(locRooms).emit('bus.location.updated', live);

    arrivals.forEach((stop) => {
      const event = { tripId, routeId, busId, stop };
      const arrivalRooms = [`bus:${busId}`, orgRoom, 'global:live'];
      if (tripId) arrivalRooms.push(`trip:${tripId}`);
      ns.to(arrivalRooms).emit('stop.arrived', event);
    });
  }

  if (arrivals.length > 0) {
    // Hand off to the bounded job queue. This guarantees that a burst of
    // arrivals across many buses cannot stall the GPS ingest path: the
    // queue caps concurrency, drops rather than OOMs under overload, and
    // is trivially swappable for BullMQ + Redis later.
    enqueueJob('arrival.fanOut', async () => {
      const events = await fanOutArrivals({ tripId, routeId, busId, arrivals });
      const ns2 = getIO()?.of('/ws');
      if (!ns2) return;
      events.forEach((e) =>
        ns2.to(`user:${e.parentId}`).emit('stop.arrived', e.payload));
    });
  }
});

router.post('/', validate(gpsSchema), gpsRateLimiter, ingestHandler);
router.post('/location', validate(gpsSchema), gpsRateLimiter, ingestHandler);

router.get('/live/:busId', asyncHandler(async (req, res) =>
  res.json(await svc.live(req.user.organizationId, req.params.busId))));

router.get('/live', asyncHandler(async (req, res) =>
  res.json(await svc.liveAll(req.user.organizationId))));

/**
 * @openapi
 * /tracking/history:
 *   get:
 *     tags: [GPS]
 *     summary: Query historical GPS pings for a bus or trip
 *     description: >
 *       Either `busId` or `tripId` is required. Results are scoped to the
 *       caller's organization and ordered by `recorded_at` DESC. Use
 *       `since`/`until` (ISO-8601) to bound the time window. `limit` is
 *       capped at 5000 server-side (default 500).
 *     parameters:
 *       - in: query
 *         name: busId
 *         schema: { type: string, format: uuid }
 *         example: 7f1c0e9a-2b3d-4e5f-90ab-1c2d3e4f5a6b
 *         description: Bus to fetch GPS history for. Mutually exclusive with `tripId`.
 *       - in: query
 *         name: tripId
 *         schema: { type: string, format: uuid }
 *         example: b2c3d4e5-6f70-4182-93a4-b5c6d7e8f901
 *         description: Trip to fetch GPS history for.
 *       - in: query
 *         name: since
 *         schema: { type: string, format: date-time }
 *         example: 2026-04-27T06:00:00.000Z
 *       - in: query
 *         name: until
 *         schema: { type: string, format: date-time }
 *         example: 2026-04-27T10:00:00.000Z
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 5000, default: 500 }
 *         example: 500
 *     responses:
 *       200:
 *         description: Array of GPS log entries (newest first)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/GpsLogEntry' }
 *             examples:
 *               sample:
 *                 summary: Two recent pings on a trip
 *                 value:
 *                   - id: a1b2c3d4-5e6f-4708-91a2-b3c4d5e6f708
 *                     trip_id: b2c3d4e5-6f70-4182-93a4-b5c6d7e8f901
 *                     bus_id: 7f1c0e9a-2b3d-4e5f-90ab-1c2d3e4f5a6b
 *                     latitude: 36.8065
 *                     longitude: 10.1815
 *                     speed: 12.4
 *                     heading: 87.5
 *                     accuracy: 8.2
 *                     battery_level: 73
 *                     recorded_at: 2026-04-27T08:15:32.000Z
 *                   - id: c2d3e4f5-6071-4283-94b5-c6d7e8f90123
 *                     trip_id: b2c3d4e5-6f70-4182-93a4-b5c6d7e8f901
 *                     bus_id: 7f1c0e9a-2b3d-4e5f-90ab-1c2d3e4f5a6b
 *                     latitude: 36.8061
 *                     longitude: 10.1808
 *                     speed: 11.9
 *                     heading: 86.0
 *                     accuracy: 7.5
 *                     battery_level: 73
 *                     recorded_at: 2026-04-27T08:15:29.000Z
 *       400: { description: Validation failed (busId or tripId required) }
 *       401: { description: Unauthenticated }
 */
router.get(
  '/history',
  validate(gpsHistoryQuerySchema, 'query'),
  asyncHandler(async (req, res) =>
    res.json(await svc.history(req.user.organizationId, {
      busId: req.query.busId,
      tripId: req.query.tripId,
      since: req.query.since,
      until: req.query.until,
      limit: req.query.limit,
    }))),
);

export default router;
