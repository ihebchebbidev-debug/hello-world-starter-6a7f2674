-- 013: persistent phone OTP store
-- Replaces the in-memory Map in phoneOtpService.js so OTP state is shared
-- across all backend instances (PM2 cluster, multiple containers, etc.) and
-- survives restarts. Rate-limit and attempt counters live with the row.

CREATE TABLE IF NOT EXISTS phone_otps (
    phone         VARCHAR(32) PRIMARY KEY,
    code_hash     CHAR(64)    NOT NULL,
    expires_at    TIMESTAMP   NOT NULL,
    attempts      INTEGER     NOT NULL DEFAULT 0,
    last_sent_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_otps_expires ON phone_otps(expires_at);
