-- 008 business-rule constraints + perf indexes
--
-- 1. Enforce "one active assignment per bus" at the DB level.
--    A partial unique index lets historical rows (is_active=FALSE) coexist.
CREATE UNIQUE INDEX IF NOT EXISTS uq_route_assignments_active_bus
  ON route_assignments(bus_id)
  WHERE is_active = TRUE;

-- 2. Speed up the GPS-offline cron (WHERE last_update < NOW() - interval).
CREATE INDEX IF NOT EXISTS idx_bus_live_status_last_update
  ON bus_live_status(last_update);

-- 3. Speed up "active trip for this driver/bus" lookups used by GPS ingest.
CREATE INDEX IF NOT EXISTS idx_trips_assignment_status
  ON trips(assignment_id, status);

-- 4. Stop-event uniqueness — one arrival per (trip, stop) so cron + arrival
--    detection can't double-insert.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stop_events_trip_stop_arrival
  ON stop_events(trip_id, stop_id)
  WHERE arrival_time IS NOT NULL;
