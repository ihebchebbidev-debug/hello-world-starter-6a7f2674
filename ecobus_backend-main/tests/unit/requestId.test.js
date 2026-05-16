import { jest } from '@jest/globals';
import { requestId, REQUEST_ID_HEADER } from '../../src/middleware/requestId.js';

const mockRes = () => {
  const headers = {};
  return {
    locals: {},
    setHeader: (k, v) => { headers[k] = v; },
    getHeader: (k) => headers[k],
    headers,
  };
};

describe('requestId middleware', () => {
  test('generates a UUID when no incoming header', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    requestId(req, res, next);
    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(res.locals.requestId).toBe(req.id);
    expect(res.getHeader(REQUEST_ID_HEADER)).toBe(req.id);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('honours a safe X-Request-Id header', () => {
    const req = { headers: { 'x-request-id': 'abc_DEF-123' } };
    const res = mockRes();
    requestId(req, res, () => {});
    expect(req.id).toBe('abc_DEF-123');
  });

  test('rejects unsafe header chars and falls back to UUID', () => {
    const req = { headers: { 'x-request-id': '<script>alert(1)</script>' } };
    const res = mockRes();
    requestId(req, res, () => {});
    expect(req.id).not.toBe('<script>alert(1)</script>');
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  test('rejects header longer than 128 chars', () => {
    const req = { headers: { 'x-request-id': 'a'.repeat(129) } };
    const res = mockRes();
    requestId(req, res, () => {});
    expect(req.id).not.toBe('a'.repeat(129));
  });
});