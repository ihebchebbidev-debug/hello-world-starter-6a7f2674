import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Auth is now fully stateless — roles travel inside the JWT — so no DB
// mock is needed. We still mock the module because the env loader is
// imported through the same chain in some tests.
jest.unstable_mockModule('../../src/config/db.js', () => ({
  query: jest.fn(),
}));

const { requireAuth, requireRole, optionalAuth, signToken } =
  await import('../../src/middleware/auth.js');
const { env } = await import('../../src/config/env.js');

const runMw = (mw, req) => new Promise((resolve) => {
  mw(req, {}, (err) => resolve({ err, req }));
});

describe('signToken', () => {
  test('produces a verifiable JWT with the given claims', () => {
    const token = signToken({ sub: 'u1', org: 'o1', email: 'a@b.co' });
    const decoded = jwt.verify(token, env.jwtSecret);
    expect(decoded.sub).toBe('u1');
    expect(decoded.org).toBe('o1');
    expect(decoded.email).toBe('a@b.co');
  });
});

describe('requireAuth', () => {
  test('rejects when Authorization header is missing', async () => {
    const { err } = await runMw(requireAuth, { headers: {} });
    expect(err).toBeDefined();
    expect(err.status).toBe(401);
  });

  test('rejects when token is malformed', async () => {
    const { err } = await runMw(requireAuth, {
      headers: { authorization: 'Bearer not.a.jwt' },
    });
    expect(err.status).toBe(401);
    expect(err.message).toMatch(/invalid|expired/i);
  });

  test('attaches req.user with roles read from the JWT (no DB lookup)', async () => {
    const token = signToken({
      sub: 'u1', org: 'o1', email: 'a@b.co', roles: ['admin', 'driver'],
    });
    const { err, req } = await runMw(requireAuth, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(err).toBeUndefined();
    expect(req.user).toEqual({
      id: 'u1',
      organizationId: 'o1',
      email: 'a@b.co',
      roles: ['admin', 'driver'],
    });
  });

  test('roles default to empty array when JWT has none', async () => {
    const token = signToken({ sub: 'u1', org: 'o1', email: 'a@b.co' });
    const { req } = await runMw(requireAuth, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(req.user.roles).toEqual([]);
  });

  test('expired token → 401', async () => {
    const token = jwt.sign({ sub: 'u1' }, env.jwtSecret, { expiresIn: -1 });
    const { err } = await runMw(requireAuth, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(err.status).toBe(401);
  });
});

describe('optionalAuth', () => {
  test('passes through with no user when header is missing', async () => {
    const { err, req } = await runMw(optionalAuth, { headers: {} });
    expect(err).toBeUndefined();
    expect(req.user).toBeUndefined();
  });

  test('attaches user when token valid (roles from JWT, no DB lookup)', async () => {
    const token = signToken({
      sub: 'u9', org: 'o9', email: 'x@y.z', roles: ['parent'],
    });
    const { req } = await runMw(optionalAuth, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(req.user).toEqual({
      id: 'u9', organizationId: 'o9', email: 'x@y.z', roles: ['parent'],
    });
  });

  test('swallows invalid token silently', async () => {
    const { err, req } = await runMw(optionalAuth, {
      headers: { authorization: 'Bearer junk' },
    });
    expect(err).toBeUndefined();
    expect(req.user).toBeUndefined();
  });
});

describe('requireRole', () => {
  test('401 when no req.user', async () => {
    const { err } = await runMw(requireRole('admin'), {});
    expect(err.status).toBe(401);
  });

  test('403 when user lacks the role', async () => {
    const { err } = await runMw(requireRole('super_admin'), {
      user: { id: 'u1', roles: ['driver'] },
    });
    expect(err.status).toBe(403);
  });

  test('passes when user has at least one allowed role', async () => {
    const { err } = await runMw(requireRole('admin', 'super_admin'), {
      user: { id: 'u1', roles: ['driver', 'admin'] },
    });
    expect(err).toBeUndefined();
  });

  test('403 when req.user has no roles array (stateless — never falls back to DB)', async () => {
    const { err } = await runMw(requireRole('admin'), { user: { id: 'u1' } });
    expect(err.status).toBe(403);
  });
});