/**
 * Per-user notification preferences. One row per user (PK = user_id).
 * Missing rows are returned as defaults so the mobile UI can render
 * immediately on first run without a separate "create" round-trip.
 */
import { query } from '../config/db.js';

const DEFAULTS = {
  master: true,
  boarded: true,
  droppedOff: true,
  etaReminder: true,
  delay: true,
  routeChange: true,
  quietHours: false,
  quietFrom: '22:00',
  quietTo: '07:00',
};

const toCamel = (row) => ({
  master:       row.master,
  boarded:      row.boarded,
  droppedOff:   row.dropped_off,
  etaReminder:  row.eta_reminder,
  delay:        row.delay,
  routeChange:  row.route_change,
  quietHours:   row.quiet_hours,
  quietFrom:    row.quiet_from,
  quietTo:      row.quiet_to,
  updatedAt:    row.updated_at,
});

export const getForUser = async (userId) => {
  const { rows } = await query(
    `SELECT user_id, master, boarded, dropped_off, eta_reminder, delay,
            route_change, quiet_hours, quiet_from, quiet_to, updated_at
       FROM notification_preferences WHERE user_id = $1`,
    [userId],
  );
  if (!rows[0]) return { ...DEFAULTS, updatedAt: null };
  return toCamel(rows[0]);
};

/**
 * Upsert preferences. Any field omitted from `patch` is left untouched
 * (or, on first insert, falls back to its DB default).
 */
export const upsertForUser = async (userId, patch = {}) => {
  // Map camelCase patch → snake_case columns. Only known keys are persisted.
  const map = {
    master:       'master',
    boarded:      'boarded',
    droppedOff:   'dropped_off',
    etaReminder:  'eta_reminder',
    delay:        'delay',
    routeChange:  'route_change',
    quietHours:   'quiet_hours',
    quietFrom:    'quiet_from',
    quietTo:      'quiet_to',
  };
  const cols = [];
  const vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      cols.push(col);
      vals.push(patch[k]);
    }
  }

  if (cols.length === 0) return getForUser(userId);

  const insertCols = ['user_id', ...cols].join(', ');
  const insertPh   = ['$1', ...cols.map((_, i) => `$${i + 2}`)].join(', ');
  const updateSet  = cols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');

  await query(
    `INSERT INTO notification_preferences (${insertCols})
     VALUES (${insertPh})
     ON CONFLICT (user_id) DO UPDATE
       SET ${updateSet}, updated_at = NOW()`,
    [userId, ...vals],
  );
  return getForUser(userId);
};
