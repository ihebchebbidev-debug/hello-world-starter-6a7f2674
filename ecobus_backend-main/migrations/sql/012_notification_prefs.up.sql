-- 012 per-user notification preferences (one row per user)
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    master         BOOLEAN NOT NULL DEFAULT TRUE,
    boarded        BOOLEAN NOT NULL DEFAULT TRUE,
    dropped_off    BOOLEAN NOT NULL DEFAULT TRUE,
    eta_reminder   BOOLEAN NOT NULL DEFAULT TRUE,
    delay          BOOLEAN NOT NULL DEFAULT TRUE,
    route_change   BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours    BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_from     VARCHAR(5) NOT NULL DEFAULT '22:00',
    quiet_to       VARCHAR(5) NOT NULL DEFAULT '07:00',
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
