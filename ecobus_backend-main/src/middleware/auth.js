import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const signToken = (payload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

/**
 * Authentication is fully stateless: the JWT carries the user's roles, so
 * verifying a request never touches the database. This is the difference
 * between handling 50 buses and handling 5000.
 *
 * Roles are refreshed every time a new access token is issued (login, refresh,
 * register), which gives at most `JWT_EXPIRES_IN` of staleness for role
 * changes — acceptable for a school-bus product. If you need instant
 * revocation, force a refresh-token rotation when an admin changes roles.
 */
/**
 * Normalize roles: `admin` is treated as a full super_admin across the
 * entire backend. Anywhere a guard checks for `super_admin`, an `admin`
 * token will also pass.
 */
const normalizeRoles = (roles) => {
  const list = Array.isArray(roles) ? [...roles] : [];
  if (list.includes('admin') && !list.includes('super_admin')) {
    list.push('super_admin');
  }
  return list;
};

export const requireAuth = (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized('Missing token');

    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = {
      id: decoded.sub,
      organizationId: decoded.org,
      email: decoded.email,
      roles: normalizeRoles(decoded.roles),
    };
    next();
  } catch (err) {
    next(err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError'
      ? ApiError.unauthorized('Invalid or expired token')
      : err);
  }
};

/**
 * Authenticate if a Bearer token is present, but never reject. Useful for
 * endpoints that accept anonymous traffic but want to attribute logged-in
 * users when possible (e.g. analytics).
 */
export const optionalAuth = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    req.user = {
      id: decoded.sub,
      organizationId: decoded.org,
      email: decoded.email,
      roles: normalizeRoles(decoded.roles),
    };
  } catch {
    /* swallow — anonymous fallback */
  }
  next();
};

export const requireRole = (...allowed) => (req, _res, next) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    const roles = req.user.roles || [];
    if (!roles.some((r) => allowed.includes(r))) {
      throw ApiError.forbidden('Insufficient role');
    }
    next();
  } catch (err) {
    next(err);
  }
};
