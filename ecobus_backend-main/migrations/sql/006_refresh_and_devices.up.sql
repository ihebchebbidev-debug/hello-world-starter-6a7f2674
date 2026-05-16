-- 006: refresh tokens + device platform unique + visitor on session start
-- Adds infrastructure for /auth/refresh, /devices/token and /analytics/session/start.

-- ---------- refresh_tokens ----------
-- Stores hashed refresh tokens (sha256). Rotated on every /auth/refresh call.
-- We never store the raw token.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    CHAR(64) NOT NULL UNIQUE,
    user_agent    TEXT,
    ip_address    VARCHAR(64),
    expires_at    TIMESTAMP NOT NULL,
    revoked_at    TIMESTAMP,
    replaced_by   UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ---------- device_tokens: idempotent upsert key ----------
-- A user/platform/token triple should be unique so /devices/token can upsert.
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_tokens_token ON device_tokens(token);
ALTER TABLE device_tokens
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE device_tokens
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP;

-- ---------- analytics: allow standalone /analytics/session/start ----------
-- Sessions can now exist without a visitor row (visitor_id becomes nullable)
-- and we store user_id directly so authenticated sessions are easy to query.
ALTER TABLE sessions
    ALTER COLUMN visitor_id DROP NOT NULL;
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_org ON sessions(organization_id);
