/**
 * Children management service.
 *
 * Children belong to an organization and may optionally be linked to a parent
 * user (with role 'parent') and to one or more routes via child_routes.
 *
 * All queries enforce tenant isolation via organization_id.
 */
import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

const CHILD_COLUMNS = `
  id, organization_id, first_name, last_name, date_of_birth,
  parent_id, created_at, updated_at
`;

const assertParentInOrg = async (orgId, parentId) => {
  if (!parentId) return;
  const { rows } = await query(
    `SELECT u.id
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1 AND u.organization_id = $2
       AND u.deleted_at IS NULL AND r.name = 'parent'`,
    [parentId, orgId],
  );
  if (!rows[0]) throw ApiError.badRequest('Parent must be an active user with the "parent" role in this organization');
};

const assertRouteInOrg = async (orgId, routeId) => {
  const { rows } = await query(
    `SELECT id FROM routes WHERE id = $1 AND organization_id = $2`,
    [routeId, orgId],
  );
  if (!rows[0]) throw ApiError.badRequest('Route does not belong to this organization');
};

const assertStopOnRoute = async (routeId, stopId) => {
  if (!stopId) return;
  const { rows } = await query(
    `SELECT id FROM route_stops WHERE id = $1 AND route_id = $2`,
    [stopId, routeId],
  );
  if (!rows[0]) throw ApiError.badRequest('Stop does not belong to the specified route');
};

export const list = async (orgId, { search, parentId, routeId, limit = 100, offset = 0 } = {}, viewer = {}) => {
  const params = [orgId];
  const where = ['c.organization_id = $1', 'c.deleted_at IS NULL'];
  let join = '';

  // Parent scoping: if the caller is a parent (and not also a manager/admin),
  // they may only see their own children — even if they pass a different
  // parentId in the query.
  const roles = viewer.roles || [];
  const isParentOnly = roles.includes('parent')
    && !roles.some((r) => ['admin', 'school_manager', 'super_admin'].includes(r));
  if (isParentOnly) {
    params.push(viewer.id);
    where.push(`c.parent_id = $${params.length}`);
  } else if (parentId) {
    params.push(parentId);
    where.push(`c.parent_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(c.first_name) LIKE $${params.length} OR LOWER(c.last_name) LIKE $${params.length})`);
  }
  if (routeId) {
    join = 'JOIN child_routes cr ON cr.child_id = c.id';
    params.push(routeId);
    where.push(`cr.route_id = $${params.length}`);
  }
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT DISTINCT
       c.id, c.organization_id, c.first_name, c.last_name, c.date_of_birth,
       c.parent_id, c.created_at, c.updated_at
     FROM children c
     ${join}
     WHERE ${where.join(' AND ')}
     ORDER BY c.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
};

export const getById = async (orgId, childId, viewer = {}) => {
  const { rows } = await query(
    `SELECT ${CHILD_COLUMNS} FROM children
     WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
    [childId, orgId],
  );
  if (!rows[0]) throw ApiError.notFound('Child not found');

  const roles = viewer.roles || [];
  const isParentOnly = roles.includes('parent')
    && !roles.some((r) => ['admin', 'school_manager', 'super_admin'].includes(r));
  if (isParentOnly && rows[0].parent_id !== viewer.id) {
    throw ApiError.forbidden('Parents may only access their own children');
  }

  const routes = await query(
    `SELECT cr.id, cr.route_id, r.name AS route_name,
            cr.pickup_stop_id, ps.name AS pickup_stop_name,
            cr.dropoff_stop_id, ds.name AS dropoff_stop_name
     FROM child_routes cr
     JOIN routes r ON r.id = cr.route_id
     LEFT JOIN route_stops ps ON ps.id = cr.pickup_stop_id
     LEFT JOIN route_stops ds ON ds.id = cr.dropoff_stop_id
     WHERE cr.child_id = $1`,
    [childId],
  );
  return { ...rows[0], routes: routes.rows };
};

export const create = async (orgId, input) => {
  const { firstName, lastName, dateOfBirth, parentId } = input;
  await assertParentInOrg(orgId, parentId);

  const { rows } = await query(
    `INSERT INTO children (organization_id, first_name, last_name, date_of_birth, parent_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${CHILD_COLUMNS}`,
    [orgId, firstName, lastName, dateOfBirth || null, parentId || null],
  );
  return rows[0];
};

export const update = async (orgId, childId, patch) => {
  await getById(orgId, childId);
  if (patch.parentId) await assertParentInOrg(orgId, patch.parentId);

  const map = {
    firstName: 'first_name',
    lastName: 'last_name',
    dateOfBirth: 'date_of_birth',
    parentId: 'parent_id',
  };
  const fields = [];
  const params = [];
  for (const [key, col] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      params.push(patch[key]);
      fields.push(`${col} = $${params.length}`);
    }
  }
  params.push(childId, orgId);
  await query(
    `UPDATE children SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length - 1} AND organization_id = $${params.length}`,
    params,
  );
  return getById(orgId, childId);
};

export const remove = async (orgId, childId) => {
  await getById(orgId, childId);
  await query(
    `UPDATE children SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [childId, orgId],
  );
  return { success: true };
};

export const assignRoute = async (orgId, childId, { routeId, pickupStopId, dropoffStopId }) => {
  await getById(orgId, childId);
  await assertRouteInOrg(orgId, routeId);
  await assertStopOnRoute(routeId, pickupStopId);
  await assertStopOnRoute(routeId, dropoffStopId);

  return withTransaction(async (c) => {
    const dup = await c.query(
      `SELECT id FROM child_routes WHERE child_id = $1 AND route_id = $2`,
      [childId, routeId],
    );
    if (dup.rowCount > 0) throw ApiError.conflict('Child is already assigned to this route');

    const { rows } = await c.query(
      `INSERT INTO child_routes (child_id, route_id, pickup_stop_id, dropoff_stop_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, child_id, route_id, pickup_stop_id, dropoff_stop_id, created_at`,
      [childId, routeId, pickupStopId || null, dropoffStopId || null],
    );
    return rows[0];
  });
};

export const unassignRoute = async (orgId, childId, childRouteId) => {
  await getById(orgId, childId);
  const { rowCount } = await query(
    `DELETE FROM child_routes WHERE id = $1 AND child_id = $2`,
    [childRouteId, childId],
  );
  if (!rowCount) throw ApiError.notFound('Child-route assignment not found');
  return { success: true };
};
