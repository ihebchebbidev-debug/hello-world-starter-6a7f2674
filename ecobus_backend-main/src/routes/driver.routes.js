/**
 * Driver management & route assignment endpoints.
 *
 * - GET /drivers           → list users with role 'driver' in this org
 * - GET /drivers/:id       → driver profile + assignments
 * - GET /drivers/assignments + CRUD → manage route_assignments
 *
 * All routes require authentication. Mutations require manager-level roles.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  assignmentSchema,
  updateAssignmentSchema,
} from '../validators/schemas.js';
import * as svc from '../services/driverService.js';

const router = Router();
router.use(requireAuth);

const MANAGER = ['admin', 'super_admin', 'school_manager'];

const idParam = z.object({ id: z.string().uuid() });

const listDriversQuery = z.object({
  search: z.string().min(1).max(100).optional(),
  isActive: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const listAssignmentsQuery = z.object({
  routeId: z.string().uuid().optional(),
  busId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ---------- Driver listing ----------

/**
 * @openapi
 * /drivers:
 *   get:
 *     tags: [Drivers]
 *     summary: List drivers (users with role 'driver') in the current organization
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/User' }
 */
router.get(
  '/',
  validate(listDriversQuery, 'query'),
  asyncHandler(async (req, res) =>
    res.json(await svc.listDrivers(req.user.organizationId, req.query))),
);

// Current driver's active assignment (used by the driver mobile app).
router.get(
  '/me/assignment',
  asyncHandler(async (req, res) => {
    const list = await svc.listAssignments(req.user.organizationId, {
      driverId: req.user.id,
      isActive: true,
      limit: 1,
    });
    res.json(list[0] || null);
  }),
);

// ---------- Assignments ----------
// NOTE: declare /assignments BEFORE /:id so Express does not match it as :id

/**
 * @openapi
 * /drivers/assignments:
 *   get:
 *     tags: [Drivers]
 *     summary: List route assignments
 *     parameters:
 *       - in: query
 *         name: routeId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: busId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: driverId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Assignment' }
 *   post:
 *     tags: [Drivers]
 *     summary: Create a route assignment (driver + bus + route)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AssignmentInput' }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Assignment' }
 *       409: { description: Driver or bus already has an active assignment }
 */
router.get(
  '/assignments',
  validate(listAssignmentsQuery, 'query'),
  asyncHandler(async (req, res) =>
    res.json(await svc.listAssignments(req.user.organizationId, req.query))),
);

router.post(
  '/assignments',
  requireRole(...MANAGER),
  validate(assignmentSchema),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.createAssignment(req.user.organizationId, req.body))),
);

/**
 * @openapi
 * /drivers/assignments/{id}:
 *   get:
 *     tags: [Drivers]
 *     summary: Get an assignment by id
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
 *             schema: { $ref: '#/components/schemas/Assignment' }
 *   patch:
 *     tags: [Drivers]
 *     summary: Update an assignment
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AssignmentInput' }
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Assignment' }
 *   delete:
 *     tags: [Drivers]
 *     summary: Delete an assignment
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 *
 * /drivers/assignments/{id}/deactivate:
 *   post:
 *     tags: [Drivers]
 *     summary: Mark an assignment as inactive (closes end_date)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/assignments/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) =>
    res.json(await svc.getAssignment(req.user.organizationId, req.params.id))),
);

router.patch(
  '/assignments/:id',
  requireRole(...MANAGER),
  validate(idParam, 'params'),
  validate(updateAssignmentSchema),
  asyncHandler(async (req, res) =>
    res.json(await svc.updateAssignment(req.user.organizationId, req.params.id, req.body))),
);

router.post(
  '/assignments/:id/deactivate',
  requireRole(...MANAGER),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) =>
    res.json(await svc.deactivateAssignment(req.user.organizationId, req.params.id))),
);

router.delete(
  '/assignments/:id',
  requireRole(...MANAGER),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) =>
    res.json(await svc.deleteAssignment(req.user.organizationId, req.params.id))),
);

// ---------- Driver detail (after /assignments to avoid collision) ----------

/**
 * @openapi
 * /drivers/{id}:
 *   get:
 *     tags: [Drivers]
 *     summary: Get a driver profile with their route assignments
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: OK
 *       404: { description: Not found }
 */
router.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) =>
    res.json(await svc.getDriver(req.user.organizationId, req.params.id))),
);

export default router;
