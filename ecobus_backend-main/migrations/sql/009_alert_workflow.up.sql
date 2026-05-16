-- 009 alert workflow: status, ack/resolve audit columns
-- Lets the dashboard show "GPS offline / delay / route deviation" alerts as a
-- 3-state workflow (active → acknowledged → resolved) without a separate table.
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS resolved_at     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS resolved_by     UUID REFERENCES users(id);

-- Constrain status values without breaking existing rows.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'alerts_status_check'
  ) THEN
    ALTER TABLE alerts
      ADD CONSTRAINT alerts_status_check
      CHECK (status IN ('active','acknowledged','resolved'));
  END IF;
END $$;

-- Hot lookup for the "open alerts" dashboard widget.
CREATE INDEX IF NOT EXISTS idx_alerts_org_status_created
  ON alerts (organization_id, status, created_at DESC);

-- SOS already supports the same lifecycle via its `status` column, but it
-- has no audit columns. Add them so the dashboard can show "ack'd by X at Y".
ALTER TABLE sos_alerts
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS resolved_at     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS resolved_by     UUID REFERENCES users(id);
