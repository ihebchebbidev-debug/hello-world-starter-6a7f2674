import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorHandler, notFound } from '../../src/middleware/errorHandler.js';
import { ApiError } from '../../src/utils/ApiError.js';

const buildApp = (configure) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.id = 'req-err'; next(); });
  configure(app);
  app.use(notFound);
  app.use(errorHandler);
  return app;
};

describe('notFound + errorHandler', () => {
  test('unknown route returns 404 with route info', async () => {
    const app = buildApp(() => {});
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({
      error: 'Route not found',
      path: '/nope',
      requestId: 'req-err',
    }));
  });

  test('ApiError is converted to its declared status', async () => {
    const app = buildApp((a) =>
      a.get('/x', (_req, _res, next) => next(ApiError.conflict('dup'))));
    const res = await request(app).get('/x');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('dup');
    expect(res.body.requestId).toBe('req-err');
  });

  test('ApiError details propagate', async () => {
    const app = buildApp((a) =>
      a.get('/x', (_req, _res, next) =>
        next(ApiError.badRequest('Bad', { field: 'name' }))));
    const res = await request(app).get('/x');
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual({ field: 'name' });
  });

  test('ZodError becomes 400 with issues array', async () => {
    const schema = z.object({ name: z.string() });
    const app = buildApp((a) =>
      a.post('/x', (req, _res, next) => {
        try { schema.parse(req.body); } catch (err) { next(err); }
      }));
    const res = await request(app).post('/x').send({ name: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(res.body.issues[0]).toEqual(expect.objectContaining({
      path: expect.any(Array),
      message: expect.any(String),
    }));
  });

  test('unknown error → 500 with safe envelope', async () => {
    const app = buildApp((a) =>
      a.get('/x', (_req, _res, next) => next(new Error('unexpected'))));
    const res = await request(app).get('/x');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.requestId).toBe('req-err');
  });
});