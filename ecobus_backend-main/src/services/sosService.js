import { query, withTransaction } from '../config/db.js';
import { createMany as createNotifications } from './notificationService.js';
import { sendToUsers } from './fcmService.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Resolve the audience for an SOS alert:
 *   - the parent of any child currently checked-in (boarded) on the linked trip
 *   - all admins/school_managers/super_admins of the same organization
 * The triggering user is excluded so they don't get notified of their own SOS.
 */
const resolveAudience = async (orgId, tripId, excludeUserId) => {
  const audience = new Set();

  const adminRows = await query(
    `SELECT DISTINCT u.id FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.organization_id = $1
       AND u.is_active = TRUE AND u.deleted_at IS NULL
       AND r.name IN ('admin', 'school_manager', 'super_admin')`,
    [orgId],
  );
  adminRows.rows.forEach((r) => audience.add(r.id));

  if (tripId) {
    const parentRows = await query(
      `SELECT DISTINCT c.parent_id
       FROM checkins ck
       JOIN children c ON c.id = ck.child_id
       WHERE ck.trip_id = $1 AND ck.status = 'boarded'
         AND c.parent_id IS NOT NULL`,
      [tripId],
    );
    parentRows.rows.forEach((r) => r.parent_id && audience.add(r.parent_id));
  }
  if (excludeUserId) audience.delete(excludeUserId);
  return [...audience];
};

/**
 * Look up the trip + bus context so SOS broadcasts can be scoped to
 * `trip:{id}` and `bus:{id}` rooms and validates org ownership.
 */
const resolveTripContext = async (orgId, tripId) => {
  if (!tripId) return { tripId: null, busId: null, routeId: null };
  const { rows } = await query(
    `SELECT t.id AS trip_id, t.route_id, ra.bus_id, b.organization_id
       FROM trips t
       JOIN route_assignments ra ON ra.id = t.assignment_id
       JOIN buses b ON b.id = ra.bus_id
      WHERE t.id = $1`,
    [tripId],
  );
  const row = rows[0];
  if (!row) throw ApiError.badRequest('Trip not found');
  if (row.organization_id !== orgId) throw ApiError.forbidden('Cross-tenant trip');
  return { tripId: row.trip_id, busId: row.bus_id, routeId: row.route_id };
};

export const trigger = async (user, { tripId, latitude, longitude, message, type, idempotencyKey }) => {
  const ctx = await resolveTripContext(user.organizationId, tripId);
  const sosKind = type || 'other';

  // Idempotency: same (user, key) → return the existing alert (no fan-out).
  if (idempotencyKey) {
    const dup = await query(
      `SELECT id, organization_id, user_id, trip_id, latitude, longitude, status, created_at
         FROM sos_alerts WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1`,
      [user.id, idempotencyKey],
    );
    if (dup.rows[0]) {
      return { alert: { ...dup.rows[0], message: message || null }, audience: [], context: ctx };
    }
  }

  let replayed = false;
  const alert = await withTransaction(async (c) => {
    try {
      const { rows } = await c.query(
        `INSERT INTO sos_alerts (organization_id, user_id, trip_id, latitude, longitude, status, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,'active',$6)
         RETURNING id, organization_id, user_id, trip_id, latitude, longitude, status, created_at`,
        [user.organizationId, user.id, ctx.tripId, latitude ?? null, longitude ?? null, idempotencyKey || null],
      );
      const a = rows[0];
      await c.query(
        `INSERT INTO alerts (organization_id, type, severity, trip_id, message)
         VALUES ($1, 'sos', 'critical', $2, $3)`,
        [user.organizationId, ctx.tripId, `[${sosKind}] ${message || `SOS triggered by user ${user.id}`}`],
      );
      return { ...a, sos_type: sosKind };
    } catch (err) {
      if (err && err.code === '23505' && idempotencyKey) {
        replayed = true;
        const found = await c.query(
          `SELECT id, organization_id, user_id, trip_id, latitude, longitude, status, created_at
             FROM sos_alerts WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1`,
          [user.id, idempotencyKey],
        );
        return { ...found.rows[0], sos_type: sosKind };
      }
      throw err;
    }
  });

  if (replayed) {
    return { alert: { ...alert, message: message || null }, audience: [], context: ctx };
  }

  let recipients = [];
  try {
    recipients = await resolveAudience(user.organizationId, ctx.tripId, user.id);
    await createNotifications(
      recipients.map((uid) => ({
        userId: uid,
        organizationId: user.organizationId,
        title: 'SOS Alert',
        message: message || 'An SOS has been triggered. Tap for details.',
        type: 'sos',
      })),
    ).catch((err) =>
      logger.error('sos.notify failed', { err: err.message, alertId: alert.id }),
    );
    await sendToUsers(recipients, {
      title: 'SOS Alert',
      body: message || 'An emergency SOS has been triggered.',
      data: { alertId: alert.id, tripId: ctx.tripId || '' },
    }).catch((err) => logger.error('sos.fcm failed', { err: err.message, alertId: alert.id }));
  } catch (err) {
    logger.error('sos.fanout failed', { err: err.message, alertId: alert.id });
  }

  return {
    alert: { ...alert, message: message || null },
    audience: recipients,
    context: ctx,
  };
};

/**
 * Move an SOS alert to `acknowledged`. Idempotent — safe to call again.
 * Resolved alerts cannot be reverted.
 */
export const acknowledge = async (orgId, id, actorId) => {
  const { rows } = await query(
    `UPDATE sos_alerts s
        SET status = 'acknowledged',
            acknowledged_at = COALESCE(acknowledged_at, NOW()),
            acknowledged_by = COALESCE(acknowledged_by, $3)
       FROM users u
      WHERE s.id = $1
        AND s.user_id = u.id
        AND u.organization_id = $2
        AND s.status <> 'resolved'
      RETURNING s.id, s.user_id, s.trip_id, s.latitude, s.longitude, s.status,
                s.acknowledged_at, s.acknowledged_by, s.created_at`,
    [id, orgId, actorId],
  );
  if (!rows[0]) throw ApiError.notFound('SOS alert not found or already resolved');
  return rows[0];
};

export const resolve = async (orgId, id, actorId) => {
  const { rows } = await query(
    `UPDATE sos_alerts s
        SET status = 'resolved',
            acknowledged_at = COALESCE(acknowledged_at, NOW()),
            acknowledged_by = COALESCE(acknowledged_by, $3),
            resolved_at = NOW(),
            resolved_by = $3
       FROM users u
      WHERE s.id = $1
        AND s.user_id = u.id
        AND u.organization_id = $2
      RETURNING s.id, s.user_id, s.trip_id, s.latitude, s.longitude, s.status,
                s.acknowledged_at, s.resolved_at, s.created_at`,
    [id, orgId, actorId],
  );
  if (!rows[0]) throw ApiError.notFound('SOS alert not found');
  return rows[0];
};

export const listForOrg = (orgId, { status, limit = 100 } = {}) => {
  const params = [orgId];
  let where = `s.organization_id = $1`;
  if (status) {
    params.push(status);
    where += ` AND s.status = $${params.length}`;
  }
  params.push(Math.min(Number(limit) || 100, 500));
  return query(
    `SELECT s.id, s.user_id, s.trip_id, s.latitude, s.longitude, s.status, s.created_at
     FROM sos_alerts s
     WHERE ${where}
     ORDER BY s.created_at DESC
     LIMIT $${params.length}`,
    params,
  ).then((r) => r.rows);
};
