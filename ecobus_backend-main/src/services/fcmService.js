/**
 * FCM (Firebase Cloud Messaging) push sender.
 *
 * Initialises firebase-admin lazily from one of:
 *   - FIREBASE_SERVICE_ACCOUNT       → full JSON service-account string
 *   - FIREBASE_SERVICE_ACCOUNT_BASE64 → base64-encoded JSON
 *   - GOOGLE_APPLICATION_CREDENTIALS → path to a JSON file (firebase default)
 *
 * If none are present we keep the previous logging-only behaviour so dev
 * environments keep working without credentials.
 *
 * Contract:
 *   sendToUser(userId, { title, body, data? })
 *   sendToUsers([userIds], { title, body, data? })
 *
 * Returns { sent, failed, skipped, devices, pruned } so callers can record
 * delivery stats.  Invalid / unregistered tokens are automatically revoked
 * in `device_tokens` so we stop targeting dead devices.
 */
import { query } from '../config/db.js';
import { logger } from '../utils/logger.js';

let adminPromise = null;
let adminMod = null;
let adminEnabled = false;

const loadServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try { return JSON.parse(raw); }
    catch (e) { logger.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON', { err: e.message }); }
  }
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64) {
    try { return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')); }
    catch (e) { logger.error('FIREBASE_SERVICE_ACCOUNT_BASE64 invalid', { err: e.message }); }
  }
  return null;
};

const initAdmin = async () => {
  if (adminPromise) return adminPromise;
  adminPromise = (async () => {
    try {
      const mod = await import('firebase-admin');
      const admin = mod.default || mod;
      if (!admin.apps?.length) {
        const sa = loadServiceAccount();
        if (sa) {
          admin.initializeApp({ credential: admin.credential.cert(sa) });
        } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          admin.initializeApp({ credential: admin.credential.applicationDefault() });
        } else {
          logger.warn('fcm: no Firebase credentials configured — running in stub mode');
          return null;
        }
      }
      adminEnabled = true;
      adminMod = admin;
      logger.info('fcm: firebase-admin initialised');
      return admin;
    } catch (err) {
      logger.warn('fcm: firebase-admin unavailable — running in stub mode', { err: err.message });
      return null;
    }
  })();
  return adminPromise;
};

const loadActiveTokens = async (userIds) => {
  if (!userIds.length) return [];
  const { rows } = await query(
    `SELECT id, user_id, token, platform
     FROM device_tokens
     WHERE user_id = ANY($1::uuid[]) AND revoked_at IS NULL`,
    [userIds],
  );
  return rows;
};

const revokeTokenIds = async (ids) => {
  if (!ids.length) return;
  await query(
    `UPDATE device_tokens SET revoked_at = NOW() WHERE id = ANY($1::uuid[])`,
    [ids],
  );
};

const INVALID_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

export const sendToUsers = async (userIds, payload) => {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return { sent: 0, failed: 0, skipped: 0, devices: 0, pruned: 0 };

  const tokens = await loadActiveTokens(ids);
  if (!tokens.length) {
    logger.info('fcm: no device tokens for recipients', { recipients: ids.length });
    return { sent: 0, failed: 0, skipped: ids.length, devices: 0, pruned: 0 };
  }

  const admin = await initAdmin();

  // Stub mode — just log + bump last_seen
  if (!admin || !adminEnabled) {
    logger.info('fcm.stub: would send push', {
      recipients: ids.length, devices: tokens.length, title: payload?.title,
    });
    await query(
      `UPDATE device_tokens SET last_seen_at = NOW() WHERE id = ANY($1::uuid[])`,
      [tokens.map((t) => t.id)],
    );
    return { sent: 0, failed: 0, skipped: tokens.length, devices: tokens.length, pruned: 0 };
  }

  // Build a multicast message. FCM allows up to 500 tokens per call; chunk just in case.
  const data = Object.fromEntries(
    Object.entries(payload?.data || {}).map(([k, v]) => [k, String(v ?? '')]),
  );
  const baseMsg = {
    notification: { title: payload?.title || '', body: payload?.body || '' },
    data,
    android: { priority: 'high', notification: { sound: 'default', channelId: 'ecobus_default' } },
    apns: { payload: { aps: { sound: 'default' } } },
  };

  let sent = 0, failed = 0;
  const toRevoke = [];
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

  for (const chunk of chunks) {
    try {
      const resp = await adminMod.messaging().sendEachForMulticast({
        ...baseMsg,
        tokens: chunk.map((t) => t.token),
      });
      sent += resp.successCount;
      failed += resp.failureCount;
      resp.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code || '';
          logger.warn('fcm: send failed', { code, msg: r.error?.message });
          if (INVALID_CODES.has(code)) toRevoke.push(chunk[i].id);
        }
      });
    } catch (err) {
      failed += chunk.length;
      logger.error('fcm: multicast threw', { err: err.message });
    }
  }

  if (toRevoke.length) await revokeTokenIds(toRevoke);
  await query(
    `UPDATE device_tokens SET last_seen_at = NOW() WHERE id = ANY($1::uuid[])`,
    [tokens.map((t) => t.id)],
  );

  return { sent, failed, skipped: 0, devices: tokens.length, pruned: toRevoke.length };
};

export const sendToUser = (userId, payload) => sendToUsers([userId], payload);
