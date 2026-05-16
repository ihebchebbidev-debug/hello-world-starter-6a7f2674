import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';
import {
  organizationSchema,
  updateOrganizationSchema,
} from '../validators/schemas.js';
import * as svc from '../services/organizationService.js';

const router = Router();
router.use(requireAuth);

const idParam = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  search: z.string().min(1).max(100).optional(),
  status: z.string().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const ensureSelfOrSuperAdmin = (req) => {
  const roles = req.user.roles || [];
  const isSuper = roles.includes('super_admin') || roles.includes('admin');
  if (!isSuper && req.params.id !== req.user.organizationId) {
    throw ApiError.forbidden('Cannot access other organizations');
  }
};

/**
 * @openapi
 * /organizations:
 *   get:
 *     tags: [Organizations]
 *     summary: List organizations (super_admin only)
 *     responses:
 *       200: { description: OK }
 *   post:
 *     tags: [Organizations]
 *     summary: Create an organization (super_admin only)
 *     responses:
 *       201: { description: Created }
 */
router.get(
  '/',
  requireRole('super_admin', 'admin'),
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => res.json(await svc.list(req.query))),
);

router.post(
  '/',
  requireRole('super_admin', 'admin'),
  validate(organizationSchema),
  asyncHandler(async (req, res) => res.status(201).json(await svc.create(req.body))),
);

/**
 * @openapi
 * /organizations/me:
 *   get:
 *     tags: [Organizations]
 *     summary: Get the current user's organization
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user.organizationId) throw ApiError.notFound('User has no organization');
    res.json(await svc.getById(req.user.organizationId));
  }),
);

/**
 * @openapi
 * /organizations/{id}:
 *   get:
 *     tags: [Organizations]
 *     summary: Get an organization (own org for non-super_admin)
 *     responses:
 *       200: { description: OK }
 *   patch:
 *     tags: [Organizations]
 *     summary: Update an organization
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [Organizations]
 *     summary: Soft-delete an organization (super_admin only)
 *     responses:
 *       200: { description: OK }
 */
router.get(
  '/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    ensureSelfOrSuperAdmin(req);
    res.json(await svc.getById(req.params.id));
  }),
);

router.patch(
  '/:id',
  requireRole('admin', 'super_admin'),
  validate(idParam, 'params'),
  validate(updateOrganizationSchema),
  asyncHandler(async (req, res) => {
    ensureSelfOrSuperAdmin(req);
    res.json(await svc.update(req.params.id, req.body));
  }),
);

router.delete(
  '/:id',
  requireRole('super_admin', 'admin'),
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => res.json(await svc.remove(req.params.id))),
);

export default router;
