-- 014: safety invariants
-- 1) Prevent two in_progress trips for the same assignment (driver/bus race).
-- 2) Add idempotency_key to checkins + sos_alerts so mobile retries are safe.

-- ── Trip race fix ────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_active_per_assignment
  ON trips (assignment_id)
  WHERE status = 'in_progress';

-- ── Idempotency: checkins ────────────────────────────────────
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS uq_checkins_idem
  ON checkins (trip_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── Idempotency: sos_alerts ──────────────────────────────────
ALTER TABLE sos_alerts
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sos_idem
  ON sos_alerts (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
