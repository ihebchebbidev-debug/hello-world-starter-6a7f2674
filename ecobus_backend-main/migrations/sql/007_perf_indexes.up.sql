-- 007: performance indexes on hot-path foreign keys and lookup columns.
-- All statements are idempotent (IF NOT EXISTS) so re-running is safe.

-- user_roles is hit on every authenticated request (requireRole middleware).
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- Children: parent dashboards filter by parent_id; admin dashboards by org.
CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);
CREATE INDEX IF NOT EXISTS idx_children_org ON children(organization_id);

-- Route assignments — driver/bus active-assignment lookups in tripService.start.
CREATE INDEX IF NOT EXISTS idx_assignments_route ON route_assignments(route_id);
CREATE INDEX IF NOT EXISTS idx_assignments_driver ON route_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_bus ON route_assignments(bus_id);
CREATE INDEX IF NOT EXISTS idx_assignments_org ON route_assignments(organization_id);

-- Trips: list-active and history queries.
CREATE INDEX IF NOT EXISTS idx_trips_org_status ON trips(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_trips_assignment ON trips(assignment_id);

-- Notifications: user inbox queries.
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);

-- Alerts: org dashboard.
CREATE INDEX IF NOT EXISTS idx_alerts_org_created ON alerts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_trip ON alerts(trip_id);

-- SOS alerts: org dashboard + per-trip.
CREATE INDEX IF NOT EXISTS idx_sos_org_created ON sos_alerts(organization_id, created_at DESC);

-- Stop events: per-trip lookups in delay detection.
CREATE INDEX IF NOT EXISTS idx_stop_events_trip ON stop_events(trip_id);

-- Device tokens: per-user push fan-out.
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

-- Child routes: parent ETA lookups.
CREATE INDEX IF NOT EXISTS idx_child_routes_child ON child_routes(child_id);
CREATE INDEX IF NOT EXISTS idx_child_routes_route ON child_routes(route_id);
