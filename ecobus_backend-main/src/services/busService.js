/**
 * Bus management service.
 *
 * All operations are scoped to the caller's organization. Soft-delete is
 * implemented via deleted_at; deleted buses are excluded from all queries.
 */
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

const BUS_COLUMNS = `
  id, organization_id, name, plate_number, capacity, status,
  created_at, updated_at
`;

// `orgId === null` opts into a cross-org listing — used ONLY for super-admin
// callers (gated in bus.routes.js). Regular roles always pass their own
// orgId so per-org isolation is unchanged.
export const list = async (orgId, { search, status, limit = 100, offset = 0 } = {}) => {
  const params = [];
  const where = ['deleted_at IS NULL'];

  if (orgId != null) {
    params.push(orgId);
    where.push(`organization_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(name) LIKE $${params.length} OR LOWER(plate_number) LIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT ${BUS_COLUMNS} FROM buses
     WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
};

export const getById = async (orgId, busId) => {
  // orgId === null → cross-org lookup (super-admin only).
  const params = orgId == null ? [busId] : [busId, orgId];
  const orgClause = orgId == null ? '' : 'AND organization_id = $2';
  const { rows } = await query(
    `SELECT ${BUS_COLUMNS} FROM buses
     WHERE id = $1 ${orgClause} AND deleted_at IS NULL`,
    params,
  );
  if (!rows[0]) throw ApiError.notFound('Bus not found');
  return rows[0];
};

export const create = async (orgId, { name, plateNumber, capacity, status }) => {
  const dup = await query(
    `SELECT id FROM buses
     WHERE organization_id = $1 AND LOWER(plate_number) = LOWER($2) AND deleted_at IS NULL`,
    [orgId, plateNumber],
  );
  if (dup.rowCount > 0) throw ApiError.conflict('Plate number already exists');

  const { rows } = await query(
    `INSERT INTO buses (organization_id, name, plate_number, capacity, status)
     VALUES ($1, $2, $3, $4, COALESCE($5, 'inactive'))
     RETURNING ${BUS_COLUMNS}`,
    [orgId, name, plateNumber, capacity, status || null],
  );
  return rows[0];
};

export const update = async (orgId, busId, patch) => {
  await getById(orgId, busId);

  if (patch.plateNumber) {
    const dup = await query(
      `SELECT id FROM buses
       WHERE organization_id = $1 AND LOWER(plate_number) = LOWER($2)
         AND id <> $3 AND deleted_at IS NULL`,
      [orgId, patch.plateNumber, busId],
    );
    if (dup.rowCount > 0) throw ApiError.conflict('Plate number already exists');
  }

  const map = {
    name: 'name',
    plateNumber: 'plate_number',
    capacity: 'capacity',
    status: 'status',
  };
  const fields = [];
  const params = [];
  for (const [key, col] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      params.push(patch[key]);
      fields.push(`${col} = $${params.length}`);
    }
  }
  params.push(busId, orgId);
  const { rows } = await query(
    `UPDATE buses SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length - 1} AND organization_id = $${params.length}
     RETURNING ${BUS_COLUMNS}`,
    params,
  );
  return rows[0];
};

export const remove = async (orgId, busId) => {
  await getById(orgId, busId);

  const active = await query(
    `SELECT 1 FROM route_assignments
     WHERE bus_id = $1 AND is_active = TRUE
     LIMIT 1`,
    [busId],
  );
  if (active.rowCount > 0) {
    throw ApiError.conflict('Cannot delete a bus with active route assignments');
  }

  await query(
    `UPDATE buses SET deleted_at = NOW(), status = 'inactive', updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [busId, orgId],
  );
  return { success: true };
};

export const liveStatus = async (orgId, busId) => {
  await getById(orgId, busId);
  const { rows } = await query(
    `SELECT bus_id, trip_id, latitude, longitude, speed, heading, accuracy,
            battery_level, gps_status, last_update, updated_at
     FROM bus_live_status WHERE bus_id = $1`,
    [busId],
  );
  return rows[0] || null;
};
