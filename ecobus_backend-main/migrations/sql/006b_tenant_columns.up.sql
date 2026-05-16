-- 006b: tenant columns required by later performance indexes.
-- Some older databases reached 007 without these columns. Keep this migration
-- idempotent so it repairs existing installs and stays safe on fresh installs.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE notifications n
   SET organization_id = u.organization_id
  FROM users u
 WHERE n.user_id = u.id
   AND n.organization_id IS NULL;

ALTER TABLE sos_alerts
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE sos_alerts s
   SET organization_id = COALESCE(
       (SELECT t.organization_id FROM trips t WHERE t.id = s.trip_id),
       u.organization_id
   )
  FROM users u
 WHERE s.user_id = u.id
   AND s.organization_id IS NULL;