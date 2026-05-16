import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as svc from '../services/notificationService.js';

const router = Router();
router.use(requireAuth);

const idParam = z.object({ id: z.string().uuid() });

const broadcastSchema = z.object({
  title: z.string().min(1).max(160),
  message: z.string().min(1).max(2000),
  type: z.enum(['info', 'warning', 'alert', 'sos', 'success']).optional(),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  target: z.object({
    userIds: z.array(z.string().uuid()).max(5000).optional(),
    roles: z.array(z.enum(['super_admin', 'admin', 'school_manager', 'driver', 'parent'])).optional(),
    organizationId: z.string().uuid().optional(),
    all: z.boolean().optional(),
  }).refine(
    (t) => !!(t.userIds?.length || t.roles?.length || t.organizationId || t.all),
    { message: 'target must include userIds, roles, organizationId, or all=true' },
  ),
});

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List the current user's notifications (latest 100)
 */
router.get('/', asyncHandler(async (req, res) => res.json(await svc.listForUser(req.user.id))));

/**
 * @openapi
 * /notifications:
 *   post:
 *     tags: [Notifications]
 *     summary: Broadcast a notification (insert + realtime + FCM push)
 *     description: |
 *       Admins / school_managers may target users in their own organization.
 *       Only super_admin may use `target.all=true` or a different organizationId.
 */
router.post(
  '/',
  requireRole('super_admin', 'admin', 'school_manager'),
  validate(broadcastSchema),
  asyncHandler(async (req, res) => {
    const isSuper = (req.user.roles || []).includes('super_admin');
    const target = { ...req.body.target };

    // Tenant isolation: non-super admins can only broadcast within their own org
    if (!isSuper) {
      if (target.all) return res.status(403).json({ error: 'Only super_admin can broadcast to all' });
      if (target.organizationId && target.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: 'Cannot target another organization' });
      }
      if (!target.organizationId && !target.userIds?.length) {
        target.organizationId = req.user.organizationId;
      }
    }

    const result = await svc.broadcast({
      target,
      title: req.body.title,
      message: req.body.message,
      type: req.body.type,
      data: req.body.data,
      organizationId: target.organizationId || req.user.organizationId,
    });
    res.status(201).json(result);
  }),
);

/**
 * @openapi
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark every unread notification for the current user as read
 */
router.patch('/read-all', asyncHandler(async (req, res) =>
  res.json(await svc.markAllRead(req.user.id))));

/**
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a notification as read
 */
router.patch(
  '/:id/read',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    const updated = await svc.markRead(req.params.id, req.user.id);
    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    res.json(updated);
  }),
);

export default router;
