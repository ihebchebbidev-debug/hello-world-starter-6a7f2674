-- 006 down
DROP INDEX IF EXISTS idx_sessions_org;
DROP INDEX IF EXISTS idx_sessions_user;
ALTER TABLE sessions DROP COLUMN IF EXISTS organization_id;
ALTER TABLE sessions DROP COLUMN IF EXISTS user_id;
-- We do not restore NOT NULL on visitor_id (would break existing rows).

ALTER TABLE device_tokens DROP COLUMN IF EXISTS revoked_at;
ALTER TABLE device_tokens DROP COLUMN IF EXISTS last_seen_at;
DROP INDEX IF EXISTS uq_device_tokens_token;

DROP INDEX IF EXISTS idx_refresh_tokens_expires;
DROP INDEX IF EXISTS idx_refresh_tokens_user;
DROP TABLE IF EXISTS refresh_tokens;
