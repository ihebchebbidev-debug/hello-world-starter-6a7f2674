/**
 * Response envelope middleware.
 *
 * Wraps all JSON responses in the canonical EcoBus shape:
 *   { success, data, message, error }
 *
 * - 2xx responses: { success: true, data, message, error: null }
 * - 4xx/5xx responses: { success: false, data: null, message, error }
 *
 * If a handler already returns the envelope shape (detected by the presence of
 * a top-level `success` boolean), the body is passed through untouched. This
 * keeps the middleware idempotent and lets specialised endpoints (health,
 * SSE log stream, swagger.json) opt out by either using `res.send` or by
 * pre-shaping the body.
 *
 * It also normalises the existing { error, requestId, issues, ... } error
 * payload produced by errorHandler.js into the envelope.
 */
const isEnvelope = (body) =>
  body && typeof body === 'object' && !Array.isArray(body) && typeof body.success === 'boolean';

export const responseEnvelope = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    // Allow opt-out for routes that explicitly set this flag (e.g. swagger.json)
    if (res.locals?.skipEnvelope) return originalJson(body);
    if (isEnvelope(body)) return originalJson(body);

    const status = res.statusCode || 200;
    const ok = status < 400;

    if (ok) {
      return originalJson({
        success: true,
        data: body ?? null,
        message: res.locals?.message || 'OK',
        error: null,
      });
    }

    // Error-shaped body produced by errorHandler.js or a handler that
    // returned a JSON error directly with res.status(4xx).json({...}).
    const error =
      (body && (body.error || body.message)) ||
      (status === 404 ? 'Not Found' : 'Request failed');

    return originalJson({
      success: false,
      data: null,
      message: error,
      error,
      ...(body && body.issues ? { issues: body.issues } : {}),
      ...(body && body.details ? { details: body.details } : {}),
      ...(body && body.requestId ? { requestId: body.requestId } : { requestId: req.id }),
    });
  };

  next();
};
