/**
 * User management service.
 *
 * All operations are scoped to the caller's organization to enforce
 * multi-tenant isolation. Role checks happen in the route layer via
 * requireRole middleware.
 */
import bcrypt from 'bcrypt';
import { query, withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const userColumns = `
  u.id, u.organization_id, u.email, u.first_name, u.last_name, u.phone,
  u.is_active, u.created_at, u.updated_at,
  COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
`;

const baseSelect = `
  SELECT ${userColumns}
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
`;

export const listUsers = async (orgId, { search, role, limit = 50, offset = 0 } = {}) => {
  const params = [orgId];
  const where = ['u.organization_id = $1', 'u.deleted_at IS NULL'];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(u.email) LIKE $${params.length}
                OR LOWER(u.first_name) LIKE $${params.length}
                OR LOWER(u.last_name) LIKE $${params.length})`);
  }

  let havingRole = '';
  if (role) {
    params.push(role);
    havingRole = `HAVING $${params.length} = ANY(array_agg(r.name))`;
  }

  params.push(limit, offset);
  const sql = `
    ${baseSelect}
    WHERE ${where.join(' AND ')}
    GROUP BY u.id
    ${havingRole}
    ORDER BY u.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const { rows } = await query(sql, params);
  return rows;
};

export const getUserById = async (orgId, userId) => {
  const { rows } = await query(
    `${baseSelect}
     WHERE u.organization_id = $1 AND u.id = $2 AND u.deleted_at IS NULL
     GROUP BY u.id`,
    [orgId, userId],
  );
  if (!rows[0]) throw ApiError.notFound('User not found');
  return rows[0];
};

export const createUser = async (orgId, input) => {
  const { firstName, lastName, email, phone, password, roles } = input;

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) throw ApiError.conflict('Email already registered');

  const hash = await bcrypt.hash(password, env.bcryptRounds);

  const newUserId = await withTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO users (organization_id, first_name, last_name, email, phone, password_hash, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING id`,
      [orgId, firstName, lastName, email, phone || null, hash],
    );
    const userId = rows[0].id;

    for (const roleName of roles) {
      // Auto-create the role row if missing so a fresh (un-seeded) DB still works.
      let r = await c.query('SELECT id FROM roles WHERE name = $1', [roleName]);
      if (!r.rows[0]) {
        r = await c.query(
          `INSERT INTO roles (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [roleName],
        );
      }
      await c.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [userId, r.rows[0].id],
      );
    }
    return userId;
  });

  // Re-fetch AFTER the transaction commits — getUserById() runs on a separate
  // pool connection and would not see the uncommitted INSERT otherwise
  // (this caused the "User not found" regression on driver/parent creation).
  return getUserById(orgId, newUserId);
};

export const updateUser = async (orgId, userId, patch) => {
  // ensure user belongs to caller's org
  await getUserById(orgId, userId);

  const fields = [];
  const params = [];
  const map = {
    firstName: 'first_name',
    lastName: 'last_name',
    phone: 'phone',
    isActive: 'is_active',
  };
  for (const [key, col] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      params.push(patch[key]);
      fields.push(`${col} = $${params.length}`);
    }
  }

  if (fields.length > 0) {
    params.push(userId, orgId);
    await query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}`,
      params,
    );
  }

  if (patch.roles) {
    await withTransaction(async (c) => {
      await c.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      for (const roleName of patch.roles) {
        const r = await c.query('SELECT id FROM roles WHERE name = $1', [roleName]);
        if (!r.rows[0]) throw ApiError.badRequest(`Unknown role: ${roleName}`);
        await c.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)',
          [userId, r.rows[0].id],
        );
      }
    });
  }

  return getUserById(orgId, userId);
};

export const deactivateUser = async (orgId, userId, callerId) => {
  if (userId === callerId) throw ApiError.badRequest('You cannot deactivate yourself');
  await getUserById(orgId, userId);
  await query(
    `UPDATE users SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2`,
    [userId, orgId],
  );
  return { success: true };
};

export const deleteUser = async (orgId, userId, callerId) => {
  if (userId === callerId) throw ApiError.badRequest('You cannot delete yourself');
  await getUserById(orgId, userId);
  await query(
    `UPDATE users SET deleted_at = NOW(), is_active = FALSE
     WHERE id = $1 AND organization_id = $2`,
    [userId, orgId],
  );
  return { success: true };
};

export const updateOwnProfile = async (userId, patch) => {
  const fields = [];
  const params = [];
  const map = { firstName: 'first_name', lastName: 'last_name', phone: 'phone' };
  for (const [key, col] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      params.push(patch[key]);
      fields.push(`${col} = $${params.length}`);
    }
  }
  if (!fields.length) throw ApiError.badRequest('No fields to update');
  params.push(userId);
  await query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}`,
    params,
  );
  const { rows } = await query(
    `${baseSelect} WHERE u.id = $1 GROUP BY u.id`,
    [userId],
  );
  return rows[0];
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const { rows } = await query(
    'SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
    [userId],
  );
  if (!rows[0]) throw ApiError.notFound('User not found');

  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash || '');
  if (!ok) throw ApiError.unauthorized('Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [hash, userId],
  );
  return { success: true };
};

export const adminResetPassword = async (orgId, userId, newPassword) => {
  await getUserById(orgId, userId);
  const hash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3',
    [hash, userId, orgId],
  );
  return { success: true };
};

export const listRoles = async () => {
  const { rows } = await query('SELECT id, name FROM roles ORDER BY name');
  return rows;
};
