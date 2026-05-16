/**
 * Smoke tests for the route aliases added to fix the /tests dashboard:
 *   - POST /tracking/location  (alias of POST /tracking)
 *   - POST /devices            (alias of POST /devices/token)
 *   - GET  /organizations/me   (resolves caller's org)
 *   - POST /child-routes       (now allows assignment without stops)
 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const UUID = '7f1c0e9a-2b3d-4e5f-90ab-1c2d3e4f5a6b';

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'u1', organizationId: UUID, roles: ['admin', 'super_admin'] };
    next();
  },
  requireRole: () => (_req, _res, next) => next(),
  optionalAuth: (_req, _res, next) => next(),
  signToken: () => 't',
}));

// GPS — no rate limit during unit tests; ingest returns a stub live row.
jest.unstable_mockModule('../../src/middleware/gpsRateLimit.js', () => ({
  gpsRateLimiter: (_req, _res, next) => next(),
}));
jest.unstable_mockModule('../../src/services/gpsService.js', () => ({
  ingest: jest.fn(async () => ({ live: { ok: true }, arrivals: [], tripId: null, routeId: null })),
  history: jest.fn(async () => []),
  live: jest.fn(async () => ({})),
  liveAll: jest.fn(async () => []),
}));
jest.unstable_mockModule('../../src/services/notificationService.js', () => ({
  createMany: jest.fn(async () => []),
}));
jest.unstable_mockModule('../../src/services/fcmService.js', () => ({
  sendToUsers: jest.fn(async () => ({})),
}));
jest.unstable_mockModule('../../src/sockets/io.js', () => ({ getIO: () => null }));
jest.unstable_mockModule('../../src/config/db.js', () => ({
  query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
  withTransaction: jest.fn(async (fn) => fn({ query: async () => ({ rows: [], rowCount: 0 }) })),
}));

// Devices
const registerTokenMock = jest.fn(async (uid, body) => ({ id: 'd1', userId: uid, ...body }));
jest.unstable_mockModule('../../src/services/deviceService.js', () => ({
  registerToken: registerTokenMock,
  revokeToken: jest.fn(async () => ({ success: true })),
  listForUser: jest.fn(async () => []),
}));

// Organizations
const orgGetByIdMock = jest.fn(async (id) => ({ id, name: 'My Org' }));
jest.unstable_mockModule('../../src/services/organizationService.js', () => ({
  list: jest.fn(async () => []),
  create: jest.fn(async () => ({ id: UUID })),
  getById: orgGetByIdMock,
  update: jest.fn(async () => ({ id: UUID })),
  remove: jest.fn(async () => ({ success: true })),
}));

// children service used by /child-routes
const assignRouteMock = jest.fn(async (_org, childId, body) => ({ id: 'cr1', childId, ...body }));
jest.unstable_mockModule('../../src/services/childrenService.js', () => ({
  assignRoute: assignRouteMock,
  unassignRoute: jest.fn(async () => ({ success: true })),
  list: jest.fn(async () => []),
  create: jest.fn(async () => ({ id: 'c1' })),
  getById: jest.fn(async () => ({ id: 'c1' })),
  update: jest.fn(async () => ({ id: 'c1' })),
  remove: jest.fn(async () => ({ success: true })),
}));

const { default: gpsRoutes } = await import('../../src/routes/gps.routes.js');
const { default: deviceRoutes } = await import('../../src/routes/device.routes.js');
const { default: orgRoutes } = await import('../../src/routes/organization.routes.js');
const { default: childRouteRoutes } = await import('../../src/routes/childRoute.routes.js');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/tracking', gpsRoutes);
  app.use('/gps', gpsRoutes);
  app.use('/devices', deviceRoutes);
  app.use('/organizations', orgRoutes);
  app.use('/child-routes', childRouteRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.issues) return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
};

describe('Route aliases', () => {
  test('POST /tracking/location accepts a valid GPS ping', async () => {
    const res = await request(buildApp())
      .post('/tracking/location')
      .send({ busId: UUID, latitude: 36.8, longitude: 10.1 });
    expect(res.status).toBe(202);
  });

  test('POST /tracking/location with missing busId → 400', async () => {
    const res = await request(buildApp())
      .post('/tracking/location')
      .send({ latitude: 36.8, longitude: 10.1 });
    expect(res.status).toBe(400);
  });

  test('POST /tracking still works (unaliased)', async () => {
    const res = await request(buildApp())
      .post('/tracking')
      .send({ busId: UUID, latitude: 36.8, longitude: 10.1 });
    expect(res.status).toBe(202);
  });

  test('POST /devices forwards to registerToken', async () => {
    registerTokenMock.mockClear();
    const res = await request(buildApp())
      .post('/devices')
      .send({ token: 'x'.repeat(20), platform: 'android' });
    expect(res.status).toBe(201);
    expect(registerTokenMock).toHaveBeenCalledWith('u1', expect.objectContaining({ platform: 'android' }));
  });

  test('POST /devices/token still works', async () => {
    const res = await request(buildApp())
      .post('/devices/token')
      .send({ token: 'x'.repeat(20), platform: 'ios' });
    expect(res.status).toBe(201);
  });

  test('GET /organizations/me returns caller org', async () => {
    orgGetByIdMock.mockClear();
    const res = await request(buildApp()).get('/organizations/me');
    expect(res.status).toBe(200);
    expect(orgGetByIdMock).toHaveBeenCalledWith(UUID);
    expect(res.body).toEqual(expect.objectContaining({ id: UUID }));
  });

  test('POST /child-routes accepts assignment without stops', async () => {
    assignRouteMock.mockClear();
    const res = await request(buildApp())
      .post('/child-routes')
      .send({ childId: UUID, routeId: UUID });
    expect(res.status).toBe(201);
    expect(assignRouteMock).toHaveBeenCalledWith(
      UUID,
      UUID,
      expect.objectContaining({ routeId: UUID }),
    );
  });
});