import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

const COLS = `id, type, severity, status, bus_id, trip_id, message,
              acknowledged_at, acknowledged_by, resolved_at, resolved_by, created_at`;

export const list = async (orgId, { type, severity, status, busId, tripId, limit = 100, offset = 0 } = {}) => {
  const params = [orgId];
  const where = ['organization_id = $1'];
  if (type)     { params.push(type);     where.push(`type = $${params.length}`); }
  if (severity) { params.push(severity); where.push(`severity = $${params.length}`); }
  if (status)   { params.push(status);   where.push(`status = $${params.length}`); }
  if (busId)    { params.push(busId);    where.push(`bus_id = $${params.length}`); }
  if (tripId)   { params.push(tripId);   where.push(`trip_id = $${params.length}`); }
  params.push(Math.min(limit, 500), offset);
  const { rows } = await query(
    `SELECT ${COLS}
     FROM alerts WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
};

export const create = async (orgId, { type, severity, busId, tripId, message }) => {
  const { rows } = await query(
    `INSERT INTO alerts (organization_id, type, severity, bus_id, trip_id, message)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${COLS}`,
    [orgId, type, severity || 'info', busId || null, tripId || null, message || null],
  );
  return rows[0];
};

export const getById = async (orgId, id) => {
  const { rows } = await query(
    `SELECT ${COLS}
     FROM alerts WHERE id = $1 AND organization_id = $2`,
    [id, orgId],
  );
  if (!rows[0]) throw ApiError.notFound('Alert not found');
  return rows[0];
};

export const remove = async (orgId, id) => {
  await getById(orgId, id);
  await query('DELETE FROM alerts WHERE id = $1 AND organization_id = $2', [id, orgId]);
  return { success: true };
};

/**
 * Move an alert from `active` → `acknowledged`. Idempotent — calling on an
 * already-acknowledged alert returns the row without overwriting timestamps.
 * Resolved alerts cannot be re-opened.
 */
export const acknowledge = async (orgId, id, userId) => {
  const { rows } = await query(
    `UPDATE alerts
        SET status = 'acknowledged',
            acknowledged_at = COALESCE(acknowledged_at, NOW()),
            acknowledged_by = COALESCE(acknowledged_by, $3)
      WHERE id = $1 AND organization_id = $2 AND status <> 'resolved'
      RETURNING ${COLS}`,
    [id, orgId, userId],
  );
  if (!rows[0]) throw ApiError.notFound('Alert not found or already resolved');
  return rows[0];
};

/**
 * Move an alert to `resolved`. Stamps both ack and resolve timestamps if
 * the alert was never acknowledged so the audit trail is complete.
 */
export const resolve = async (orgId, id, userId) => {
  const { rows } = await query(
    `UPDATE alerts
        SET status = 'resolved',
            acknowledged_at = COALESCE(acknowledged_at, NOW()),
            acknowledged_by = COALESCE(acknowledged_by, $3),
            resolved_at = NOW(),
            resolved_by = $3
      WHERE id = $1 AND organization_id = $2
      RETURNING ${COLS}`,
    [id, orgId, userId],
  );
  if (!rows[0]) throw ApiError.notFound('Alert not found');
  return rows[0];
};
