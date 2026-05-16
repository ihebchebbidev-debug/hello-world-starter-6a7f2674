import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

export const list = async (orgId) => {
  const { rows } = await query(
    `SELECT id, name, latitude, longitude, radius, created_at
     FROM geofences WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [orgId],
  );
  return rows;
};

export const create = async (orgId, { name, latitude, longitude, radius }) => {
  const { rows } = await query(
    `INSERT INTO geofences (organization_id, name, latitude, longitude, radius)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, name, latitude, longitude, radius, created_at`,
    [orgId, name, latitude, longitude, radius],
  );
  return rows[0];
};

export const getById = async (orgId, id) => {
  const { rows } = await query(
    `SELECT id, name, latitude, longitude, radius, created_at
     FROM geofences WHERE id = $1 AND organization_id = $2`,
    [id, orgId],
  );
  if (!rows[0]) throw ApiError.notFound('Geofence not found');
  return rows[0];
};

export const update = async (orgId, id, patch) => {
  await getById(orgId, id);
  const map = { name: 'name', latitude: 'latitude', longitude: 'longitude', radius: 'radius' };
  const fields = []; const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      params.push(patch[k]);
      fields.push(`${col} = $${params.length}`);
    }
  }
  if (!fields.length) return getById(orgId, id);
  params.push(id, orgId);
  const { rows } = await query(
    `UPDATE geofences SET ${fields.join(', ')}
     WHERE id = $${params.length - 1} AND organization_id = $${params.length}
     RETURNING id, name, latitude, longitude, radius, created_at`,
    params,
  );
  return rows[0];
};

export const remove = async (orgId, id) => {
  await getById(orgId, id);
  await query('DELETE FROM geofences WHERE id = $1 AND organization_id = $2', [id, orgId]);
  return { success: true };
};
