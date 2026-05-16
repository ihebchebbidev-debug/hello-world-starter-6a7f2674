/**
 * Device token registration service (used by Notifications module).
 * Idempotent upsert keyed by token. Tokens are scoped to a user.
 */
import { query } from '../config/db.js';

export const registerToken = async (userId, { token, platform }) => {
  const { rows } = await query(
    `INSERT INTO device_tokens (user_id, token, platform, last_seen_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (token) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       platform = EXCLUDED.platform,
       last_seen_at = NOW(),
       revoked_at = NULL
     RETURNING id, user_id, platform, last_seen_at, created_at`,
    [userId, token, platform],
  );
  return rows[0];
};

export const revokeToken = async (userId, token) => {
  const { rowCount } = await query(
    `UPDATE device_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND token = $2 AND revoked_at IS NULL`,
    [userId, token],
  );
  return { success: rowCount > 0 };
};

export const listForUser = (userId) =>
  query(
    `SELECT id, platform, last_seen_at, created_at
     FROM device_tokens
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY last_seen_at DESC`,
    [userId],
  ).then((r) => r.rows);
