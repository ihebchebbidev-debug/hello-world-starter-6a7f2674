/**
 * Children management endpoints.
 *
 * All routes require authentication. Mutating endpoints require admin,
 * school_manager or super_admin and are tenant-scoped via organization_id.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  childSchema,
  updateChildSchema,
  childRouteSchema,
} from '../validators/schemas.js';
import * as svc from '../services/childrenService.js';

const router = Router();
router.use(requireAuth);

const MANAGER = ['admin', 'super_admin', 'school_manager'];

const idParam = z.object({ id: z.string().uuid() });
const childRouteParams = z.object({
  id: z.string().uuid(),
  childRouteId: z.string().uuid(),
});
const listQuery = z.object({
  search: z.string().min(1).max(100).optional(),
  parentId: z.string().uuid().optional(),
  routeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * @openapi
 * /children:
 *   get:
 *     tags: [Children]
 *     summary: List children in the current organization
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: parentId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: routeId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Child' }
 *   post:
 *     tags: [Children]
 *     summary: Create a child
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChildInput' }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Child' }
 */
router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) =>
    res.json(await svc.list(req.user.organizationId, req.query, req.user))),
);

router.post(
  '/',
  requireRole(...MANAGER),
  validate(childSchema),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.create(req.user.organizationId, req.body))),
);

/**
 * @openapi
 * /children/{id}:
 *   get:
 *     tags: [Children]
 *     summary: Get a child by id (with assigned routes)
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
 *             schema: { $ref: '#/components/schemas/Child' }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Children]
 *     summary: Update a child
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChildInput' }
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Child' }
 *   delete:
 *     tags: [Children]
 *     summary: Soft-delete a child
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) =>
    res.json(await svc.getById(req.user.organizationId, req.params.id, req.user))),
);

router.patch(
  '/:id',
  requireRole(...MANAGER),
  validate(idParam, 'params'),
  validate(updateChildSchema),
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
 * /children/{id}/routes:
 *   post:
 *     tags: [Children]
 *     summary: Assign a child to a route (with optional pickup/dropoff stops)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ChildRouteInput' }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Child already assigned to this route }
 *
 * /children/{id}/routes/{childRouteId}:
 *   delete:
 *     tags: [Children]
 *     summary: Unassign a child from a route
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: childRouteId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/:id/routes',
  requireRole(...MANAGER),
  validate(idParam, 'params'),
  validate(childRouteSchema),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.assignRoute(req.user.organizationId, req.params.id, req.body))),
);

router.delete(
  '/:id/routes/:childRouteId',
  requireRole(...MANAGER),
  validate(childRouteParams, 'params'),
  asyncHandler(async (req, res) =>
    res.json(await svc.unassignRoute(req.user.organizationId, req.params.id, req.params.childRouteId))),
);

export default router;
