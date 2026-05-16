import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as svc from '../services/alertService.js';
import { getIO } from '../sockets/io.js';

const router = Router();
router.use(requireAuth);

const MANAGER = ['admin', 'school_manager', 'super_admin'];

// Canonical severities are info|warning|critical, but mobile clients
// commonly send low|medium|high. Normalize at the edge so the DB stays
// consistent.
const SEVERITY_ALIASES = {
  low: 'info',
  medium: 'warning',
  high: 'critical',
};
const alertSchema = z
  .object({
    type: z.string().min(1).max(50),
    severity: z
      .enum(['info', 'warning', 'critical', 'low', 'medium', 'high'])
      .optional(),
    busId: z.string().uuid().optional(),
    tripId: z.string().uuid().optional(),
    message: z.string().max(2000).optional(),
  })
  .transform((v) => ({
    ...v,
    severity: v.severity ? SEVERITY_ALIASES[v.severity] || v.severity : undefined,
  }));

const idParam = z.object({ id: z.string().uuid() });

/**
 * @openapi
 * /alerts:
 *   get:
 *     tags: [Alerts]
 *     summary: List alerts in the current organization
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, acknowledged, resolved] }
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [info, warning, critical] }
 */
router.get('/', asyncHandler(async (req, res) =>
  res.json(await svc.list(req.user.organizationId, {
    type: req.query.type,
    severity: req.query.severity,
    status: req.query.status,
    busId: req.query.busId,
    tripId: req.query.tripId,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  }))));

router.post('/', validate(alertSchema), asyncHandler(async (req, res) =>
  res.status(201).json(await svc.create(req.user.organizationId, req.body))));

router.get('/:id', validate(idParam, 'params'), asyncHandler(async (req, res) =>
  res.json(await svc.getById(req.user.organizationId, req.params.id))));

/**
 * @openapi
 * /alerts/{id}/acknowledge:
 *   patch:
 *     tags: [Alerts]
 *     summary: Acknowledge an alert (manager+)
 *     description: Moves the alert from `active` → `acknowledged` and stamps the actor.
 */
router.patch(
  '/:id/acknowledge',
  requireRole(...MANAGER),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const alert = await svc.acknowledge(req.user.organizationId, req.params.id, req.user.id);
    getIO()?.of('/ws').to(`org:${req.user.organizationId}`).emit('alert.acknowledged', alert);
    res.json(alert);
  }),
);

/**
 * @openapi
 * /alerts/{id}/resolve:
 *   patch:
 *     tags: [Alerts]
 *     summary: Resolve an alert (manager+)
 */
router.patch(
  '/:id/resolve',
  requireRole(...MANAGER),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const alert = await svc.resolve(req.user.organizationId, req.params.id, req.user.id);
    getIO()?.of('/ws').to(`org:${req.user.organizationId}`).emit('alert.resolved', alert);
    res.json(alert);
  }),
);

router.delete('/:id', requireRole(...MANAGER), validate(idParam, 'params'),
  asyncHandler(async (req, res) =>
    res.json(await svc.remove(req.user.organizationId, req.params.id))));

export default router;
