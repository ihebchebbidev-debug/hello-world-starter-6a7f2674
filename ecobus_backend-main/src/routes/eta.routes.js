import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { etaParamsSchema } from '../validators/schemas.js';
import { ApiError } from '../utils/ApiError.js';
import { query } from '../config/db.js';
import * as svc from '../services/etaService.js';

const router = Router();
router.use(requireAuth);

/**
 * Parents may only request ETA for their own children. Managers/admins/drivers
 * within the same organization may request ETA for any child in the org.
 */
const ensureChildAccess = async (req) => {
  const { rows } = await query(
    `SELECT parent_id, organization_id FROM children
     WHERE id = $1 AND deleted_at IS NULL`,
    [req.params.childId],
  );
  const child = rows[0];
  if (!child) throw ApiError.notFound('Child not found');
  if (child.organization_id !== req.user.organizationId
      && !(req.user.roles || []).includes('super_admin')) {
    throw ApiError.forbidden('Cross-organization access denied');
  }
  const isParent = (req.user.roles || []).includes('parent');
  if (isParent && child.parent_id !== req.user.id) {
    throw ApiError.forbidden('Parents may only access their own children');
  }
};

/**
 * @openapi
 * /eta/child/{childId}:
 *   get:
 *     tags: [ETA]
 *     summary: Estimate when a child's bus will reach their stop
 *     parameters:
 *       - in: path
 *         name: childId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: OK }
 *       403: { description: Cross-tenant or non-parent access denied }
 *       404: { description: Child not found / no route assigned }
 */
router.get(
  '/child/:childId',
  validate(etaParamsSchema, 'params'),
  asyncHandler(async (req, res) => {
    await ensureChildAccess(req);
    res.json(await svc.etaForChild(req.user.organizationId, req.params.childId));
  }),
);

export default router;
