import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { isProd } from '../config/env.js';

export const notFound = (req, res, _next) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    requestId: req.id,
  });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const requestId = req.id;

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
      requestId,
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
      requestId,
    });
  }

  logger.error('Unhandled error', {
    requestId,
    method: req.method,
    path: req.originalUrl,
    err: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    requestId,
    ...(isProd ? {} : { message: err.message }),
  });
};
