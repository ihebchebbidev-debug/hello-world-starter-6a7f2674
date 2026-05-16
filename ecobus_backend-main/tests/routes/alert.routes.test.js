import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Mock the auth middleware so we don't need a JWT signing flow.
jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'u1', organizationId: 'org1', roles: ['admin'] };
    next();
  },
  requireRole: () => (_req, _res, next) => next(),
  optionalAuth: (_req, _res, next) => next(),
  signToken: () => 't',
}));

// Capture what the service receives so we can assert severity normalisation.
const createMock = jest.fn(async (_org, body) => ({ id: 'a1', ...body }));
jest.unstable_mockModule('../../src/services/alertService.js', () => ({
  list: jest.fn(async () => []),
  create: createMock,
  getById: jest.fn(async () => ({ id: 'a1' })),
  acknowledge: jest.fn(async () => ({ id: 'a1' })),
  resolve: jest.fn(async () => ({ id: 'a1' })),
  remove: jest.fn(async () => ({ success: true })),
}));

jest.unstable_mockModule('../../src/sockets/io.js', () => ({ getIO: () => null }));

const { default: alertRoutes } = await import('../../src/routes/alert.routes.js');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/alerts', alertRoutes);
  // Minimal error handler so Zod errors come back as 400.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.issues) return res.status(400).json({ error: 'Validation failed', issues: err.issues });
    res.status(err.status || 500).json({ error: err.message });
  });
  return app;
};

describe('POST /alerts severity normalisation', () => {
  beforeEach(() => createMock.mockClear());

  test('low → info', async () => {
    const res = await request(buildApp()).post('/alerts').send({ type: 'info', severity: 'low' });
    expect(res.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith('org1', expect.objectContaining({ severity: 'info' }));
  });

  test('medium → warning', async () => {
    await request(buildApp()).post('/alerts').send({ type: 'x', severity: 'medium' });
    expect(createMock).toHaveBeenCalledWith('org1', expect.objectContaining({ severity: 'warning' }));
  });

  test('high → critical', async () => {
    await request(buildApp()).post('/alerts').send({ type: 'x', severity: 'high' });
    expect(createMock).toHaveBeenCalledWith('org1', expect.objectContaining({ severity: 'critical' }));
  });

  test('canonical values pass through unchanged', async () => {
    await request(buildApp()).post('/alerts').send({ type: 'x', severity: 'critical' });
    expect(createMock).toHaveBeenCalledWith('org1', expect.objectContaining({ severity: 'critical' }));
  });

  test('unknown severity rejected', async () => {
    const res = await request(buildApp()).post('/alerts').send({ type: 'x', severity: 'panic' });
    expect(res.status).toBe(400);
  });

  test('missing type rejected', async () => {
    const res = await request(buildApp()).post('/alerts').send({});
    expect(res.status).toBe(400);
  });
});