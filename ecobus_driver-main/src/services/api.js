/**
 * REAL API — Driver app, hardcoded backend at https://busapi.ihebchebbi.pro
 * Keeps the same exported surface as the legacy mock module so screens don't
 * need changes. MOCK_* constants are kept as DEFAULT/fallback display data
 * while the live endpoints are wired underneath.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL    = 'https://busapi.ihebchebbi.pro/api/v1';
export const IS_MOCK_API = false;

const ACCESS_KEY  = '@ecobus-driver/access';
const REFRESH_KEY = '@ecobus-driver/refresh';
const USER_KEY    = '@ecobus-driver/user';
export const LOCALE_KEY    = '@ecobus-driver/locale';
export const ONBOARDED_KEY = '@ecobus-driver/onboarded';

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
    const err = new Error('Network error');
    err.cause = e; err.network = true;
    throw err;
  }
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }

  if (!res.ok) {
    const msg = json?.error?.message || json?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status; err.body = json;
    throw err;
  }
  // Unwrap envelope { success, data, ... }
  return json && typeof json === 'object' && 'data' in json ? json.data : json;
}

/* ─── Static fallbacks (kept for legacy screen imports) ────── */
export const MOCK_DRIVER = {
  id: 1, name: 'Driver', firstName: 'Driver', lastName: '',
  email: '', phone: '', licenseNumber: '', photoUrl: null,
};
export const MOCK_BUS = {
  id: 'bus', name: 'Bus', busNumber: '—', plate: '—', capacity: 0, model: '—', status: '—',
};
export const MOCK_STOPS = [];
export const MOCK_CHILDREN = [];
// Kept as an empty array for backwards-compat with any old import. The map
// now derives its polyline from real route stops returned by the backend.
export const GPS_ROUTE_WAYPOINTS = [];

export const MOCK_ASSIGNMENT = {
  id: null, routeName: '—', routeId: null, busId: null, driverId: null,
  workStart: '—', workEnd: '—', childrenCount: 0, stops: [], status: 'no_assignment',
};

