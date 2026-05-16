import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { eventSchema, analyticsSessionSchema } from '../validators/schemas.js';
import * as svc from '../services/analyticsService.js';

const router = Router();
router.use(optionalAuth);

const MANAGER = ['admin', 'school_manager', 'super_admin'];

/**
 * @openapi
 * /analytics/session/start:
 *   post:
 *     tags: [Analytics]
 *     summary: Start an analytics session (user can be anonymous)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AnalyticsSessionInput' }
 *     responses:
 *       201: { description: Created }
 */
router.post(
  '/session/start',
  validate(analyticsSessionSchema),
  asyncHandler(async (req, res) => {
    // Authenticated users get attributed automatically; anonymous accepted.
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId;
    res.status(201).json(await svc.startSession({ userId, organizationId, ...req.body }));
  }),
);

/**
 * @openapi
 * /analytics/session/{id}/end:
 *   post:
 *     tags: [Analytics]
 *     summary: End an analytics session
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/session/:id/end',
  validate(z.object({ id: z.string().uuid() }), 'params'),
  asyncHandler(async (req, res) =>
    res.json(await svc.endSession(req.params.id, req.user?.id))),
);

/**
 * @openapi
 * /analytics/event:
 *   post:
 *     tags: [Analytics]
 *     summary: Record an analytics event
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AnalyticsEventInput' }
 *     responses:
 *       201: { description: Created }
 */
router.post(
  '/event',
  validate(eventSchema),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.recordEvent({ ...req.body, userId: req.user?.id }))),
);

// Backward-compat: original spelling
router.post(
  '/events',
  validate(eventSchema),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.recordEvent({ ...req.body, userId: req.user?.id }))),
);

const overviewQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});
const reportQuery = z.object({
  days: z.coerce.number().int().min(1).max(180).optional(),
  routeId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),
});

/**
 * @openapi
 * /analytics/overview:
 *   get:
 *     tags: [Analytics]
 *     summary: School-admin dashboard KPIs (fleet, trips, GPS, SOS, attendance, DAU)
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, minimum: 1, maximum: 90, default: 7 }
 *     responses:
 *       200: { description: KPI blob }
 */
router.get(
  '/overview',
  requireAuth, requireRole(...MANAGER),
  validate(overviewQuery, 'query'),
  asyncHandler(async (req, res) =>
    res.json(await svc.orgOverview(req.user.organizationId, { days: req.query.days }))),
);

/**
 * @openapi
 * /analytics/super-admin/overview:
 *   get:
 *     tags: [Analytics]
 *     summary: Platform-wide SaaS overview (super_admin only)
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, minimum: 1, maximum: 90, default: 7 }
 *     responses:
 *       200: { description: Platform KPI blob }
 */
router.get(
  '/super-admin/overview',
  requireAuth, requireRole('super_admin'),
  validate(overviewQuery, 'query'),
  asyncHandler(async (req, res) =>
    res.json(await svc.platformOverview({ days: req.query.days }))),
);

/**
 * @openapi
 * /analytics/reports/attendance:
 *   get:
 *     tags: [Analytics]
 *     summary: Attendance grouped by route over a window
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, minimum: 1, maximum: 180, default: 30 }
 *       - in: query
 *         name: routeId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: tripId
 *         schema: { type: string, format: uuid }
 */
router.get(
  '/reports/attendance',
  requireAuth, requireRole(...MANAGER),
  validate(reportQuery, 'query'),
  asyncHandler(async (req, res) =>
    res.json(await svc.attendanceReport(req.user.organizationId, {
      days: req.query.days, routeId: req.query.routeId, tripId: req.query.tripId,
    }))),
);

/**
 * @openapi
 * /analytics/reports/driver-performance:
 *   get:
 *     tags: [Analytics]
 *     summary: Per-driver trips completed and on-time stop percentage
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, minimum: 1, maximum: 180, default: 30 }
 */
router.get(
  '/reports/driver-performance',
  requireAuth, requireRole(...MANAGER),
  validate(reportQuery, 'query'),
  asyncHandler(async (req, res) =>
    res.json(await svc.driverPerformanceReport(req.user.organizationId, { days: req.query.days }))),
);

export default router;
