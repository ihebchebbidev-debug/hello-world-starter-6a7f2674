/**
 * Child absences service.
 *
 * Parents (and managers) can declare a child absent for one or more days so
 * that the bus skips the stop. All queries are tenant-scoped via
 * organization_id, and parent users only see absences for children they own.
 */
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

const COLS = `
  id, organization_id, child_id, parent_id,
  start_date, end_date, reason, note, cancelled_at,
  created_at, updated_at
`;

const isParent = (user) => Array.isArray(user.roles) && user.roles.includes('parent') && !user.roles.some((r) => ['admin', 'super_admin', 'school_manager'].includes(r));

async function assertChildVisible(user, childId) {
  const params = [childId, user.organizationId || user.organization_id];
  let sql = `SELECT id, parent_id FROM children WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`;
  const { rows } = await query(sql, params);
  const child = rows[0];
  if (!child) throw ApiError.notFound('Child not found');
  if (isParent(user) && String(child.parent_id) !== String(user.id)) {
    throw ApiError.forbidden('Not your child');
  }
}

export async function listForChild(user, childId, { from, to } = {}) {
  await assertChildVisible(user, childId);
  const params = [childId];
  let where = `child_id = $1`;
  if (from) { params.push(from); where += ` AND end_date >= $${params.length}`; }
  if (to)   { params.push(to);   where += ` AND start_date <= $${params.length}`; }
  const { rows } = await query(
    `SELECT ${COLS} FROM child_absences WHERE ${where} ORDER BY start_date DESC LIMIT 200`,
    params,
  );
  return rows;
}

export async function listForUser(user, { from, to } = {}) {
  const orgId = user.organizationId || user.organization_id;
  const params = [orgId];
  let sql = `SELECT a.* FROM child_absences a
             JOIN children c ON c.id = a.child_id
             WHERE a.organization_id = $1 AND c.deleted_at IS NULL`;
  if (isParent(user)) {
    params.push(user.id);
    sql += ` AND c.parent_id = $${params.length}`;
  }
  if (from) { params.push(from); sql += ` AND a.end_date >= $${params.length}`; }
  if (to)   { params.push(to);   sql += ` AND a.start_date <= $${params.length}`; }
  sql += ` ORDER BY a.start_date DESC LIMIT 500`;
  const { rows } = await query(sql, params);
  return rows;
}

export async function create(user, childId, payload) {
  await assertChildVisible(user, childId);
  const orgId = user.organizationId || user.organization_id;
  const { startDate, endDate, reason = 'other', note = null } = payload;
  if (!startDate || !endDate) throw ApiError.badRequest('startDate and endDate required');
  if (new Date(endDate) < new Date(startDate)) throw ApiError.badRequest('endDate must be >= startDate');
  const { rows } = await query(
    `INSERT INTO child_absences (organization_id, child_id, parent_id, start_date, end_date, reason, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${COLS}`,
    [orgId, childId, user.id, startDate, endDate, reason, note],
  );
  return rows[0];
}

export async function cancel(user, absenceId) {
  const orgId = user.organizationId || user.organization_id;
  const { rows } = await query(
    `SELECT a.id, a.parent_id, c.parent_id AS child_parent
     FROM child_absences a
     JOIN children c ON c.id = a.child_id
     WHERE a.id = $1 AND a.organization_id = $2`,
    [absenceId, orgId],
  );
  const abs = rows[0];
  if (!abs) throw ApiError.notFound('Absence not found');
  if (isParent(user) && String(abs.child_parent) !== String(user.id)) {
    throw ApiError.forbidden('Not your absence');
  }
  const upd = await query(
    `UPDATE child_absences SET cancelled_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING ${COLS}`,
    [absenceId],
  );
  return upd.rows[0];
}
