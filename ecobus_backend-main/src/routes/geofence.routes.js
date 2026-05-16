import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as svc from '../services/geofenceService.js';

const router = Router();
router.use(requireAuth);

// Accept both spec field names (latitude/longitude) and the alternative
// shorthand (centerLat/centerLng) the mobile clients send. Also accept a
// `type` discriminator (currently only `circle` is supported) — extra
// fields are ignored gracefully so the API stays forward-compatible.
const normalizeGeofence = (v) => ({
  name: v.name,
  latitude: v.latitude ?? v.centerLat ?? v.center_lat,
  longitude: v.longitude ?? v.centerLng ?? v.center_lng,
  radius: v.radius,
  type: v.type, // accepted but currently unused server-side
});

const geofenceSchema = z
  .object({
    name: z.string().min(1).max(100),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    centerLat: z.number().min(-90).max(90).optional(),
    centerLng: z.number().min(-180).max(180).optional(),
    center_lat: z.number().min(-90).max(90).optional(),
    center_lng: z.number().min(-180).max(180).optional(),
    radius: z.number().int().min(10).max(100000),
    type: z.enum(['circle']).optional(),
  })
  .transform(normalizeGeofence)
  .refine((v) => v.latitude !== undefined && v.longitude !== undefined, {
    message: 'latitude/longitude (or centerLat/centerLng) is required',
  });

const updateGeofenceSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    centerLat: z.number().min(-90).max(90).optional(),
    centerLng: z.number().min(-180).max(180).optional(),
    radius: z.number().int().min(10).max(100000).optional(),
  })
  .transform((v) => {
    const out = { ...v };
    if (out.centerLat !== undefined) { out.latitude = out.centerLat; delete out.centerLat; }
    if (out.centerLng !== undefined) { out.longitude = out.centerLng; delete out.centerLng; }
    return out;
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field required');

router.get('/', asyncHandler(async (req, res) =>
  res.json(await svc.list(req.user.organizationId))));

router.post('/', validate(geofenceSchema), asyncHandler(async (req, res) =>
  res.status(201).json(await svc.create(req.user.organizationId, req.body))));

router.get('/:id', asyncHandler(async (req, res) =>
  res.json(await svc.getById(req.user.organizationId, req.params.id))));

router.patch('/:id', validate(updateGeofenceSchema), asyncHandler(async (req, res) =>
  res.json(await svc.update(req.user.organizationId, req.params.id, req.body))));

router.delete('/:id', asyncHandler(async (req, res) =>
  res.json(await svc.remove(req.user.organizationId, req.params.id))));

export default router;
