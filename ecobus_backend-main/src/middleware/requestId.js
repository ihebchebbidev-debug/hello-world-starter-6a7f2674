import { randomUUID } from 'node:crypto';

/**
 * Request correlation ID middleware.
 *
 * - Honors an inbound `X-Request-Id` header when it looks safe (<=128 chars,
 *   alphanumeric + `-_`), so callers / upstream proxies can propagate a trace.
 * - Otherwise generates a fresh UUID v4.
 * - Exposes the id as:
 *     req.id                       (for handlers and downstream middleware)
 *     res.locals.requestId         (for templates / serializers)
 *     response header `X-Request-Id`
 */
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
export const REQUEST_ID_HEADER = 'X-Request-Id';

export const requestId = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && SAFE_ID.test(incoming)
    ? incoming
    : randomUUID();

  req.id = id;
  res.locals.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
};