/* ─── APIs ─────────────────────────────────────────────────── */
export const AuthAPI = {
  async login(email, password) {
    const data = await http('/auth/login', { method: 'POST', auth: false, body: { email, password } });
    const accessToken  = data?.accessToken  || data?.access_token  || data?.token;
    const refreshToken = data?.refreshToken || data?.refresh_token || null;
    const user         = data?.user || data?.driver || null;
    await Auth.setTokens({ accessToken, refreshToken });
    if (user) await Auth.setUser(user);
    return { accessToken, refreshToken, user, driver: user };
  },
  me: async () => {
    try { const u = await http('/auth/me'); if (u) await Auth.setUser(u); return u; }
    catch { return Auth.getUser(); }
  },
  async logout() {
    try {
      const refreshToken = await Auth.getRefreshToken();
      await http('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
    } finally {
      // Reset module-level caches so a different driver signing in on the
      // same device doesn't see the previous user's assignment / trip.
      cachedActiveTrip = null;
      cachedAssignment = null;
      cachedBus = null;
      cachedStops = [];
      cachedRouteChildren = [];
      await Auth.clear();
    }
  },
};

let cachedActiveTrip = null;
let cachedAssignment = null;

export const AssignmentAPI = {
  today: async () => {
    try {
      // Always grab the driver's assignment (bus/route metadata) first so we
      // can start a new trip even when no trip is currently active.
      cachedAssignment = await http('/drivers/me/assignment').catch(() => null);

      const trips = await http('/trips/active').catch(() => []);
      const list  = Array.isArray(trips) ? trips : (trips?.items || []);
      // CRITICAL: /trips/active is org-wide. Filter to the trip that belongs
      // to THIS driver's current assignment so we never surface another
      // driver's trip as our own (was: list[0]).
      const a0 = cachedAssignment || {};
      const myBusId    = a0.bus_id    || a0.busId    || null;
      const myRouteId  = a0.route_id  || a0.routeId  || null;
      const myDriverId = a0.driver_id || a0.driverId || null;
      const matchTrip = (t) => {
        const tBus    = t.busId    ?? t.bus_id;
        const tRoute  = t.routeId  ?? t.route_id;
        const tDriver = t.driverId ?? t.driver_id;
        if (myDriverId && tDriver) return tDriver === myDriverId;
        if (myBusId && tBus)       return tBus === myBusId;
        if (myRouteId && tRoute)   return tRoute === myRouteId;
        return false;
      };
      const trip = list.find(matchTrip) || null;
      cachedActiveTrip = trip;

      if (!trip && !cachedAssignment) {
        return { ...MOCK_ASSIGNMENT, status: 'no_assignment' };
      }
      const a = cachedAssignment || {};
      if (!trip) {
        return {
          id: null,
          routeName: a.route_name || a.routeName || '—',
          routeId  : a.route_id   || a.routeId   || null,
          busId    : a.bus_id     || a.busId     || null,
          driverId : a.driver_id  || a.driverId  || null,
          workStart: '—', workEnd: '—',
          childrenCount: 0,
          stops: [],
          status: 'not_started',
        };
      }
      return {
        id: trip.id,
        routeName: trip.routeName || trip.route_name || trip.route?.name || a.route_name || '—',
        routeId  : trip.routeId   || trip.route_id   || trip.route?.id   || a.route_id   || null,
        busId    : trip.busId     || trip.bus_id     || trip.bus?.id     || a.bus_id     || null,
        driverId : trip.driverId  || trip.driver_id  || a.driver_id     || null,
        workStart: trip.scheduledStart || trip.workStart || '—',
        workEnd  : trip.scheduledEnd   || trip.workEnd   || '—',
        childrenCount: trip.childrenCount || 0,
        stops    : trip.stops || [],
        status   : trip.status === 'in_progress' ? 'in_progress' : (trip.endedAt ? 'completed' : 'in_progress'),
      };
    } catch {
      return { ...MOCK_ASSIGNMENT, status: 'no_assignment' };
    }
  },
  // Throws on failure so the assignment screen can show a real error toast.
  startService: async ({ busId, routeId } = {}) => {
    const a = cachedAssignment || {};
    const finalBus   = busId   || a.bus_id   || a.busId   || null;
    const finalRoute = routeId || a.route_id || a.routeId || null;
    const trip = await http('/trips/start', { method: 'POST', body: { busId: finalBus, routeId: finalRoute } });
    cachedActiveTrip = trip;
    return { id: trip?.id, status: 'in_progress', startedAt: trip?.startedAt || new Date().toISOString() };
  },
  // Throws on failure so the assignment screen can show a real error toast.
  endService: async () => {
    if (cachedActiveTrip?.id) {
      // Valid call: PATCH /trips/:id/end (alias of POST /trips/stop with body).
      await http(`/trips/${cachedActiveTrip.id}/end`, { method: 'PATCH' });
    }
    cachedActiveTrip = null;
    return { status: 'completed', endedAt: new Date().toISOString() };
  },
};

// Random URL-safe id for Idempotency-Key. Same key replayed by retries
// guarantees the backend records the action exactly once.
const idemKey = () =>
  (typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`);

export const BoardingAPI = {
  // Backend checkinSchema: { tripId, childId, status: 'boarded'|'left'|'absent', method }
  // These methods now THROW on failure — the calling screen is responsible for
  // surfacing the error in the UI (toast in French) so we never silently lie
  // about a successful checkin.
  checkIn: async (childId, tripId) => {
    const trip = tripId || cachedActiveTrip?.id;
    await http('/checkins', { method: 'POST', body: { childId, tripId: trip, status: 'boarded', method: 'manual', idempotencyKey: idemKey() } });
    return { childId, status: 'boarded', timestamp: new Date().toISOString() };
  },
  checkOut: async (childId, tripId) => {
    const trip = tripId || cachedActiveTrip?.id;
    await http('/checkins', { method: 'POST', body: { childId, tripId: trip, status: 'left', method: 'manual', idempotencyKey: idemKey() } });
    return { childId, status: 'dropped', timestamp: new Date().toISOString() };
  },
  markAbsent: async (childId, tripId) => {
    const trip = tripId || cachedActiveTrip?.id;
    return http('/checkins', { method: 'POST', body: { childId, tripId: trip, status: 'absent', method: 'manual', idempotencyKey: idemKey() } });
  },
};

export const DevicesAPI = {
  /**
   * Register an FCM/APNs token with the backend so the driver receives push.
   * Accepts either (token, platform) or ({ token, platform }).
   */
  registerToken: async (tokenOrObj, platform) => {
    const body = typeof tokenOrObj === 'string'
      ? { token: tokenOrObj, platform }
      : tokenOrObj;
    return http('/devices/token', { method: 'POST', body });
  },
  list  : async () => http('/devices').catch(() => []),
  revoke: async (token) => http(`/devices/token/${token}`, { method: 'DELETE' }),
};

export const NotificationsAPI = {
  // Read: silent fallback so the screen never blanks on transient errors.
  list       : async () => http('/notifications').catch(() => []),
  // Mutations throw — caller surfaces a French error toast via humanizeError.
  markRead   : async (id) => http(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: async ()   => http('/notifications/read-all', { method: 'PATCH' }),
};

export const SosAPI = {
  // Throws on failure so the SOS screen can show a real error toast (French).
  // We never want to silently pretend an emergency was sent when it wasn't.
  trigger: async (payload = {}) =>
    http('/sos', { method: 'POST', body: { type: 'driver_emergency', idempotencyKey: idemKey(), ...payload } }),
};

export const GpsAPI = {
  push: async ({ busId, lat, lng, speed, heading, tripId } = {}) => {
    const trip = tripId || cachedActiveTrip?.id || undefined;
    return http('/gps/location', {
      method: 'POST',
      body: {
        busId,
        ...(trip ? { tripId: trip } : {}),
        latitude: lat,
        longitude: lng,
        speed,
        heading,
        recordedAt: new Date().toISOString(),
      },
    }).catch(() => ({}));
  },
};

/* ─── Profile / Bus / Route / Children helpers ─────────────── */
let cachedBus = null;
let cachedStops = [];
let cachedRouteChildren = [];

export const MeAPI = {
  /**
   * Returns a fully-hydrated driver profile composed from /auth/me +
   * /drivers/me/assignment + /buses/:id. Falls back to whatever subset
   * succeeds so screens never crash. Cached objects are reused by other
   * screens to keep the API call count flat.
   */
  profile: async () => {
    const [user, assignment] = await Promise.all([
      AuthAPI.me().catch(() => null),
      AssignmentAPI.today().catch(() => null),
    ]);
    const bus = assignment?.busId
      ? await http(`/buses/${assignment.busId}`).catch(() => null)
      : null;
    cachedBus = bus || cachedBus;
    return {
      driver: {
        id        : user?.id ?? null,
        name      : [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.name || user?.email || '—',
        firstName : user?.firstName || '',
        lastName  : user?.lastName  || '',
        email     : user?.email     || '',
        phone     : user?.phone     || '—',
        licenseNumber: user?.licenseNumber || user?.license_number || '—',
        photoUrl  : user?.photoUrl  || user?.avatar_url || null,
      },
      bus: bus ? {
        id        : bus.id,
        name      : bus.name || `Bus ${bus.busNumber || bus.bus_number || ''}`.trim(),
        busNumber : bus.busNumber  || bus.bus_number  || '—',
        plate     : bus.plate      || bus.plate_number || '—',
        capacity  : bus.capacity   || 0,
        model     : bus.model      || '—',
        status    : bus.status     || '—',
      } : { id: null, name: '—', busNumber: '—', plate: '—', capacity: 0, model: '—', status: '—' },
      assignment,
    };
  },
};

export const RoutesAPI = {
  stops: async (routeId) => {
    if (!routeId) return [];
    const list = await http(`/routes/${routeId}/stops`).catch(() => []);
    const arr = Array.isArray(list) ? list : (list?.items || []);
    cachedStops = arr.map((s, idx) => ({
      id           : s.id,
      name         : s.name,
      shortName    : s.shortName || s.short_name || s.name,
      latitude     : Number(s.latitude  ?? s.lat),
      longitude    : Number(s.longitude ?? s.lng),
      scheduledTime: s.plannedTime || s.planned_time || s.scheduledTime || '—',
      stopOrder    : s.stopOrder || s.stop_order || idx,
      isSchool     : !!(s.isSchool || s.is_school),
    }));
    return cachedStops;
  },
  cachedStops: () => cachedStops,
};

export const ChildrenAPI = {
  byRoute: async (routeId) => {
    if (!routeId) return [];
    const list = await http(`/children?routeId=${encodeURIComponent(routeId)}`).catch(() => []);
    const arr = Array.isArray(list) ? list : (list?.items || []);
    cachedRouteChildren = arr.map((c) => ({
      id            : c.id,
      name          : [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.name || '—',
      stopId        : c.pickupStopId || c.pickup_stop_id || c.stopId || null,
      photoUrl      : c.photoUrl || null,
      boardingStatus: 'not_boarded',
    }));
    return cachedRouteChildren;
  },
};

export default { defaults: { baseURL: BASE_URL } };
