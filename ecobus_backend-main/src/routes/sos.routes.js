import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sosSchema, sosListQuerySchema } from '../validators/schemas.js';
import * as svc from '../services/sosService.js';
import { getIO } from '../sockets/io.js';

const router = Router();
router.use(requireAuth);

const MANAGER = ['admin', 'school_manager', 'super_admin'];

/**
 * @openapi
 * /sos:
 *   post:
 *     tags: [SOS]
 *     summary: Trigger an SOS alert (parent or driver)
 *     description: >
 *       Persists an `sos_alerts` row plus an org-wide `alerts` row, then
 *       fans out via WebSocket and notifications. Broadcasts `sos.triggered`
 *       on `org:{orgId}`, `trip:{tripId}` (when set), `bus:{busId}` (when
 *       resolvable from the trip), and per-recipient `user:{userId}` rooms.
 *       Recipients are: org admins/school_managers/super_admins plus
 *       parents of any child currently boarded on the trip.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SosInput' }
 *     responses:
 *       201:
 *         description: Created — alert was stored and broadcast
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SosAlert' }
 *       403: { description: Role not allowed (only parent/driver/admin) or cross-tenant trip }
 */
router.post(
  '/',
  requireRole('parent', 'driver', ...MANAGER),
  validate(sosSchema),
  asyncHandler(async (req, res) => {
    const idem = req.body.idempotencyKey || req.get('Idempotency-Key') || null;
    const { alert, audience, context } = await svc.trigger(req.user, { ...req.body, idempotencyKey: idem });
    const io = getIO();
    if (io) {
      const ns = io.of('/ws');
      const payload = {
        ...alert,
        tripId: context.tripId,
        busId: context.busId,
        routeId: context.routeId,
      };
      ns.to(`org:${req.user.organizationId}`).emit('sos.triggered', payload);
      if (context.tripId) ns.to(`trip:${context.tripId}`).emit('sos.triggered', payload);
      if (context.busId) ns.to(`bus:${context.busId}`).emit('sos.triggered', payload);
      audience.forEach((uid) => ns.to(`user:${uid}`).emit('sos.triggered', payload));
    }
    res.status(201).json(alert);
  }),
);

/**
 * @openapi
 * /sos:
 *   get:
 *     tags: [SOS]
 *     summary: List SOS alerts in the current organization
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, acknowledged, resolved] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 500, default: 100 }
 *     responses:
 *       200:
 *         description: Array of SOS alerts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/SosAlert' }
 */
router.get(
  '/',
  requireRole(...MANAGER),
  validate(sosListQuerySchema, 'query'),
  asyncHandler(async (req, res) => res.json(await svc.listForOrg(req.user.organizationId, req.query))),
);

/**
 * @openapi
 * /sos/{id}/resolve:
 *   patch:
 *     tags: [SOS]
 *     summary: Mark an SOS alert as resolved (admin only)
 *     description: Broadcasts `sos.resolved` on `org:{orgId}`.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Resolved alert
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SosAlert' }
 *       404: { description: Alert not found in this organization }
 */
router.patch(
  '/:id/resolve',
  requireRole(...MANAGER),
  asyncHandler(async (req, res) => {
    const alert = await svc.resolve(req.user.organizationId, req.params.id, req.user.id);
    getIO()?.of('/ws').to(`org:${req.user.organizationId}`).emit('sos.resolved', alert);
    res.json(alert);
  }),
);

/**
 * @openapi
 * /sos/{id}/acknowledge:
 *   patch:
 *     tags: [SOS]
 *     summary: Acknowledge an SOS alert (manager+)
 *     description: >
 *       Intermediate state between `active` and `resolved`. Stamps
 *       `acknowledged_at` and `acknowledged_by`. Broadcasts `sos.acknowledged`
 *       on `org:{orgId}`.
 *     responses:
 *       200: { description: Acknowledged alert }
 *       404: { description: Alert not found or already resolved }
 */
router.patch(
  '/:id/acknowledge',
  requireRole(...MANAGER),
  asyncHandler(async (req, res) => {
    const alert = await svc.acknowledge(req.user.organizationId, req.params.id, req.user.id);
    getIO()?.of('/ws').to(`org:${req.user.organizationId}`).emit('sos.acknowledged', alert);
    res.json(alert);
  }),
);

export default router;
