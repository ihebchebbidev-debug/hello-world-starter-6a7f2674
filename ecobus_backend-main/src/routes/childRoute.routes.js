/**
 * Top-level child-route assignments endpoint.
 *
 * Mirrors the spec's `/child-routes` collection. The same logic is also
 * exposed under /children/:id/routes; this route keeps the contract the
 * client team requested.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';
import * as svc from '../services/childrenService.js';

const router = Router();
router.use(requireAuth);

const MANAGER = ['admin', 'super_admin', 'school_manager'];

// Stops are optional on assignment — they can be filled in later via PATCH
// on the child resource, or left null when a route only has one stop.
const createSchema = z.object({
  childId: z.string().uuid(),
  routeId: z.string().uuid(),
  pickupStopId: z.string().uuid().optional(),
  dropoffStopId: z.string().uuid().optional(),
});

const idParam = z.object({ id: z.string().uuid() });

/**
 * @openapi
 * /child-routes:
 *   post:
 *     tags: [ChildRoutes]
 *     summary: Assign a child to a route with pickup/dropoff stops
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [childId, routeId]
 *             properties:
 *               childId: { type: string, format: uuid }
 *               routeId: { type: string, format: uuid }
 *               pickupStopId: { type: string, format: uuid }
 *               dropoffStopId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Already assigned }
 */
router.post(
  '/',
  requireRole(...MANAGER),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { childId, ...rest } = req.body;
    res.status(201).json(await svc.assignRoute(req.user.organizationId, childId, rest));
  }),
);

/**
 * @openapi
 * /child-routes/{id}:
 *   delete:
 *     tags: [ChildRoutes]
 *     summary: Remove a child-route assignment
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 */
router.delete(
  '/:id',
  requireRole(...MANAGER),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    // Service requires childId for authorization; resolve it from the row.
    const { query } = await import('../config/db.js');
    const { rows } = await query(
      `SELECT cr.child_id FROM child_routes cr
       JOIN children c ON c.id = cr.child_id
       WHERE cr.id = $1 AND c.organization_id = $2`,
      [req.params.id, req.user.organizationId],
    );
    if (!rows[0]) throw ApiError.notFound('Child-route assignment not found');
    res.json(await svc.unassignRoute(req.user.organizationId, rows[0].child_id, req.params.id));
  }),
);

export default router;
