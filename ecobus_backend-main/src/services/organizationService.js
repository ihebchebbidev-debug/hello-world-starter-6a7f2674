/**
 * Organization (school / tenant) service.
 *
 * Visibility rules:
 *   - super_admin: full CRUD across all organizations.
 *   - everyone else: can only read their own organization (handled in route layer).
 *
 * Soft-delete via deleted_at.
 */
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

const COLUMNS = `
  id, name, contact_email, phone, address,
  subscription_plan, subscription_status,
  created_at, updated_at
`;

export const list = async ({ search, status, limit = 50, offset = 0 } = {}) => {
  const params = [];
  const where = ['deleted_at IS NULL'];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(name) LIKE $${params.length} OR LOWER(contact_email) LIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    where.push(`subscription_status = $${params.length}`);
  }
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT ${COLUMNS} FROM organizations
     WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
};

export const getById = async (orgId) => {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
    [orgId],
  );
  if (!rows[0]) throw ApiError.notFound('Organization not found');
  return rows[0];
};

export const create = async (input) => {
  const { name, contactEmail, phone, address, subscriptionPlan } = input;
  const { rows } = await query(
    `INSERT INTO organizations
       (name, contact_email, phone, address, subscription_plan, subscription_status)
     VALUES ($1, $2, $3, $4, COALESCE($5, 'starter'), 'trial')
     RETURNING ${COLUMNS}`,
    [name, contactEmail || null, phone || null, address || null, subscriptionPlan || null],
  );
  return rows[0];
};

export const update = async (orgId, patch) => {
  await getById(orgId);
  const map = {
    name: 'name',
    contactEmail: 'contact_email',
    phone: 'phone',
    address: 'address',
    subscriptionPlan: 'subscription_plan',
  };
  const fields = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      params.push(patch[k]);
      fields.push(`${col} = $${params.length}`);
    }
  }
  params.push(orgId);
  const { rows } = await query(
    `UPDATE organizations SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}
     RETURNING ${COLUMNS}`,
    params,
  );
  return rows[0];
};

export const remove = async (orgId) => {
  await getById(orgId);
  await query(
    `UPDATE organizations SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [orgId],
  );
  return { success: true };
};
