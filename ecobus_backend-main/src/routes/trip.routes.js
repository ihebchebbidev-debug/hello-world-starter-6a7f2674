import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { tripSchema } from '../validators/schemas.js';
import * as svc from '../services/tripService.js';
import { getIO } from '../sockets/io.js';

const router = Router();
router.use(requireAuth);

const idParam = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const DRIVER_OR_MANAGER = ['driver', 'admin', 'super_admin', 'school_manager'];

/**
 * @openapi
 * /trips/start:
 *   post:
 *     tags: [Trips]
 *     summary: Start a trip (one active trip per driver)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TripInput' }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Driver already has an active trip }
 */
router.post(
  '/start',
  requireRole(...DRIVER_OR_MANAGER),
  validate(tripSchema),
  asyncHandler(async (req, res) => {
    const trip = await svc.start(req.user.organizationId, req.body);
    // Mirror to `global:live` so super-admins watching all schools see new
    // trips appear in real time. The room is server-gated by role.
    getIO()?.of('/ws')
      .to([`org:${req.user.organizationId}`, 'global:live'])
      .emit('trip.started', trip);
    res.status(201).json(trip);
  }),
);

/**
 * @openapi
 * /trips/stop:
 *   post:
 *     tags: [Trips]
 *     summary: Stop the trip identified in the body
 */
router.post(
  '/stop',
  requireRole(...DRIVER_OR_MANAGER),
  validate(z.object({ tripId: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    const trip = await svc.end(req.body.tripId, req.user.organizationId);
    const ns = getIO()?.of('/ws');
    const rooms = [`org:${req.user.organizationId}`, 'global:live'];
    ns?.to(rooms).emit('trip.stopped', trip);
    ns?.to(rooms).emit('trip.ended', trip);
    res.json(trip);
  }),
);

/**
 * @openapi
 * /trips/active:
 *   get:
 *     tags: [Trips]
 *     summary: List active trips for the current organization
 */
// Super-admins may opt into a cross-org listing with `?scope=all`.
// Without that flag, the endpoint stays org-scoped exactly as before.
router.get(
  '/active',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const wantsGlobal =
      req.query?.scope === 'all' &&
      (req.user.roles || []).includes('super_admin');
    const orgId = wantsGlobal ? null : req.user.organizationId;
    res.json(await svc.listActive(orgId));
  }),
);

/**
 * @openapi
 * /trips/history:
 *   get:
 *     tags: [Trips]
 *     summary: List historical (non-active) trips
 */
router.get(
  '/history',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) =>
    res.json(await svc.listHistory(req.user.organizationId, req.query))),
);

/**
 * @openapi
 * /trips/for-parent:
 *   get:
 *     tags: [Trips]
 *     summary: Active trips on routes ridden by the authenticated parent's children
 *     description: |
 *       Returns currently in_progress trips whose route is shared by at least
 *       one child of the calling parent. Non-parents get the full org list,
 *       so the same endpoint is safe for any role.
 */
router.get(
  '/for-parent',
  asyncHandler(async (req, res) =>
    res.json(await svc.listForParent(req.user))),
);

/**
 * @openapi
 * /trips/{id}:
 *   get:
 *     tags: [Trips]
 *     summary: Fetch a trip by id (own organization)
 */
router.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const trip = await svc.get(req.params.id, req.user.organizationId);
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  }),
);

/**
 * @openapi
 * /trips/{id}/end:
 *   patch:
 *     tags: [Trips]
 *     summary: End a trip by id (alias of POST /trips/stop)
 */
router.patch(
  '/:id/end',
  requireRole(...DRIVER_OR_MANAGER),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const trip = await svc.end(req.params.id, req.user.organizationId);
    const ns = getIO()?.of('/ws');
    const rooms = [`org:${req.user.organizationId}`, 'global:live'];
    ns?.to(rooms).emit('trip.stopped', trip);
    ns?.to(rooms).emit('trip.ended', trip);
    res.json(trip);
  }),
);

export default router;
