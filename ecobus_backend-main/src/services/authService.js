import bcrypt from 'bcrypt';
import { withTransaction, query } from '../config/db.js';
import { env } from '../config/env.js';
import { signToken } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from './refreshTokenService.js';
import * as phoneOtp from './phoneOtpService.js';

/**
 * Load the user's role names. Called once per token issuance (login,
 * register, refresh) — NOT on every API request. Roles travel inside the
 * signed JWT thereafter, so the auth middleware is fully stateless.
 */
const loadRoleNames = async (userId) => {
  const { rows } = await query(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId],
  );
  return rows.map((r) => r.name);
};

const buildAuthPayload = async (user, organization, ctx = {}) => {
  const roles = await loadRoleNames(user.id);
  const accessToken = signToken({
    sub: user.id,
    org: user.organization_id || organization?.id,
    email: user.email,
    roles,
  });
  const { refreshToken, refreshExpiresAt } = await issueRefreshToken(user.id, ctx);
  return {
    accessToken,
    refreshToken,
    refreshExpiresAt,
    accessExpiresIn: env.jwtExpiresIn,
    user: { ...user, roles },
    ...(organization ? { organization } : {}),
  };
};

const ensureRole = async (client, name) => {
  const r = await client.query(
    `INSERT INTO roles (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name],
  );
  return r.rows[0].id;
};

/**
 * Register a new organization + initial admin user.
 * Used during first-time school onboarding.
 */
export const registerOrgAndAdmin = async (input, ctx) => {
  const { organizationName, firstName, lastName, email, phone, password } = input;

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) throw ApiError.conflict('Email already registered');

  const hash = await bcrypt.hash(password, env.bcryptRounds);

  const created = await withTransaction(async (client) => {
    const orgRes = await client.query(
      `INSERT INTO organizations (name, contact_email, phone, subscription_plan, subscription_status)
       VALUES ($1, $2, $3, 'starter', 'trial') RETURNING id, name`,
      [organizationName, email, phone || null],
    );
    const org = orgRes.rows[0];

    const userRes = await client.query(
      `INSERT INTO users (organization_id, first_name, last_name, email, phone, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, organization_id, email, first_name, last_name`,
      [org.id, firstName, lastName, email, phone || null, hash],
    );
    const user = userRes.rows[0];

    const adminRoleId = await ensureRole(client, 'admin');
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.id, adminRoleId],
    );

    return { user, organization: org };
  });

  return buildAuthPayload(created.user, created.organization, ctx);
};

/**
 * Self-registration for a parent. Requires an organizationId so the parent
 * is attached to the school they want to follow.
 */
export const registerParent = async (input, ctx) => {
  const { organizationId, firstName, lastName, email, phone, password } = input;

  const orgRow = await query(
    `SELECT id, name FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
    [organizationId],
  );
  if (!orgRow.rows[0]) throw ApiError.badRequest('Organization not found');

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) throw ApiError.conflict('Email already registered');

  const hash = await bcrypt.hash(password, env.bcryptRounds);

  const created = await withTransaction(async (client) => {
    const userRes = await client.query(
      `INSERT INTO users (organization_id, first_name, last_name, email, phone, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, organization_id, email, first_name, last_name`,
      [organizationId, firstName, lastName, email, phone || null, hash],
    );
    const user = userRes.rows[0];
    const parentRoleId = await ensureRole(client, 'parent');
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [user.id, parentRoleId],
    );
    return { user };
  });

  return buildAuthPayload(created.user, orgRow.rows[0], ctx);
};

export const login = async ({ email, password }, ctx) => {
  const { rows } = await query(
    `SELECT id, organization_id, email, first_name, last_name, password_hash, is_active
     FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email],
  );
  const user = rows[0];
  if (!user || !user.is_active) throw ApiError.unauthorized('Invalid credentials');

  const ok = await bcrypt.compare(password, user.password_hash || '');
  if (!ok) throw ApiError.unauthorized('Invalid credentials');

  delete user.password_hash;
  return buildAuthPayload(user, null, ctx);
};

/**
 * Phone-OTP login. Verifies the SMS code, then issues a full session for
 * the user whose `phone` matches (after digits-only normalization).
 *
 * No password is required — proof of phone ownership is sufficient. The
 * user must already exist (parents/drivers are provisioned by their school).
 */
export const loginWithPhone = async ({ phone, code }, ctx) => {
  // 1) Verify OTP. Throws on bad/expired/exhausted code; deletes row on success.
  const { phone: e164 } = await phoneOtp.verifyOtp(phone, code);

  // 2) Find the user by phone. Match on digits-only so stored values like
  //    "+216 98 123 456", "0021698123456" or "98123456" all resolve.
  const digits = e164.replace(/\D/g, '');
  const { rows } = await query(
    `SELECT id, organization_id, email, first_name, last_name, phone, is_active
       FROM users
      WHERE deleted_at IS NULL
        AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $1
      LIMIT 1`,
    [digits],
  );
  const user = rows[0];
  if (!user)            throw ApiError.unauthorized('No account for this phone');
  if (!user.is_active)  throw ApiError.unauthorized('Account is disabled');

  return buildAuthPayload(user, null, ctx);
};

/**
 * Exchange a refresh token for a new access token (with rotation).
 */
export const refresh = async (rawRefreshToken, ctx) => {
  const rotated = await rotateRefreshToken(rawRefreshToken, ctx);
  const { rows } = await query(
    `SELECT id, organization_id, email FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [rotated.userId],
  );
  if (!rows[0]) throw ApiError.unauthorized('User no longer exists');

  const roles = await loadRoleNames(rows[0].id);
  const accessToken = signToken({
    sub: rows[0].id,
    org: rows[0].organization_id,
    email: rows[0].email,
    roles,
  });
  return {
    accessToken,
    refreshToken: rotated.refreshToken,
    refreshExpiresAt: rotated.refreshExpiresAt,
    accessExpiresIn: env.jwtExpiresIn,
  };
};

export const logout = async (rawRefreshToken) => {
  await revokeRefreshToken(rawRefreshToken);
  return { success: true };
};

export const me = async (userId) => {
  const { rows } = await query(
    `SELECT u.id, u.organization_id, u.email, u.first_name, u.last_name, u.phone,
            COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId],
  );
  if (!rows[0]) throw ApiError.notFound('User not found');
  return rows[0];
};
