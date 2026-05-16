/**
 * REAL API — Parent app, hardcoded backend at https://busapi.ihebchebbi.pro
 * Same exported surface as the legacy mock so screens are unaffected.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { localEta, distanceKm, etaMinutes } from '../utils/geo';

export const BASE_URL    = 'https://busapi.ihebchebbi.pro/api/v1';
export const IS_MOCK_API = false;

const ACCESS_KEY  = '@ecobus/access';
const REFRESH_KEY = '@ecobus/refresh';
const USER_KEY    = '@ecobus/user';
const LOCALE_KEY  = '@ecobus/locale';

/* Set default locale once (don't wipe tokens — keeps real sessions). */
AsyncStorage.getItem(LOCALE_KEY).then((lng) => {
  if (!lng) AsyncStorage.setItem(LOCALE_KEY, 'fr');
});

/* ─── Token helpers ────────────────────────────────────────── */
export const Auth = {
  getAccessToken : () => AsyncStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => AsyncStorage.getItem(REFRESH_KEY),
  setTokens: async ({ accessToken, refreshToken } = {}) => {
    if (accessToken)  await AsyncStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) await AsyncStorage.setItem(REFRESH_KEY, refreshToken);
  },
  setToken: (t) => AsyncStorage.setItem(ACCESS_KEY, t),
  setUser : (u) => AsyncStorage.setItem(USER_KEY, JSON.stringify(u || {})),
  getUser : async () => { try { return JSON.parse(await AsyncStorage.getItem(USER_KEY)); } catch { return null; } },
  clear   : () => AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, USER_KEY]),
};

/* ─── HTTP helper ──────────────────────────────────────────── */
async function http(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const url = `${BASE_URL}${path}`;
  const h   = { 'Content-Type': 'application/json', Accept: 'application/json', ...headers };
  if (auth) {
    const tok = await Auth.getAccessToken();
    if (tok) h.Authorization = `Bearer ${tok}`;
  }
  let res;
  try {
    res = await fetch(url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    const err = new Error('Network error'); err.cause = e; err.network = true; throw err;
  }
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || `HTTP ${res.status}`;
    const err = new Error(msg); err.status = res.status; err.body = json; throw err;
  }
  return json && typeof json === 'object' && 'data' in json ? json.data : json;
}

const looksLikeEmail = (v) => /\S+@\S+\.\S+/.test(String(v || ''));

