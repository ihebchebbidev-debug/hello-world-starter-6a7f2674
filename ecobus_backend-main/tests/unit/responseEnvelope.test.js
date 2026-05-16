import express from 'express';
import request from 'supertest';
import { responseEnvelope } from '../../src/middleware/responseEnvelope.js';

const buildApp = (configure) => {
  const app = express();
  app.use((req, _res, next) => { req.id = 'req-123'; next(); });
  app.use(responseEnvelope);
  configure(app);
  return app;
};

describe('responseEnvelope middleware', () => {
  test('wraps a 2xx body in the success envelope', async () => {
    const app = buildApp((a) => a.get('/x', (_req, res) => res.json({ hello: 'world' })));
    const res = await request(app).get('/x');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { hello: 'world' },
      message: 'OK',
      error: null,
    });
  });

  test('wraps a 4xx body in the error envelope and copies issues/details', async () => {
    const app = buildApp((a) => a.get('/x', (_req, res) =>
      res.status(400).json({ error: 'Validation failed', issues: [{ path: ['x'], message: 'nope' }] })));
    const res = await request(app).get('/x');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.issues).toHaveLength(1);
    expect(res.body.requestId).toBe('req-123');
  });

  test('passes through bodies that already look like an envelope', async () => {
    const env = { success: true, data: { x: 1 }, message: 'pre-shaped', error: null };
    const app = buildApp((a) => a.get('/x', (_req, res) => res.json(env)));
    const res = await request(app).get('/x');
    expect(res.body).toEqual(env);
  });

  test('honours res.locals.skipEnvelope', async () => {
    const app = buildApp((a) => a.get('/x', (_req, res) => {
      res.locals.skipEnvelope = true;
      res.json({ raw: true });
    }));
    const res = await request(app).get('/x');
    expect(res.body).toEqual({ raw: true });
  });

  test('honours res.locals.message on success', async () => {
    const app = buildApp((a) => a.get('/x', (_req, res) => {
      res.locals.message = 'Created';
      res.status(201).json({ id: 1 });
    }));
    const res = await request(app).get('/x');
    expect(res.body.message).toBe('Created');
    expect(res.body.success).toBe(true);
  });

  test('falls back to default error message when no body provided', async () => {
    const app = buildApp((a) => a.get('/x', (_req, res) => res.status(404).json(null)));
    const res = await request(app).get('/x');
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Not Found');
  });
});