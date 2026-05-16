/**
 * Integration test: mount the full router from src/routes/index.js with all
 * services + auth mocked. Catches missing route registrations + path drift.
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

jest.unstable_mockModule('../../src/middleware/gpsRateLimit.js', () => ({
  gpsRateLimiter: (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../src/sockets/io.js', () => ({ getIO: () => null }));

jest.unstable_mockModule('../../src/config/db.js', () => ({
  query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
  withTransaction: jest.fn(async (fn) => fn({ query: async () => ({ rows: [], rowCount: 0 }) })),
  pool: { end: jest.fn() },
}));

// Stub every service the router pulls in. Keeps each call to a 200/201
// response so we can assert routing only.
const ok = (extra = {}) => async (..._args) => ({ id: 'x1', ...extra });
const okList = async () => [];

jest.unstable_mockModule('../../src/services/gpsService.js', () => ({
  ingest: jest.fn(async () => ({ live: { ok: true }, arrivals: [], tripId: null, routeId: null })),
  history: okList, live: ok(), liveAll: okList,
}));
jest.unstable_mockModule('../../src/services/notificationService.js', () => ({
  createMany: jest.fn(async () => []), list: okList, markAllRead: jest.fn(async () => ({ updated: 0 })),
}));
jest.unstable_mockModule('../../src/services/fcmService.js', () => ({
  sendToUsers: jest.fn(async () => ({})),
}));
jest.unstable_mockModule('../../src/services/deviceService.js', () => ({
  registerToken: ok(), revokeToken: ok({ success: true }), listForUser: okList,
}));
jest.unstable_mockModule('../../src/services/organizationService.js', () => ({
  list: okList, create: ok({ id: UUID }), getById: ok({ id: UUID, name: 'My Org' }),
  update: ok(), remove: ok({ success: true }),
}));
jest.unstable_mockModule('../../src/services/childrenService.js', () => ({
  assignRoute: ok(), unassignRoute: ok({ success: true }),
  list: okList, create: ok(), getById: ok(), update: ok(), remove: ok({ success: true }),
}));
jest.unstable_mockModule('../../src/services/busService.js', () => ({
  list: okList, create: ok(), getById: ok(), update: ok(), remove: ok({ success: true }), countActive: jest.fn(async () => 0),
}));
jest.unstable_mockModule('../../src/services/alertService.js', () => ({
  list: okList, create: ok(), getById: ok(), acknowledge: ok(), resolve: ok(), remove: ok({ success: true }),
}));
jest.unstable_mockModule('../../src/services/geofenceService.js', () => ({
  list: okList, create: ok(), getById: ok(), update: ok(), remove: ok({ success: true }),
}));
jest.unstable_mockModule('../../src/services/sosService.js', () => ({
  trigger: jest.fn(async (_u, body) => ({
    alert: { id: 'sos1', ...body }, audience: [], context: { busId: null, tripId: null },
  })),
  list: okList, acknowledge: ok(), resolve: ok(),
}));

const { default: routes } = await import('../../src/routes/index.js');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(routes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.issues) return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
};

describe('Full router registration', () => {
  // Each tuple: [method, path, body?, expected status]
  const cases = [
    ['post', '/tracking/location', { busId: UUID, latitude: 1, longitude: 2 }, 202],
    ['post', '/tracking',          { busId: UUID, latitude: 1, longitude: 2 }, 202],
    ['post', '/gps/location',      { busId: UUID, latitude: 1, longitude: 2 }, 202],
    ['post', '/devices',           { token: 'x'.repeat(20), platform: 'ios' }, 201],
    ['post', '/devices/token',     { token: 'x'.repeat(20), platform: 'web' }, 201],
    ['get',  '/organizations/me',  null,                                        200],
    ['post', '/child-routes',      { childId: UUID, routeId: UUID },            201],
    ['post', '/alerts',            { type: 'info', severity: 'low' },           201],
    ['post', '/geofences',         { name: 'g', centerLat: 1, centerLng: 2, radius: 50 }, 201],
    ['post', '/sos',               {},                                          201],
  ];

  test.each(cases)('%s %s → %i', async (method, path, body, expected) => {
    const req = request(buildApp())[method](path);
    const res = await (body ? req.send(body) : req.send());
    expect(res.status).toBe(expected);
  });
});