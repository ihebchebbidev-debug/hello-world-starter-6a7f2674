import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

const COLUMNS = `
  t.id, t.organization_id, t.route_id, t.assignment_id, t.status,
  t.start_time, t.end_time, t.created_at
`;

/**
 * Start a trip.
 *
 * Business rules:
 *   - If assignmentId is supplied, it must belong to the org and be active.
 *   - Otherwise we resolve the active assignment for routeId.
 *   - Only one in_progress trip per driver at a time.
 */
export const start = async (orgId, { routeId, assignmentId }) => {
  return withTransaction(async (c) => {
    let assignment;
    if (assignmentId) {
      const r = await c.query(
        `SELECT id, route_id, driver_id, bus_id FROM route_assignments
         WHERE id = $1 AND organization_id = $2 AND is_active = TRUE`,
        [assignmentId, orgId],
      );
      assignment = r.rows[0];
      if (!assignment) throw ApiError.badRequest('Assignment not found or inactive');
      if (assignment.route_id !== routeId) {
        throw ApiError.badRequest('Assignment does not match route');
      }
    } else {
      const r = await c.query(
        `SELECT id, route_id, driver_id, bus_id FROM route_assignments
         WHERE route_id = $1 AND organization_id = $2 AND is_active = TRUE
         ORDER BY created_at DESC LIMIT 1`,
        [routeId, orgId],
      );
      assignment = r.rows[0];
      if (!assignment) throw ApiError.badRequest('No active assignment for this route');
    }

    const conflict = await c.query(
      `SELECT t.id FROM trips t
       JOIN route_assignments ra ON ra.id = t.assignment_id
       WHERE ra.driver_id = $1 AND t.status = 'in_progress'`,
      [assignment.driver_id],
    );
    if (conflict.rowCount > 0) {
      throw ApiError.conflict('Driver already has an active trip');
    }

    try {
      const { rows } = await c.query(
        `INSERT INTO trips (organization_id, route_id, assignment_id, status, start_time)
         VALUES ($1, $2, $3, 'in_progress', NOW())
         RETURNING ${COLUMNS.replace(/t\./g, '')}`,
        [orgId, routeId, assignment.id],
      );
      return rows[0];
    } catch (err) {
      // Unique partial index uq_trip_active_per_assignment (migration 014)
      // → another request beat us to it. Surface as 409 Conflict.
      if (err && err.code === '23505') {
        throw ApiError.conflict('Driver already has an active trip');
      }
      throw err;
    }
  });
};

export const end = async (tripId, orgId) => {
  const { rows } = await query(
    `UPDATE trips SET status = 'completed', end_time = NOW()
     WHERE id = $1 AND organization_id = $2 AND status = 'in_progress'
     RETURNING ${COLUMNS.replace(/t\./g, '')}`,
    [tripId, orgId],
  );
  if (!rows[0]) throw ApiError.notFound('Active trip not found');
  return rows[0];
};

export const get = (tripId, orgId) =>
  query(
    `SELECT ${COLUMNS.replace(/t\./g, '')}
     FROM trips WHERE id = $1 AND organization_id = $2`,
    [tripId, orgId],
  ).then((r) => r.rows[0]);

// `orgId === null` → cross-organisation listing (super-admin only).
// All callers using a regular role still pass req.user.organizationId, so
// per-org isolation is preserved; only the trip route opts in to null when
// the caller is a super_admin (see trip.routes.js).
export const listActive = (orgId) => {
  if (orgId == null) {
    return query(
      `SELECT ${COLUMNS}, ra.driver_id, ra.bus_id
       FROM trips t
       LEFT JOIN route_assignments ra ON ra.id = t.assignment_id
       WHERE t.status = 'in_progress'
       ORDER BY t.start_time DESC`,
    ).then((r) => r.rows);
  }
  return query(
    `SELECT ${COLUMNS}, ra.driver_id, ra.bus_id
     FROM trips t
     LEFT JOIN route_assignments ra ON ra.id = t.assignment_id
     WHERE t.organization_id = $1 AND t.status = 'in_progress'
     ORDER BY t.start_time DESC`,
    [orgId],
  ).then((r) => r.rows);
};

/**
 * Active trips visible to a given user.
 *
 *   - parent → only trips on routes ridden by one of their children
 *   - everyone else (admin/manager/driver/super_admin) → all org active trips
 *
 * The mobile parent app uses this for the "today" view so siblings'
 * unrelated traffic never leaks into the home screen.
 */
export const listForParent = async (user) => {
  const isParentOnly =
    Array.isArray(user.roles) &&
    user.roles.includes('parent') &&
    !user.roles.some((r) => ['admin', 'school_manager', 'super_admin', 'driver'].includes(r));

  if (!isParentOnly) {
    return listActive(user.organizationId);
  }

  const { rows } = await query(
    `SELECT ${COLUMNS}, ra.driver_id, ra.bus_id
       FROM trips t
       LEFT JOIN route_assignments ra ON ra.id = t.assignment_id
      WHERE t.organization_id = $1
        AND t.status = 'in_progress'
        AND EXISTS (
          SELECT 1
            FROM child_routes cr
            JOIN children c ON c.id = cr.child_id
           WHERE cr.route_id = t.route_id
             AND c.parent_id = $2
             AND c.deleted_at IS NULL
        )
      ORDER BY t.start_time DESC`,
    [user.organizationId, user.id],
  );
  return rows;
};

export const listHistory = (orgId, { limit = 100, offset = 0 } = {}) =>
  query(
    `SELECT ${COLUMNS}, ra.driver_id, ra.bus_id
     FROM trips t
     LEFT JOIN route_assignments ra ON ra.id = t.assignment_id
     WHERE t.organization_id = $1 AND t.status <> 'in_progress'
     ORDER BY t.start_time DESC
     LIMIT $2 OFFSET $3`,
    [orgId, limit, offset],
  ).then((r) => r.rows);

/**
 * Auto-close trips with no GPS activity for `minutes` minutes.
 * Called by the cron job.
 */
export const autoCloseStaleTrips = async (minutes = 30) => {
  const { rows } = await query(
    `UPDATE trips t
     SET status = 'completed', end_time = NOW()
     WHERE t.status = 'in_progress'
       AND COALESCE(
         (SELECT MAX(recorded_at) FROM gps_logs g WHERE g.trip_id = t.id),
         t.start_time
       ) < NOW() - ($1 || ' minutes')::interval
     RETURNING t.id`,
    [String(minutes)],
  );
  return rows.map((r) => r.id);
};
