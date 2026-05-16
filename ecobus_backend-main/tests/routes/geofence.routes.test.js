import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'u1', organizationId: 'org1', roles: ['admin'] };
    next();
  },
  requireRole: () => (_req, _res, next) => next(),
  optionalAuth: (_req, _res, next) => next(),
  signToken: () => 't',
}));

const createMock = jest.fn(async (_org, body) => ({ id: 'g1', ...body }));
jest.unstable_mockModule('../../src/services/geofenceService.js', () => ({
  list: jest.fn(async () => []),
  create: createMock,
  getById: jest.fn(async () => ({ id: 'g1' })),
  update: jest.fn(async () => ({ id: 'g1' })),
  remove: jest.fn(async () => ({ success: true })),
}));

const { default: geofenceRoutes } = await import('../../src/routes/geofence.routes.js');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/geofences', geofenceRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.issues) return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
};

describe('POST /geofences accepts both field-name conventions', () => {
  beforeEach(() => createMock.mockClear());

  test('canonical latitude/longitude', async () => {
    const res = await request(buildApp())
      .post('/geofences')
      .send({ name: 'g', latitude: 36.8, longitude: 10.1, radius: 100 });
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      'org1',
      expect.objectContaining({ latitude: 36.8, longitude: 10.1, radius: 100 }),
    );
  });

  test('mobile shorthand centerLat/centerLng + type', async () => {
    const res = await request(buildApp())
      .post('/geofences')
      .send({ name: 'g', type: 'circle', centerLat: 36.8, centerLng: 10.1, radius: 200 });
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      'org1',
      expect.objectContaining({ latitude: 36.8, longitude: 10.1, radius: 200 }),
    );
  });

  test('snake_case center_lat/center_lng accepted', async () => {
    const res = await request(buildApp())
      .post('/geofences')
      .send({ name: 'g', center_lat: 1, center_lng: 2, radius: 50 });
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      'org1',
      expect.objectContaining({ latitude: 1, longitude: 2 }),
    );
  });

  test('missing coordinates rejected', async () => {
    const res = await request(buildApp()).post('/geofences').send({ name: 'g', radius: 100 });
    expect(res.status).toBe(400);
  });

  test('out-of-range latitude rejected', async () => {
    const res = await request(buildApp())
      .post('/geofences')
      .send({ name: 'g', latitude: 200, longitude: 0, radius: 100 });
    expect(res.status).toBe(400);
  });
});