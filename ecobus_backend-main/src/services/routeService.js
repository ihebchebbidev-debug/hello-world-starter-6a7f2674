import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

export const list = (orgId) =>
  query(
    `SELECT id, name, description, is_active, created_at
     FROM routes WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [orgId],
  ).then((r) => r.rows);

export const create = async (orgId, { name, description }) => {
  const { rows } = await query(
    `INSERT INTO routes (organization_id, name, description)
     VALUES ($1,$2,$3) RETURNING id, name, description, is_active, created_at`,
    [orgId, name, description || null],
  );
  return rows[0];
};

export const stops = (routeId) =>
  query(
    `SELECT id, name, latitude, longitude, stop_order, planned_time
     FROM route_stops WHERE route_id = $1
     ORDER BY stop_order ASC`,
    [routeId],
  ).then((r) => r.rows);

export const addStop = async (routeId, { name, latitude, longitude, stopOrder, plannedTime }) => {
  const { rows } = await query(
    `INSERT INTO route_stops (route_id, name, latitude, longitude, stop_order, planned_time)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, name, latitude, longitude, stop_order, planned_time`,
    [routeId, name, latitude, longitude, stopOrder, plannedTime || null],
  );
  return rows[0];
};

export const replaceStops = (routeId, stopList) =>
  withTransaction(async (c) => {
    await c.query('DELETE FROM route_stops WHERE route_id = $1', [routeId]);
    for (const s of stopList) {
      await c.query(
        `INSERT INTO route_stops (route_id, name, latitude, longitude, stop_order, planned_time)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [routeId, s.name, s.latitude, s.longitude, s.stopOrder, s.plannedTime || null],
      );
    }
    return { ok: true };
  });

export const getById = async (orgId, routeId) => {
  const { rows } = await query(
    `SELECT id, name, description, is_active, created_at
     FROM routes WHERE id = $1 AND organization_id = $2`,
    [routeId, orgId],
  );
  if (!rows[0]) throw ApiError.notFound('Route not found');
  return rows[0];
};

export const update = async (orgId, routeId, patch) => {
  await getById(orgId, routeId);
  const map = { name: 'name', description: 'description', isActive: 'is_active' };
  const fields = []; const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      params.push(patch[k]);
      fields.push(`${col} = $${params.length}`);
    }
  }
  if (!fields.length) return getById(orgId, routeId);
  params.push(routeId, orgId);
  const { rows } = await query(
    `UPDATE routes SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length - 1} AND organization_id = $${params.length}
     RETURNING id, name, description, is_active, created_at`,
    params,
  );
  return rows[0];
};

export const remove = async (orgId, routeId) => {
  await getById(orgId, routeId);
  await query('DELETE FROM routes WHERE id = $1 AND organization_id = $2', [routeId, orgId]);
  return { success: true };
};
