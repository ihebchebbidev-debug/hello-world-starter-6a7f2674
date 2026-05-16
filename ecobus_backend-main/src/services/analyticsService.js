import { query } from '../config/db.js';

export const startSession = async ({ userId, organizationId, deviceType, platform }) => {
  const { rows } = await query(
    `INSERT INTO sessions (user_id, organization_id, device_type, platform, started_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, user_id, organization_id, device_type, platform, started_at`,
    [userId || null, organizationId || null, deviceType || null, platform || null],
  );
  return rows[0];
};

export const endSession = async (sessionId, userId) => {
  // A user can only end their own sessions; anonymous sessions are end-able by id only.
  const where = userId
    ? `WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`
    : `WHERE id = $1`;
  const params = userId ? [sessionId, userId] : [sessionId];
  const { rows } = await query(
    `UPDATE sessions SET ended_at = NOW() ${where}
     RETURNING id, started_at, ended_at`,
    params,
  );
  return rows[0] || null;
};

export const recordEvent = ({ sessionId, userId, eventType, metadata }) =>
  query(
    `INSERT INTO events (session_id, user_id, event_type, metadata)
     VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
    [sessionId || null, userId || null, eventType, metadata || {}],
  ).then((r) => r.rows[0]);

// ─────────────────────────── Aggregations ───────────────────────────
//
// All aggregates below are tenant-scoped to `orgId`. They are intentionally
// composed of small, indexed queries (rather than one giant CTE) so that an
// individual widget on the dashboard can fail without breaking the others.

const since = (days) => `NOW() - INTERVAL '${Number(days)} days'`;

/**
 * School-admin dashboard overview: a single JSON blob the dashboard renders
 * as KPI tiles + sparklines. Defaults to the last 7 days.
 */
export const orgOverview = async (orgId, { days = 7 } = {}) => {
  const d = Math.max(1, Math.min(90, Number(days) || 7));
  const [
    fleet, trips, gpsUptime, sosCount, alertsByStatus, attendance, deliveries, dau,
  ] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active')      AS active_buses,
         COUNT(*) FILTER (WHERE status = 'inactive')    AS inactive_buses,
         COUNT(*) FILTER (WHERE status = 'maintenance') AS maintenance_buses,
         COUNT(*)                                       AS total_buses
       FROM buses
       WHERE organization_id = $1 AND deleted_at IS NULL`,
      [orgId],
    ).then((r) => r.rows[0]),

    query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'in_progress')                                AS active_trips,
         COUNT(*) FILTER (WHERE start_time >= CURRENT_DATE)                            AS trips_today,
         COUNT(*) FILTER (WHERE status = 'completed' AND end_time >= ${since(d)})      AS trips_completed,
         COUNT(*) FILTER (WHERE start_time >= ${since(d)})                             AS trips_started
       FROM trips
       WHERE organization_id = $1`,
      [orgId],
    ).then((r) => r.rows[0]),

    // GPS uptime % over the window. We approximate uptime as the fraction
    // of (bus, minute) buckets that received at least one ping while the
    // bus was on an active trip. Cheap and good enough for a KPI tile.
    query(
      `WITH minutes AS (
         SELECT DISTINCT date_trunc('minute', g.recorded_at) AS m, g.bus_id
         FROM gps_logs g
         JOIN buses b ON b.id = g.bus_id AND b.organization_id = $1
         WHERE g.recorded_at >= ${since(d)}
       )
       SELECT
         COUNT(*) AS minutes_with_gps,
         (SELECT COUNT(DISTINCT bus_id) FROM minutes) AS buses_seen
       FROM minutes`,
      [orgId],
    ).then((r) => r.rows[0]),

    query(
      `SELECT
         COUNT(*)                                  AS total,
         COUNT(*) FILTER (WHERE status = 'active') AS open
       FROM sos_alerts s
       JOIN users u ON u.id = s.user_id
       WHERE u.organization_id = $1
         AND s.created_at >= ${since(d)}`,
      [orgId],
    ).then((r) => r.rows[0]),

    query(
      `SELECT status, COUNT(*)::int AS n
       FROM alerts
       WHERE organization_id = $1 AND created_at >= ${since(d)}
       GROUP BY status`,
      [orgId],
    ).then((r) => r.rows.reduce((acc, x) => (acc[x.status] = x.n, acc), {})),

    query(
      `SELECT
         COUNT(*) FILTER (WHERE ck.status = 'boarded')               AS boarded,
         COUNT(*) FILTER (WHERE ck.status = 'left')                  AS left,
         COUNT(*) FILTER (WHERE ck.status = 'absent')                AS absent,
         COUNT(*)                                                    AS total
       FROM checkins ck
       JOIN trips t ON t.id = ck.trip_id
       WHERE t.organization_id = $1 AND ck.timestamp >= ${since(d)}`,
      [orgId],
    ).then((r) => r.rows[0]),

    query(
      `SELECT COUNT(*)::int AS notifications_sent
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       WHERE u.organization_id = $1 AND n.created_at >= ${since(d)}`,
      [orgId],
    ).then((r) => r.rows[0]),

    // App usage — distinct users seen per day for the last `d` days.
    query(
      `SELECT date_trunc('day', started_at)::date AS day,
              COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS users
       FROM sessions
       WHERE organization_id = $1 AND started_at >= ${since(d)}
       GROUP BY 1 ORDER BY 1 ASC`,
      [orgId],
    ).then((r) => r.rows.map((x) => ({ day: x.day, users: Number(x.users) }))),
  ]);

  return {
    windowDays: d,
    fleet: {
      total: Number(fleet?.total || 0),
      active: Number(fleet?.active_buses || 0),
      inactive: Number(fleet?.inactive_buses || 0),
      maintenance: Number(fleet?.maintenance_buses || 0),
    },
    trips: {
      active: Number(trips?.active_trips || 0),
      today: Number(trips?.trips_today || 0),
      completedInWindow: Number(trips?.trips_completed || 0),
      startedInWindow: Number(trips?.trips_started || 0),
    },
    gps: {
      minutesWithSignal: Number(gpsUptime?.minutes_with_gps || 0),
      busesSeen: Number(gpsUptime?.buses_seen || 0),
    },
    sos: {
      total: Number(sosCount?.total || 0),
      open: Number(sosCount?.open || 0),
    },
    alerts: alertsByStatus, // { active, acknowledged, resolved }
    attendance: {
      boarded: Number(attendance?.boarded || 0),
      left: Number(attendance?.left || 0),
      absent: Number(attendance?.absent || 0),
      total: Number(attendance?.total || 0),
    },
    notifications: { sent: Number(deliveries?.notifications_sent || 0) },
    dailyActiveUsers: dau,
  };
};

/**
 * Super-admin (SaaS owner) overview: aggregates across all organizations.
 * No tenant filter — caller must enforce role at the route layer.
 */
export const platformOverview = async ({ days = 7 } = {}) => {
  const d = Math.max(1, Math.min(90, Number(days) || 7));
  const [orgs, users, fleet, trips, gps, sos, perOrg] = await Promise.all([
    query(`SELECT
             COUNT(*)                                   AS total,
             COUNT(*) FILTER (WHERE subscription_status = 'active') AS active,
             COUNT(*) FILTER (WHERE subscription_status = 'trial')  AS trial
           FROM organizations`).then((r) => r.rows[0]),
    query(`SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL`).then((r) => r.rows[0]),
    query(`SELECT COUNT(*) AS total FROM buses WHERE deleted_at IS NULL`).then((r) => r.rows[0]),
    query(`SELECT
             COUNT(*) FILTER (WHERE status = 'in_progress')                            AS active,
             COUNT(*) FILTER (WHERE start_time >= ${since(d)})                         AS started_in_window,
             COUNT(*) FILTER (WHERE status = 'completed' AND end_time >= ${since(d)})  AS completed_in_window
           FROM trips`).then((r) => r.rows[0]),
    query(`SELECT COUNT(*)::bigint AS pings_in_window FROM gps_logs
           WHERE recorded_at >= ${since(d)}`).then((r) => r.rows[0]),
    query(`SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'active') AS open
           FROM sos_alerts WHERE created_at >= ${since(d)}`).then((r) => r.rows[0]),
    query(`SELECT o.id, o.name, o.subscription_plan, o.subscription_status,
                  COUNT(DISTINCT b.id)                                          AS buses,
                  COUNT(DISTINCT t.id) FILTER (WHERE t.start_time >= ${since(d)}) AS trips_in_window
           FROM organizations o
           LEFT JOIN buses b ON b.organization_id = o.id AND b.deleted_at IS NULL
           LEFT JOIN trips t ON t.organization_id = o.id
           GROUP BY o.id ORDER BY o.name ASC`).then((r) => r.rows),
  ]);

  return {
    windowDays: d,
    organizations: {
      total: Number(orgs?.total || 0),
      active: Number(orgs?.active || 0),
      trial: Number(orgs?.trial || 0),
    },
    users: { total: Number(users?.total || 0) },
    fleet: { totalBuses: Number(fleet?.total || 0) },
    trips: {
      active: Number(trips?.active || 0),
      startedInWindow: Number(trips?.started_in_window || 0),
      completedInWindow: Number(trips?.completed_in_window || 0),
    },
    gps: { pingsInWindow: Number(gps?.pings_in_window || 0) },
    sos: {
      total: Number(sos?.total || 0),
      open: Number(sos?.open || 0),
    },
    perOrganization: perOrg.map((o) => ({
      id: o.id,
      name: o.name,
      plan: o.subscription_plan,
      status: o.subscription_status,
      buses: Number(o.buses),
      tripsInWindow: Number(o.trips_in_window),
    })),
  };
};

/**
 * Attendance report grouped by route (and optionally a single trip), over
 * the last `days` days. Used by the school admin "Reports" page.
 */
export const attendanceReport = async (orgId, { days = 30, routeId, tripId } = {}) => {
  const d = Math.max(1, Math.min(180, Number(days) || 30));
  const params = [orgId];
  let where = `t.organization_id = $1 AND ck.timestamp >= ${since(d)}`;
  if (routeId) { params.push(routeId); where += ` AND t.route_id = $${params.length}`; }
  if (tripId)  { params.push(tripId);  where += ` AND t.id = $${params.length}`; }

  const { rows } = await query(
    `SELECT t.route_id,
            r.name AS route_name,
            COUNT(*) FILTER (WHERE ck.status = 'boarded') AS boarded,
            COUNT(*) FILTER (WHERE ck.status = 'left')    AS left,
            COUNT(*) FILTER (WHERE ck.status = 'absent')  AS absent,
            COUNT(DISTINCT ck.child_id)                   AS unique_children,
            COUNT(DISTINCT t.id)                          AS trips_count
     FROM checkins ck
     JOIN trips t ON t.id = ck.trip_id
     LEFT JOIN routes r ON r.id = t.route_id
     WHERE ${where}
     GROUP BY t.route_id, r.name
     ORDER BY r.name NULLS LAST`,
    params,
  );
  return {
    windowDays: d,
    routes: rows.map((r) => ({
      routeId: r.route_id,
      routeName: r.route_name,
      boarded: Number(r.boarded),
      left: Number(r.left),
      absent: Number(r.absent),
      uniqueChildren: Number(r.unique_children),
      tripsCount: Number(r.trips_count),
    })),
  };
};

/**
 * Per-driver performance over the last `days` days.
 * On-time % is computed against `route_stops.planned_time` and a 5-minute
 * grace window — the same threshold the delay-detection cron uses.
 */
export const driverPerformanceReport = async (orgId, { days = 30 } = {}) => {
  const d = Math.max(1, Math.min(180, Number(days) || 30));
  const { rows } = await query(
    `WITH window_trips AS (
       SELECT t.id, t.start_time, t.end_time, t.status, ra.driver_id
       FROM trips t
       JOIN route_assignments ra ON ra.id = t.assignment_id
       WHERE t.organization_id = $1
         AND t.start_time >= ${since(d)}
     ),
     stop_perf AS (
       SELECT wt.driver_id,
              COUNT(*) FILTER (
                WHERE se.arrival_time IS NOT NULL
                  AND rs.planned_time IS NOT NULL
                  AND (se.arrival_time::time - rs.planned_time) <= INTERVAL '5 minutes'
              ) AS on_time_stops,
              COUNT(*) FILTER (
                WHERE se.arrival_time IS NOT NULL AND rs.planned_time IS NOT NULL
              ) AS measured_stops
       FROM window_trips wt
       JOIN stop_events se ON se.trip_id = wt.id
       JOIN route_stops rs ON rs.id = se.stop_id
       GROUP BY wt.driver_id
     )
     SELECT u.id            AS driver_id,
            u.first_name,
            u.last_name,
            u.email,
            COUNT(wt.id)                                                AS trips_total,
            COUNT(wt.id) FILTER (WHERE wt.status = 'completed')         AS trips_completed,
            COALESCE(sp.on_time_stops, 0)                               AS on_time_stops,
            COALESCE(sp.measured_stops, 0)                              AS measured_stops
     FROM users u
     LEFT JOIN window_trips wt ON wt.driver_id = u.id
     LEFT JOIN stop_perf sp     ON sp.driver_id = u.id
     WHERE u.organization_id = $1
       AND EXISTS (
         SELECT 1 FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = u.id AND r.name = 'driver'
       )
     GROUP BY u.id, sp.on_time_stops, sp.measured_stops
     ORDER BY trips_total DESC, u.last_name ASC`,
    [orgId],
  );

  return {
    windowDays: d,
    drivers: rows.map((r) => ({
      driverId: r.driver_id,
      name: `${r.first_name} ${r.last_name}`.trim(),
      email: r.email,
      tripsTotal: Number(r.trips_total),
      tripsCompleted: Number(r.trips_completed),
      onTimeStops: Number(r.on_time_stops),
      measuredStops: Number(r.measured_stops),
      onTimePct: Number(r.measured_stops) === 0
        ? null
        : Math.round((Number(r.on_time_stops) / Number(r.measured_stops)) * 1000) / 10,
    })),
  };
};
