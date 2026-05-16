/**
 * Refresh token service.
 *
 * Design:
 *   - Access tokens are short-lived JWTs (env.jwtExpiresIn, default 15m).
 *   - Refresh tokens are opaque random strings. Only the SHA-256 hash is
 *     stored. The raw token is returned to the client exactly once.
 *   - On refresh, the presented token is hashed, looked up, validated
 *     (not revoked, not expired), and ROTATED — the old row is marked
 *     revoked and a new token is issued.
 *   - Rotation theft detection: if a revoked token is replayed, all
 *     refresh tokens for that user are revoked.
 */
import crypto from 'node:crypto';
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

const sha256 = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const generate = () => crypto.randomBytes(48).toString('base64url');

export const issueRefreshToken = async (userId, { userAgent, ip } = {}) => {
  const raw = generate();
  const hash = sha256(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, hash, userAgent || null, ip || null, expiresAt],
  );

  return { refreshToken: raw, refreshExpiresAt: expiresAt.toISOString() };
};

/**
 * Atomically rotate a refresh token. Returns the user_id whose token was
 * accepted; the caller is responsible for issuing a new access token.
 *
 * Throws ApiError.unauthorized for any invalid/expired/revoked token.
 */
export const rotateRefreshToken = async (rawToken, { userAgent, ip } = {}) => {
  if (!rawToken || typeof rawToken !== 'string') {
    throw ApiError.unauthorized('Refresh token is required');
  }
  const hash = sha256(rawToken);

  const { rows } = await query(
    `SELECT id, user_id, expires_at, revoked_at
     FROM refresh_tokens WHERE token_hash = $1`,
    [hash],
  );
  const row = rows[0];
  if (!row) throw ApiError.unauthorized('Invalid refresh token');

  if (row.revoked_at) {
    // Token reuse → potential theft. Revoke the entire family for this user.
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [row.user_id],
    );
    throw ApiError.unauthorized('Refresh token has been revoked');
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw ApiError.unauthorized('Refresh token expired');
  }

  // Issue replacement, mark current as revoked, link them.
  const fresh = await issueRefreshToken(row.user_id, { userAgent, ip });
  const replacementHash = sha256(fresh.refreshToken);
  const { rows: replacement } = await query(
    `SELECT id FROM refresh_tokens WHERE token_hash = $1`,
    [replacementHash],
  );
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(), replaced_by = $1
     WHERE id = $2`,
    [replacement[0].id, row.id],
  );

  return { userId: row.user_id, ...fresh };
};

export const revokeRefreshToken = async (rawToken) => {
  if (!rawToken) return;
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [sha256(rawToken)],
  );
};

export const revokeAllForUser = async (userId) => {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
};