/* ─── APIs ─────────────────────────────────────────────────── */
export const AuthAPI = {
  async login(email, password) {
    const data = await http('/auth/login', { method: 'POST', auth: false, body: { email, password } });
    const accessToken  = data?.accessToken  || data?.access_token  || data?.token;
    const refreshToken = data?.refreshToken || data?.refresh_token || null;
    const user         = data?.user || null;
    await Auth.setTokens({ accessToken, refreshToken });
    if (user) await Auth.setUser(user);
    return { accessToken, refreshToken, user };
  },
  /**
   * Phone-OTP login. Verifies the SMS code and mints a session in one call.
   * No password — proof of phone ownership is sufficient.
   */
  async loginWithPhone(phone, code) {
    const data = await http('/auth/phone-otp/login', {
      method: 'POST', auth: false, body: { phone, code },
    });
    const accessToken  = data?.accessToken  || data?.access_token  || data?.token;
    const refreshToken = data?.refreshToken || data?.refresh_token || null;
    const user         = data?.user || null;
    await Auth.setTokens({ accessToken, refreshToken });
    if (user) await Auth.setUser(user);
    return { accessToken, refreshToken, user };
  },
  registerParent: async (payload) =>
    http('/auth/register-parent', { method: 'POST', auth: false, body: payload }),
  forgot: async (email) =>
    http('/auth/forgot-password', { method: 'POST', auth: false, body: { email } })
      .catch(() => ({ ok: true })),
  me: async () => {
    try { const u = await http('/auth/me'); if (u) await Auth.setUser(u); return u; }
    catch { return Auth.getUser(); }
  },
  async logout() {
    try {
      const refreshToken = await Auth.getRefreshToken();
      await http('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
    } finally { await Auth.clear(); }
  },
  async deleteMe() {
    try {
      const refreshToken = await Auth.getRefreshToken();
      await http('/auth/me', { method: 'DELETE', body: { refreshToken } }).catch(() => {});
    } finally { await Auth.clear(); }
    return {};
  },
  /* Phone OTP — dev/stub mode: backend returns the code in `devCode` until SMS
     is wired. UI shows it in a "copy & paste" modal. */
  requestPhoneOtp: (phone) =>
    http('/auth/phone-otp/request', { method: 'POST', auth: false, body: { phone } }),
  verifyPhoneOtp: (phone, code) =>
    http('/auth/phone-otp/verify', { method: 'POST', auth: false, body: { phone, code } }),
};

export const ChildrenAPI = {
  list: async () => {
    const r = await http('/children').catch(() => []);
    return Array.isArray(r) ? r : (r?.items || []);
  },
  me  : async () => ChildrenAPI.list(),
  get : async (id) => http(`/children/${id}`).catch(() => null),
};

export const TripsAPI = {
  active: async () => {
    const r = await http('/trips/active').catch(() => []);
    return Array.isArray(r) ? r : (r?.items || []);
  },
  /** Parent-scoped active trips: only trips on routes their children ride. */
  forParent: async () => {
    const r = await http('/trips/for-parent').catch(() => []);
    return Array.isArray(r) ? r : (r?.items || []);
  },
  history: async () => {
    const r = await http('/trips/history').catch(() => []);
    return Array.isArray(r) ? r : (r?.items || []);
  },
  get  : async (id) => http(`/trips/${id}`).catch(() => null),
  /** Returns the single relevant active trip for this parent today. */
  today: async () => {
    const list = await TripsAPI.forParent();
    if (list && list.length) return list[0];
    // Fallback for non-parent or older backend without /trips/for-parent.
    const all = await TripsAPI.active();
    return all[0] || null;
  },
};

export const EtaAPI = {
  /**
   * ETA for a child. We FIRST try a local haversine ("Pythagoras-on-a-sphere")
   * computation from the cached bus live position to the child's pickup stop —
   * this avoids hitting the backend on every Home refresh. If we don't have
   * coords cached yet, we fall back to the server-side endpoint.
   */
  forChild: async (childId, opts = {}) => {
    const { busLive, stop, speedKmh } = opts;
    const local = localEta(busLive, stop, speedKmh ?? busLive?.speed ?? 30);
    if (local) return local;
    return http(`/eta/child/${childId}`).catch(() => ({ etaMinutes: null }));
  },
  /** Pure helpers exposed so screens can compute on the fly without imports. */
  localFromCoords  : localEta,
  distanceFromCoords: distanceKm,
  minutesFromCoords : etaMinutes,
};

export const NotificationsAPI = {
  // Read: silent fallback so the list screen never blanks on transient errors.
  list       : async () => http('/notifications').catch(() => []),
  // Mutations: throw so the UI can show a real French error toast.
  markRead   : async (id) => http(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: async ()   => http('/notifications/read-all', { method: 'PATCH' }),
};

/**
 * Per-user notification preferences. The mobile UI mirrors these flags into
 * AsyncStorage for offline rendering, but the server is the source of truth.
 */
const NOTIF_PREFS_DEFAULTS = {
  master: true, boarded: true, droppedOff: true, etaReminder: true,
  delay: true, routeChange: true,
  quietHours: false, quietFrom: '22:00', quietTo: '07:00',
};
export const NotificationPreferencesAPI = {
  defaults: () => ({ ...NOTIF_PREFS_DEFAULTS }),
  get: async () => {
    const r = await http('/users/me/notification-preferences').catch(() => null);
    return { ...NOTIF_PREFS_DEFAULTS, ...(r || {}) };
  },
  /** Partial update — pass only the keys you actually changed.
   *  Throws on failure so the screen can surface a French error toast. */
  update: async (patch) => {
    const r = await http('/users/me/notification-preferences', { method: 'PUT', body: patch });
    return { ...NOTIF_PREFS_DEFAULTS, ...(r || {}) };
  },
};

export const BusesAPI = {
  get : async (id) => http(`/buses/${id}`).catch(() => null),
  live: async (id) => {
    if (id) {
      const r = await http(`/buses/${id}/live`).catch(() => null);
      if (r) return r;
      return http(`/gps/live/${id}`).catch(() => null);
    }
    return http('/gps/live').catch(() => null);
  },
};

// Random URL-safe id for Idempotency-Key. Same key replayed by retries
// guarantees the backend records the SOS exactly once.
const idemKey = () =>
  (typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`);

export const SosAPI = {
  /**
   * Throws on failure so the SOS screen can show a real error toast (French).
   * Returns { sent: true } only when the backend actually accepted the alert.
   */
  trigger: async (payload = {}) => {
    await http('/sos', { method: 'POST', body: { type: 'parent_emergency', idempotencyKey: idemKey(), ...payload } });
    return { sent: true };
  },
};

export const DevicesAPI = {
  // Mutations throw — caller decides whether to swallow (e.g. push registration
  // shouldn't crash login) or surface the error.
  registerToken: async (tokenOrObj, platform) => {
    const body = typeof tokenOrObj === 'object' && tokenOrObj !== null
      ? { token: tokenOrObj.token, platform: tokenOrObj.platform }
      : { token: tokenOrObj, platform };
    return http('/devices/token', { method: 'POST', body });
  },
  list  : async () => http('/devices').catch(() => []),
  revoke: async (token) => http(`/devices/token/${token}`, { method: 'DELETE' }),
};

export const AbsencesAPI = {
  list: async (childId, range = {}) => {
    if (childId) return AbsencesAPI.listForChild(childId, range);
    const qs = new URLSearchParams();
    if (range.from) qs.set('from', range.from);
    if (range.to)   qs.set('to', range.to);
    const path = qs.toString() ? `/absences?${qs}` : '/absences';
    const r = await http(path).catch(() => []);
    return Array.isArray(r) ? r : (r?.items || []);
  },
  listForChild: async (childId, range = {}) => {
    if (!childId) return [];
    const qs = new URLSearchParams();
    if (range.from) qs.set('from', range.from);
    if (range.to)   qs.set('to', range.to);
    const suffix = qs.toString() ? `?${qs}` : '';
    const r = await http(`/absences/child/${childId}${suffix}`).catch(() => []);
    return Array.isArray(r) ? r : (r?.items || []);
  },
  history: async (childId) => AbsencesAPI.listForChild(childId, {}),
  // Mutations throw — screens already wrap them in try/catch + humanizeError.
  create: async (childId, payload) =>
    http(`/absences/child/${childId}`, { method: 'POST', body: payload }),
  cancel: async (id) =>
    http(`/absences/${id}`, { method: 'DELETE' }),
};

export default { defaults: { baseURL: BASE_URL } };
