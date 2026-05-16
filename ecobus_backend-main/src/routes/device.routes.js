import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { deviceTokenSchema } from '../validators/schemas.js';
import * as svc from '../services/deviceService.js';

const router = Router();
router.use(requireAuth);

const tokenParam = z.object({ token: z.string().min(10).max(4096) });

/**
 * @openapi
 * /devices/token:
 *   post:
 *     tags: [Devices]
 *     summary: Register or refresh an FCM device token for the current user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/DeviceTokenInput' }
 *     responses:
 *       201: { description: Created/Updated }
 */
router.post(
  '/token',
  validate(deviceTokenSchema),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.registerToken(req.user.id, req.body))),
);

// Spec alias: some clients POST directly to /devices instead of /devices/token.
router.post(
  '/',
  validate(deviceTokenSchema),
  asyncHandler(async (req, res) =>
    res.status(201).json(await svc.registerToken(req.user.id, req.body))),
);

/**
 * @openapi
 * /devices:
 *   get:
 *     tags: [Devices]
 *     summary: List the current user's active devices
 *     responses:
 *       200: { description: OK }
 */
router.get('/', asyncHandler(async (req, res) => res.json(await svc.listForUser(req.user.id))));

/**
 * @openapi
 * /devices/token/{token}:
 *   delete:
 *     tags: [Devices]
 *     summary: Revoke a device token
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.delete(
  '/token/:token',
  validate(tokenParam, 'params'),
  asyncHandler(async (req, res) =>
    res.json(await svc.revokeToken(req.user.id, req.params.token))),
);

export default router;
