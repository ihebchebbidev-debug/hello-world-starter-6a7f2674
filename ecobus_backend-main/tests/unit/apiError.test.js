import { ApiError } from '../../src/utils/ApiError.js';

describe('ApiError factory helpers', () => {
  test('badRequest defaults to 400 + message', () => {
    const e = ApiError.badRequest();
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(400);
    expect(e.message).toBe('Bad Request');
  });

  test.each([
    ['unauthorized', 401, 'Unauthorized'],
    ['forbidden',    403, 'Forbidden'],
    ['notFound',     404, 'Not Found'],
    ['conflict',     409, 'Conflict'],
    ['internal',     500, 'Internal Server Error'],
  ])('%s → %i', (fn, status, msg) => {
    const e = ApiError[fn]();
    expect(e.status).toBe(status);
    expect(e.message).toBe(msg);
  });

  test('custom message + details propagate', () => {
    const e = ApiError.badRequest('Bad', { field: 'name' });
    expect(e.message).toBe('Bad');
    expect(e.details).toEqual({ field: 'name' });
  });
});