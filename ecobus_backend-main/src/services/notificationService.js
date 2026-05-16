import { query } from '../config/db.js';
import { getIO } from '../sockets/io.js';
import * as fcm from './fcmService.js';

export const listForUser = (userId) =>
  query(
    `SELECT id, title, message, type, is_read, created_at
     FROM notifications WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 100`,
    [userId],
  ).then((r) => r.rows);

export const markRead = (id, userId) =>
  query(
    `UPDATE notifications SET is_read = TRUE
     WHERE id = $1 AND user_id = $2 RETURNING id, is_read`,
    [id, userId],
  ).then((r) => r.rows[0]);

/**
 * Mark every unread notification belonging to `userId` as read in one
 * round-trip. Returns the affected row count for the UX badge.
 */
export const markAllRead = (userId) =>
  query(
    `UPDATE notifications SET is_read = TRUE
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId],
  ).then((r) => ({ updated: r.rowCount }));

export const create = ({ userId, title, message, type, organizationId }) =>
  query(
    `INSERT INTO notifications (user_id, organization_id, title, message, type)
     VALUES ($1, COALESCE($2, (SELECT organization_id FROM users WHERE id = $1)), $3, $4, $5)
     RETURNING id, user_id, organization_id, title, message, type, is_read, created_at`,
    [userId, organizationId || null, title, message, type || 'info'],
  ).then((r) => r.rows[0]);

/**
 * Bulk-insert notifications in a single round-trip.
 * Use this for fan-outs (stop arrivals, SOS, delays) so we don't issue
 * N inserts per event. Silently ignores empty input.
 *
 * @param {Array<{userId:string,title:string,message:string,type?:string}>} items
 */
export const createMany = async (items) => {
  if (!items || items.length === 0) return [];
  const values = [];
  const params = [];
  items.forEach((it, i) => {
    const o = i * 5;
    values.push(`($${o + 1},COALESCE($${o + 2}, (SELECT organization_id FROM users WHERE id = $${o + 1})),$${o + 3},$${o + 4},$${o + 5})`);
    params.push(it.userId, it.organizationId || null, it.title, it.message, it.type || 'info');
  });
  const { rows } = await query(
    `INSERT INTO notifications (user_id, organization_id, title, message, type)
     VALUES ${values.join(',')}
     RETURNING id, user_id, organization_id, title, message, type, is_read, created_at`,
    params,
  );
  return rows;
};

/**
 * Resolve recipient user IDs from a flexible target:
 *   { userIds: [...] }                          → explicit user IDs
 *   { roles: ['parent','driver'], organizationId } → all users in org with any of those roles
 *   { organizationId }                          → every user in that organization
 *   { all: true }   (super_admin only)          → every user in the system
 */
const resolveRecipients = async (target = {}) => {
  if (Array.isArray(target.userIds) && target.userIds.length) {
    return [...new Set(target.userIds)];
  }
  if (target.all === true) {
    const { rows } = await query(`SELECT id FROM users WHERE is_active = TRUE`);
    return rows.map((r) => r.id);
  }
  const params = [];
  const where = ['u.is_active = TRUE'];
  if (target.organizationId) {
    params.push(target.organizationId);
    where.push(`u.organization_id = $${params.length}`);
  }
  if (Array.isArray(target.roles) && target.roles.length) {
    params.push(target.roles);
    where.push(`EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = u.id AND ur.role::text = ANY($${params.length}::text[])
    )`);
  }
  const { rows } = await query(
    `SELECT u.id FROM users u WHERE ${where.join(' AND ')}`,
    params,
  );
  return rows.map((r) => r.id);
};

/**
 * Broadcast a notification: insert one row per recipient, push via FCM,
 * and emit a realtime `notification.new` event to each user's socket room.
 *
 * @param {Object} input
 * @param {{userIds?:string[],roles?:string[],organizationId?:string,all?:boolean}} input.target
 * @param {string} input.title
 * @param {string} input.message
 * @param {string} [input.type='info']
 * @param {Object} [input.data]   extra key/value payload forwarded to FCM
 * @param {string} [input.organizationId] org to stamp on the row
 */
export const broadcast = async ({ target, title, message, type = 'info', data, organizationId }) => {
  const userIds = await resolveRecipients({ ...target, organizationId: target?.organizationId || organizationId });
  if (!userIds.length) {
    return { recipients: 0, inserted: 0, push: { sent: 0, failed: 0, skipped: 0, devices: 0, pruned: 0 } };
  }

  const items = userIds.map((userId) => ({ userId, title, message, type, organizationId }));
  const inserted = await createMany(items);

  // Realtime fan-out (in-app)
  try {
    const io = getIO();
    if (io) {
      const ns = io.of('/ws');
      inserted.forEach((row) => ns.to(`user:${row.user_id}`).emit('notification.new', row));
    }
  } catch (err) {
    // non-fatal — push still goes out
  }

  // Push fan-out
  const push = await fcm.sendToUsers(userIds, {
    title,
    body: message,
    data: { type, ...(data || {}) },
  });

  return { recipients: userIds.length, inserted: inserted.length, push };
};
