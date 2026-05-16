/**
 * Bus management endpoints.
 *
 * All routes require authentication. Mutations require admin/super_admin/
 * school_manager roles and are tenant-scoped via organization_id.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { busSchema, updateBusSchema, BUS_STATUS } from '../validators/schemas.js';
import * as svc from '../services/busService.js';

const router = Router();
router.use(requireAuth);

const idParam = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  search: z.string().min(1).max(100).optional(),
  status: BUS_STATUS.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const MANAGER = ['admin', 'super_admin', 'school_manager'];

// READ-ONLY cross-org scope, only for super-admins explicitly opting in.
// Returns the orgId to pass to the service layer:
//   - super_admin + ?scope=all  → null  (cross-org)
//   - everyone else             → req.user.organizationId
// Mutations always pass req.user.organizationId directly — no escape hatch.
const readScope = (req) =>
  (req.query?.scope === 'all' && (req.user.roles || []).includes('super_admin'))
    ? null
    : req.user.organizationId;

/**
 * @openapi
 * /buses:
 *   get:
 *     tags: [Buses]
 *     summary: List buses for the current organization
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive, maintenance] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Bus' }
 *   post:
 *     tags: [Buses]
 *     summary: Create a bus
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BusInput' }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Bus' }
 *       409: { description: Plate number already exists }
 */
router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => res.json(await svc.list(readScope(req), req.query))),
);

router.post(
  '/',
  requireRole(...MANAGER),
  validate(busSchema),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.create(req.user.organizationId, req.body))),
);

/**
 * @openapi
 * /buses/{id}:
 *   get:
 *     tags: [Buses]
 *     summary: Get a bus by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Bus' }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Buses]
 *     summary: Update a bus
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BusInput' }
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Bus' }
 *   delete:
 *     tags: [Buses]
 *     summary: Soft-delete a bus
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 *       409: { description: Bus has active assignments }
 */
router.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => res.json(await svc.getById(readScope(req), req.params.id))),
);

router.patch(
  '/:id',
  requireRole(...MANAGER),
  validate(idParam, 'params'),
  validate(updateBusSchema),
  asyncHandler(async (req, res) =>
    res.json(await svc.update(req.user.organizationId, req.params.id, req.body))),
);

router.delete(
  '/:id',
  requireRole(...MANAGER),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) =>
    res.json(await svc.remove(req.user.organizationId, req.params.id))),
);

/**
 * @openapi
 * /buses/{id}/live:
 *   get:
 *     tags: [Buses]
 *     summary: Latest live status for a bus
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LiveStatus' }
 *       404: { description: Bus not found }
 */
router.get(
  '/:id/live',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const data = await svc.liveStatus(readScope(req), req.params.id);
    if (!data) return res.status(404).json({ error: 'No live status yet' });
    res.json(data);
  }),
);

export default router;
