import { jest } from '@jest/globals';
import { asyncHandler } from '../../src/utils/asyncHandler.js';

describe('asyncHandler', () => {
  test('forwards a resolved value without calling next', async () => {
    const next = jest.fn();
    const handler = asyncHandler(async (_req, res) => res.send('ok'));
    const res = { send: jest.fn() };
    await handler({}, res, next);
    expect(res.send).toHaveBeenCalledWith('ok');
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards a thrown async error to next()', async () => {
    const next = jest.fn();
    const boom = new Error('boom');
    const handler = asyncHandler(async () => { throw boom; });
    await handler({}, {}, next);
    expect(next).toHaveBeenCalledWith(boom);
  });

  test('a sync throw escapes (asyncHandler only catches async rejections)', () => {
    // Documents current behaviour: handlers should be async/return a promise.
    // A sync throw bypasses Promise.resolve(...).catch and surfaces directly.
    const handler = asyncHandler(() => { throw new Error('sync'); });
    expect(() => handler({}, {}, () => {})).toThrow('sync');
  });

  test('non-promise return value is fine', async () => {
    const next = jest.fn();
    const handler = asyncHandler(() => 'sync-value');
    await handler({}, {}, next);
    expect(next).not.toHaveBeenCalled();
  });
});