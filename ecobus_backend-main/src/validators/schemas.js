import { z } from 'zod';

export const registerSchema = z.object({
  organizationName: z.string().min(2).max(255),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().min(4).max(50).optional(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerParentSchema = z.object({
  organizationId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().min(4).max(50).optional(),
  password: z.string().min(8).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(256),
});

export const organizationSchema = z.object({
  name: z.string().min(2).max(255),
  contactEmail: z.string().email().max(255).optional(),
  phone: z.string().min(4).max(50).optional(),
  address: z.string().max(500).optional(),
  subscriptionPlan: z.enum(['starter', 'pro', 'enterprise']).optional(),
});

export const updateOrganizationSchema = organizationSchema.partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const deviceTokenSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(['ios', 'android', 'web']),
});

export const analyticsSessionSchema = z.object({
  deviceType: z.string().max(50).optional(),
  platform: z.string().max(50).optional(),
});

export const etaParamsSchema = z.object({
  childId: z.string().uuid(),
});

export const ROLE_NAMES = z.enum(['super_admin', 'admin', 'school_manager', 'driver', 'parent']);

export const createUserSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().min(4).max(50).optional(),
  password: z.string().min(8).max(128),
  roles: z.array(ROLE_NAMES).min(1),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().min(4).max(50).optional(),
  isActive: z.boolean().optional(),
  roles: z.array(ROLE_NAMES).min(1).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().min(4).max(50).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

export const BUS_STATUS = z.enum(['active', 'inactive', 'maintenance']);

export const busSchema = z.object({
  name: z.string().min(1).max(100),
  plateNumber: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(200),
  status: BUS_STATUS.optional(),
});

export const updateBusSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  plateNumber: z.string().min(1).max(50).optional(),
  capacity: z.number().int().min(1).max(200).optional(),
  status: BUS_STATUS.optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const childSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  parentId: z.string().uuid().optional(),
});

export const updateChildSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  parentId: z.string().uuid().nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const childRouteSchema = z.object({
  routeId: z.string().uuid(),
  pickupStopId: z.string().uuid().optional(),
  dropoffStopId: z.string().uuid().optional(),
});

export const assignmentSchema = z.object({
  routeId: z.string().uuid(),
  busId: z.string().uuid(),
  driverId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isActive: z.boolean().optional(),
});

export const updateAssignmentSchema = z.object({
  busId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isActive: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const routeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
});

export const stopSchema = z.object({
  name: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  stopOrder: z.number().int().min(0),
  plannedTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
});

export const tripSchema = z.object({
  routeId: z.string().uuid(),
  assignmentId: z.string().uuid().optional(),
});

export const gpsSchema = z.object({
  busId: z.string().uuid(),
  tripId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).max(300).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
  batteryLevel: z.number().int().min(0).max(100).optional(),
});

export const gpsHistoryQuerySchema = z.object({
  busId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
}).refine((v) => v.busId || v.tripId, {
  message: 'busId or tripId is required',
  path: ['busId'],
});

export const checkinSchema = z.object({
  tripId: z.string().uuid(),
  childId: z.string().uuid(),
  status: z.enum(['boarded', 'left', 'absent']),
  method: z.enum(['manual', 'qr', 'nfc']).default('manual'),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

export const sosSchema = z.object({
  tripId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  message: z.string().min(1).max(500).optional(),
  type: z.enum(['driver_emergency', 'parent_emergency', 'manager_emergency', 'other']).optional(),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

export const sosListQuerySchema = z.object({
  status: z.enum(['active', 'acknowledged', 'resolved']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const eventSchema = z.object({
  sessionId: z.string().uuid().optional(),
  eventType: z.string().min(1).max(100),
  metadata: z.record(z.string(), z.any()).optional(),
});
