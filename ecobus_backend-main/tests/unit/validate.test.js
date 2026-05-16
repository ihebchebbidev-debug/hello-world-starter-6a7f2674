import { z } from 'zod';
import { validate } from '../../src/middleware/validate.js';

const runMw = (mw, req) => new Promise((resolve) => {
  mw(req, {}, (err) => resolve({ err, req }));
});

describe('validate middleware', () => {
  const schema = z.object({ name: z.string().min(2), age: z.number().int().optional() });

  test('replaces req.body with parsed value', async () => {
    const req = { body: { name: 'Bob' } };
    const { err } = await runMw(validate(schema), req);
    expect(err).toBeUndefined();
    expect(req.body).toEqual({ name: 'Bob' });
  });

  test('forwards ZodError to next() on invalid body', async () => {
    const req = { body: { name: 'B' } };
    const { err } = await runMw(validate(schema), req);
    expect(err).toBeDefined();
    expect(err.name).toBe('ZodError');
  });

  test('can validate query / params via source arg', async () => {
    const req = { query: { name: 'Alice' } };
    const { err } = await runMw(validate(schema, 'query'), req);
    expect(err).toBeUndefined();
    expect(req.query).toEqual({ name: 'Alice' });
  });
});