/**
 * Child absences endpoints. Parents declare absences for their own children;
 * managers can see / cancel any absence in their organization.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as svc from '../services/absenceService.js';

const router = Router();
router.use(requireAuth);

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

const listQuery   = z.object({ from: dateStr.optional(), to: dateStr.optional() });
const childParam  = z.object({ childId: z.string().uuid() });
const idParam     = z.object({ id: z.string().uuid() });
const createBody  = z.object({
  startDate: dateStr,
  endDate  : dateStr,
  reason   : z.enum(['sick', 'appointment', 'travel', 'other']).optional(),
  note     : z.string().max(500).optional().nullable(),
});

router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => res.json(await svc.listForUser(req.user, req.query))),
);

router.get(
  '/child/:childId',
  validate(childParam, 'params'),
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) =>
    res.json(await svc.listForChild(req.user, req.params.childId, req.query))),
);

router.post(
  '/child/:childId',
  validate(childParam, 'params'),
  validate(createBody),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.create(req.user, req.params.childId, req.body))),
);

router.delete(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => res.json(await svc.cancel(req.user, req.params.id))),
);

export default router;
