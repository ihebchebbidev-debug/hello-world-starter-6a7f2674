-- 009 down — revert alert workflow audit columns
DROP INDEX IF EXISTS idx_alerts_org_status_created;

ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_status_check;
ALTER TABLE alerts
  DROP COLUMN IF EXISTS resolved_by,
  DROP COLUMN IF EXISTS resolved_at,
  DROP COLUMN IF EXISTS acknowledged_by,
  DROP COLUMN IF EXISTS acknowledged_at,
  DROP COLUMN IF EXISTS status;

ALTER TABLE sos_alerts
  DROP COLUMN IF EXISTS resolved_by,
  DROP COLUMN IF EXISTS resolved_at,
  DROP COLUMN IF EXISTS acknowledged_by,
  DROP COLUMN IF EXISTS acknowledged_at;
