-- 014 down
DROP INDEX IF EXISTS uq_sos_idem;
ALTER TABLE sos_alerts DROP COLUMN IF EXISTS idempotency_key;

DROP INDEX IF EXISTS uq_checkins_idem;
ALTER TABLE checkins DROP COLUMN IF EXISTS idempotency_key;

DROP INDEX IF EXISTS uq_trip_active_per_assignment;
