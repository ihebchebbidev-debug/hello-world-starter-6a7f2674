import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const UUID = '7f1c0e9a-2b3d-4e5f-90ab-1c2d3e4f5a6b';

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'p1', organizationId: 'org1', roles: ['parent'] };
    next();
  },
  requireRole: () => (_req, _res, next) => next(),
  optionalAuth: (_req, _res, next) => next(),
  signToken: () => 't',
}));

const triggerMock = jest.fn(async (_user, body) => ({
  alert: { id: 'sos1', ...body, status: 'active' },
  audience: [],
  context: { busId: null, tripId: body.tripId || null },
}));
jest.unstable_mockModule('../../src/services/sosService.js', () => ({
  trigger: triggerMock,
  list: jest.fn(async () => []),
  listForOrg: jest.fn(async () => []),
  acknowledge: jest.fn(async () => ({ id: 'sos1', status: 'acknowledged' })),
  resolve: jest.fn(async () => ({ id: 'sos1', status: 'resolved' })),
}));
jest.unstable_mockModule('../../src/sockets/io.js', () => ({ getIO: () => null }));

const { default: sosRoutes } = await import('../../src/routes/sos.routes.js');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/sos', sosRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.issues) return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
};

describe('SOS routes', () => {
  beforeEach(() => triggerMock.mockClear());

  test('POST /sos with empty body succeeds (all fields optional)', async () => {
    const res = await request(buildApp()).post('/sos').send({});
    expect(res.status).toBe(201);
    expect(triggerMock).toHaveBeenCalled();
  });

  test('POST /sos with full payload', async () => {
    const res = await request(buildApp())
      .post('/sos')
      .send({ tripId: UUID, latitude: 36.8, longitude: 10.1, message: 'help' });
    expect(res.status).toBe(201);
    expect(triggerMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
      expect.objectContaining({ tripId: UUID, message: 'help' }),
    );
  });

  test('POST /sos rejects out-of-range latitude', async () => {
    const res = await request(buildApp())
      .post('/sos')
      .send({ latitude: 200, longitude: 0 });
    expect(res.status).toBe(400);
  });

  test('POST /sos rejects message > 500 chars', async () => {
    const res = await request(buildApp())
      .post('/sos')
      .send({ message: 'x'.repeat(501) });
    expect(res.status).toBe(400);
  });

  test('POST /sos rejects non-uuid tripId', async () => {
    const res = await request(buildApp())
      .post('/sos')
      .send({ tripId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  test('GET /sos accepts status filter', async () => {
    const res = await request(buildApp()).get('/sos').query({ status: 'active' });
    expect(res.status).toBe(200);
  });

  test('GET /sos rejects unknown status filter', async () => {
    const res = await request(buildApp()).get('/sos').query({ status: 'pending' });
    expect(res.status).toBe(400);
  });
});