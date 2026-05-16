import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { checkinSchema } from '../validators/schemas.js';
import * as svc from '../services/checkinService.js';

const router = Router();
router.use(requireAuth);

/**
 * @openapi
 * /checkins:
 *   post:
 *     tags: [Check-ins]
 *     summary: Record a child boarding/leaving event
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CheckinInput' }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Checkin' }
 */
router.post(
  '/',
  validate(checkinSchema),
  asyncHandler(async (req, res) => {
    const idem = req.body.idempotencyKey || req.get('Idempotency-Key') || null;
    res.status(201).json(await svc.create(req.user, { ...req.body, idempotencyKey: idem }));
  }),
);

/**
 * @openapi
 * /checkins/trip/{tripId}:
 *   get:
 *     tags: [Check-ins]
 *     summary: List check-ins for a trip
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Checkin' }
 */
router.get('/trip/:tripId', asyncHandler(async (req, res) => res.json(await svc.listForTrip(req.user, req.params.tripId))));

/**
 * @openapi
 * /checkins/child/{childId}:
 *   get:
 *     tags: [Check-ins]
 *     summary: Trip + check-in history for a single child
 *     description: >
 *       Parents may only query their own children. Returns up to `limit`
 *       check-ins (default 50, max 500) joined with trip and route metadata.
 *     parameters:
 *       - in: path
 *         name: childId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 500, default: 50 }
 *     responses:
 *       200: { description: Array of check-ins with trip/route metadata }
 *       403: { description: Parent attempted to view another family's child }
 *       404: { description: Child not found }
 */
router.get(
  '/child/:childId',
  asyncHandler(async (req, res) =>
    res.json(await svc.listForChild(req.user, req.params.childId, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }))),
);

export default router;
