/**
 * Driver management service.
 *
 * "Drivers" are users with the 'driver' role within an organization.
 * Driver management is exposed alongside route assignments because the
 * primary fleet-ops workflow is: pick a driver → pick a bus → pick a route.
 *
 * All queries enforce tenant isolation via organization_id.
 */
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

const DRIVER_COLUMNS = `
  u.id, u.organization_id, u.email, u.first_name, u.last_name, u.phone,
  u.is_active, u.created_at, u.updated_at
`;

export const listDrivers = async (orgId, { search, isActive, limit = 100, offset = 0 } = {}) => {
  const params = [orgId];
  const where = [
    'u.organization_id = $1',
    'u.deleted_at IS NULL',
    "r.name = 'driver'",
  ];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(u.email) LIKE $${params.length}
                OR LOWER(u.first_name) LIKE $${params.length}
                OR LOWER(u.last_name) LIKE $${params.length})`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    where.push(`u.is_active = $${params.length}`);
  }
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT DISTINCT ${DRIVER_COLUMNS}
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE ${where.join(' AND ')}
     ORDER BY u.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
};

export const getDriver = async (orgId, driverId) => {
  const { rows } = await query(
    `SELECT DISTINCT ${DRIVER_COLUMNS}
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1 AND u.organization_id = $2
       AND u.deleted_at IS NULL AND r.name = 'driver'`,
    [driverId, orgId],
  );
  if (!rows[0]) throw ApiError.notFound('Driver not found');

  const assignments = await query(
    `SELECT ra.id, ra.route_id, r.name AS route_name,
            ra.bus_id, b.name AS bus_name, b.plate_number,
            ra.start_date, ra.end_date, ra.is_active
     FROM route_assignments ra
     JOIN routes r ON r.id = ra.route_id
     LEFT JOIN buses b ON b.id = ra.bus_id
     WHERE ra.driver_id = $1 AND ra.organization_id = $2
     ORDER BY ra.is_active DESC, ra.start_date DESC NULLS LAST`,
    [driverId, orgId],
  );
  return { ...rows[0], assignments: assignments.rows };
};

// ---------- Route assignments ----------

const ASSIGNMENT_COLUMNS = `
  ra.id, ra.organization_id, ra.route_id, ra.bus_id, ra.driver_id,
  ra.start_date, ra.end_date, ra.is_active, ra.created_at
`;

// Same columns without the `ra.` alias — used in INSERT/UPDATE ... RETURNING
// where the table has no alias.
const ASSIGNMENT_RETURNING = `
  id, organization_id, route_id, bus_id, driver_id,
  start_date, end_date, is_active, created_at
