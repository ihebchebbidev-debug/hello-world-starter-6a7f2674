import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const UUID = '7f1c0e9a-2b3d-4e5f-90ab-1c2d3e4f5a6b';

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'u1', organizationId: 'org1', roles: ['admin'] };
    next();
  },
  requireRole: () => (_req, _res, next) => next(),
  optionalAuth: (_req, _res, next) => next(),
  signToken: () => 't',
}));

const createMock = jest.fn(async (_org, body) => ({ id: 'b1', ...body }));
const updateMock = jest.fn(async (_org, id, body) => ({ id, ...body }));
const removeMock = jest.fn(async () => ({ success: true }));
jest.unstable_mockModule('../../src/services/busService.js', () => ({
  list: jest.fn(async () => []),
  create: createMock,
  getById: jest.fn(async (_org, id) => ({ id, name: 'B' })),
  update: updateMock,
  remove: removeMock,
  countActive: jest.fn(async () => 0),
}));

const { default: busRoutes } = await import('../../src/routes/bus.routes.js');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/buses', busRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.issues) return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
};

describe('Bus routes — validation', () => {
  beforeEach(() => { createMock.mockClear(); updateMock.mockClear(); removeMock.mockClear(); });

  test('POST /buses with valid body → 201', async () => {
    const res = await request(buildApp())
      .post('/buses')
      .send({ name: 'B1', plateNumber: 'P-1', capacity: 30 });
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalled();
  });

  test('POST /buses missing required fields → 400', async () => {
    const res = await request(buildApp()).post('/buses').send({ name: 'B1' });
    expect(res.status).toBe(400);
  });

  test('POST /buses invalid status enum → 400', async () => {
    const res = await request(buildApp())
      .post('/buses')
      .send({ name: 'B', plateNumber: 'P', capacity: 10, status: 'broken' });
    expect(res.status).toBe(400);
  });

  test('POST /buses capacity bounds enforced', async () => {
    const r1 = await request(buildApp())
      .post('/buses')
      .send({ name: 'B', plateNumber: 'P', capacity: 0 });
    expect(r1.status).toBe(400);

    const r2 = await request(buildApp())
      .post('/buses')
      .send({ name: 'B', plateNumber: 'P', capacity: 999 });
    expect(r2.status).toBe(400);
  });

  test('GET /buses/:id with non-uuid id → 400', async () => {
    const res = await request(buildApp()).get('/buses/not-a-uuid');
    expect(res.status).toBe(400);
  });

  test('GET /buses/:id with uuid → 200', async () => {
    const res = await request(buildApp()).get(`/buses/${UUID}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ id: UUID }));
  });

  test('PATCH /buses/:id requires at least one field', async () => {
    const res = await request(buildApp()).patch(`/buses/${UUID}`).send({});
    expect(res.status).toBe(400);
  });

  test('PATCH /buses/:id forwards partial update', async () => {
    const res = await request(buildApp())
      .patch(`/buses/${UUID}`)
      .send({ capacity: 42 });
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith('org1', UUID, expect.objectContaining({ capacity: 42 }));
  });

  test('DELETE /buses/:id calls service', async () => {
    const res = await request(buildApp()).delete(`/buses/${UUID}`);
    expect(res.status).toBe(200);
    expect(removeMock).toHaveBeenCalledWith('org1', UUID);
  });

  test('GET /buses with bad status filter → 400', async () => {
    const res = await request(buildApp()).get('/buses').query({ status: 'wat' });
    expect(res.status).toBe(400);
  });

  test('GET /buses with limit > max → 400', async () => {
    const res = await request(buildApp()).get('/buses').query({ limit: 9999 });
    expect(res.status).toBe(400);
  });
});