`;

const assertEntityInOrg = async (orgId, table, id, label, extra = '') => {
  const { rows } = await query(
    `SELECT id FROM ${table} WHERE id = $1 AND organization_id = $2 ${extra}`,
    [id, orgId],
  );
  if (!rows[0]) throw ApiError.badRequest(`${label} not found in this organization`);
};

const assertDriverInOrg = async (orgId, driverId) => {
  const { rows } = await query(
    `SELECT u.id FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1 AND u.organization_id = $2
       AND u.deleted_at IS NULL AND u.is_active = TRUE
       AND r.name = 'driver'`,
    [driverId, orgId],
  );
  if (!rows[0]) throw ApiError.badRequest('Driver must be an active user with the "driver" role');
};

export const listAssignments = async (orgId, { routeId, busId, driverId, isActive, limit = 100, offset = 0 } = {}) => {
  const params = [orgId];
  const where = ['ra.organization_id = $1'];

  if (routeId) { params.push(routeId); where.push(`ra.route_id = $${params.length}`); }
  if (busId) { params.push(busId); where.push(`ra.bus_id = $${params.length}`); }
  if (driverId) { params.push(driverId); where.push(`ra.driver_id = $${params.length}`); }
  if (isActive !== undefined) { params.push(isActive); where.push(`ra.is_active = $${params.length}`); }
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT ${ASSIGNMENT_COLUMNS},
            r.name AS route_name,
            b.name AS bus_name, b.plate_number,
            d.first_name AS driver_first_name, d.last_name AS driver_last_name
     FROM route_assignments ra
     JOIN routes r ON r.id = ra.route_id
     LEFT JOIN buses b ON b.id = ra.bus_id
     LEFT JOIN users d ON d.id = ra.driver_id
     WHERE ${where.join(' AND ')}
     ORDER BY ra.is_active DESC, ra.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
};

export const getAssignment = async (orgId, assignmentId) => {
  const { rows } = await query(
    `SELECT ${ASSIGNMENT_COLUMNS}
     FROM route_assignments ra
     WHERE ra.id = $1 AND ra.organization_id = $2`,
    [assignmentId, orgId],
  );
  if (!rows[0]) throw ApiError.notFound('Assignment not found');
  return rows[0];
};

export const createAssignment = async (orgId, input) => {
  const { routeId, busId, driverId, startDate, endDate, isActive = true } = input;

  await assertEntityInOrg(orgId, 'routes', routeId, 'Route');
  await assertEntityInOrg(orgId, 'buses', busId, 'Bus', 'AND deleted_at IS NULL');
  await assertDriverInOrg(orgId, driverId);

  if (isActive) {
    const conflict = await query(
      `SELECT id FROM route_assignments
       WHERE organization_id = $1 AND is_active = TRUE
         AND (bus_id = $2 OR driver_id = $3)`,
      [orgId, busId, driverId],
    );
    if (conflict.rowCount > 0) {
      throw ApiError.conflict('Bus or driver already has an active assignment');
    }
  }

  const { rows } = await query(
    `INSERT INTO route_assignments
       (organization_id, route_id, bus_id, driver_id, start_date, end_date, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${ASSIGNMENT_RETURNING}`,
    [orgId, routeId, busId, driverId, startDate || null, endDate || null, isActive],
  );
  return rows[0];
};

export const updateAssignment = async (orgId, assignmentId, patch) => {
  const current = await getAssignment(orgId, assignmentId);

  if (patch.busId) await assertEntityInOrg(orgId, 'buses', patch.busId, 'Bus', 'AND deleted_at IS NULL');
  if (patch.driverId) await assertDriverInOrg(orgId, patch.driverId);

  const willBeActive = patch.isActive ?? current.is_active;
  const targetBus = patch.busId ?? current.bus_id;
  const targetDriver = patch.driverId ?? current.driver_id;

  if (willBeActive) {
    const conflict = await query(
      `SELECT id FROM route_assignments
       WHERE organization_id = $1 AND is_active = TRUE AND id <> $2
         AND (bus_id = $3 OR driver_id = $4)`,
      [orgId, assignmentId, targetBus, targetDriver],
    );
    if (conflict.rowCount > 0) {
      throw ApiError.conflict('Bus or driver already has another active assignment');
    }
  }

  const map = {
    busId: 'bus_id',
    driverId: 'driver_id',
    startDate: 'start_date',
    endDate: 'end_date',
    isActive: 'is_active',
  };
  const fields = [];
  const params = [];
  for (const [key, col] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      params.push(patch[key]);
      fields.push(`${col} = $${params.length}`);
    }
  }
  params.push(assignmentId, orgId);
  const { rows } = await query(
    `UPDATE route_assignments SET ${fields.join(', ')}
     WHERE id = $${params.length - 1} AND organization_id = $${params.length}
     RETURNING ${ASSIGNMENT_RETURNING}`,
    params,
  );
  return rows[0];
};

export const deactivateAssignment = async (orgId, assignmentId) => {
  await getAssignment(orgId, assignmentId);
  await query(
    `UPDATE route_assignments SET is_active = FALSE, end_date = COALESCE(end_date, CURRENT_DATE)
     WHERE id = $1 AND organization_id = $2`,
    [assignmentId, orgId],
  );
  return { success: true };
};

export const deleteAssignment = async (orgId, assignmentId) => {
  await getAssignment(orgId, assignmentId);
  await query(
    `DELETE FROM route_assignments WHERE id = $1 AND organization_id = $2`,
    [assignmentId, orgId],
  );
  return { success: true };
};
