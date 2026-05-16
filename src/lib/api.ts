/**
 * EcoBus admin API client.
 * Same backend as mobile apps: https://busapi.ihebchebbi.pro/api/v1
 * JWT stored in localStorage (browser only).
 */

export const BASE_URL = "https://busapi.ihebchebbi.pro/api/v1";

const ACCESS_KEY = "@ecobus-admin/access";
const REFRESH_KEY = "@ecobus-admin/refresh";
const USER_KEY = "@ecobus-admin/user";
const REQUEST_TIMEOUT_MS = 15_000;
const AUTH_TIMEOUT_MS = 7_000;

const ls = {
  get: (k: string) => (typeof window === "undefined" ? null : window.localStorage.getItem(k)),
  set: (k: string, v: string) => typeof window !== "undefined" && window.localStorage.setItem(k, v),
  del: (k: string) => typeof window !== "undefined" && window.localStorage.removeItem(k),
};

export type AdminUser = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role?: string;
  organizationId?: string;
  organization_id?: string;
  [k: string]: unknown;
};

export const Auth = {
  getToken: () => ls.get(ACCESS_KEY),
  getRefresh: () => ls.get(REFRESH_KEY),
  getUser: (): AdminUser | null => {
    const raw = ls.get(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
  setSession: (accessToken?: string, refreshToken?: string, user?: AdminUser | null) => {
    if (accessToken) ls.set(ACCESS_KEY, accessToken);
    if (refreshToken) ls.set(REFRESH_KEY, refreshToken);
    if (user) ls.set(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    ls.del(ACCESS_KEY); ls.del(REFRESH_KEY); ls.del(USER_KEY);
  },
};

type HttpOpts = { method?: string; body?: unknown; auth?: boolean; query?: Record<string, string | number | undefined>; _retry?: boolean };

/* ── 401 handling: auto-refresh once, then logout-redirect ── */
let refreshPromise: Promise<string | null> | null = null;
async function tryRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = Auth.getRefresh();
  if (!refreshToken) return null;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const j = await res.json().catch(() => null);
      const data = j && typeof j === "object" && "data" in j ? (j as any).data : j;
      const newAccess = data?.accessToken || data?.access_token || data?.token;
      const newRefresh = data?.refreshToken || data?.refresh_token;
      if (newAccess) Auth.setSession(newAccess, newRefresh, undefined);
      return newAccess || null;
    } catch { return null; }
    finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

function logoutAndRedirect() {
  Auth.clear();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

export async function http<T = any>(path: string, opts: HttpOpts = {}): Promise<T> {
  const { method = "GET", body, auth = true, query, _retry } = opts;
  let url = `${BASE_URL}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => v != null && v !== "" && qs.set(k, String(v)));
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (auth) {
    const tok = Auth.getToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
  }
  let res: Response;
  const controller = new AbortController();
  const timeoutMs = path.startsWith("/auth/") ? AUTH_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
  } catch (e) {
    throw new Error((e as Error)?.name === "AbortError" ? "Le serveur met trop de temps à répondre." : "Erreur réseau — vérifiez votre connexion.");
  } finally {
    globalThis.clearTimeout(timeout);
  }
  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }

  // Token expired → try refresh once, then retry
  if (res.status === 401 && auth && !_retry && !path.startsWith("/auth/")) {
    const fresh = await tryRefresh();
    if (fresh) return http<T>(path, { ...opts, _retry: true });
    logoutAndRedirect();
  }

  if (!res.ok) {
    const msg = json?.error?.message || json?.message || `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status?: number; body?: unknown };
    err.status = res.status; err.body = json;
    throw err;
  }
  const payload = (json && typeof json === "object" && "data" in json ? json.data : json);
  return deepCamelize(payload) as T;
}

/** Recursively convert snake_case keys to camelCase, preserving original keys too. */
function toCamel(s: string) { return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase()); }
function deepCamelize(input: any): any {
  if (Array.isArray(input)) return input.map(deepCamelize);
  if (input && typeof input === "object" && input.constructor === Object) {
    const out: any = {};
    for (const [k, v] of Object.entries(input)) {
      const ck = toCamel(k);
      const nv = deepCamelize(v);
      out[k] = nv;          // keep original snake_case
      out[ck] = nv;         // expose camelCase
    }
    return out;
  }
  return input;
}

const arr = <T>(r: any): T[] => (Array.isArray(r) ? r : r?.items ?? []);

/* ─── Auth ─── */
export const AuthAPI = {
  login: async (email: string, password: string) => {
    const data = await http<any>("/auth/login", { method: "POST", auth: false, body: { email, password } });
    const accessToken = data?.accessToken || data?.access_token || data?.token;
    const refreshToken = data?.refreshToken || data?.refresh_token || null;
    const user = data?.user || data?.admin || { email };
    Auth.setSession(accessToken, refreshToken, user);
    return { accessToken, refreshToken, user } as { accessToken: string; refreshToken?: string; user: AdminUser };
  },
  me: async (): Promise<AdminUser | null> => {
    try {
      const u = await http<AdminUser>("/auth/me");
      if (u) Auth.setSession(undefined, undefined, u);
      return u;
    } catch (e: any) {
      // 401/expired → http() already cleared + redirected. Return null so UI re-renders to login.
      if (e?.status === 401) return null;
      return Auth.getUser();
    }
  },
  updateProfile: async (body: { firstName?: string; lastName?: string; phone?: string }) => {
    const u = await http<AdminUser>("/auth/me", { method: "PATCH", body });
    if (u) Auth.setSession(undefined, undefined, u);
    return u;
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    http("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }),
  logout: async () => {
    try {
      const refreshToken = Auth.getRefresh();
      await http("/auth/logout", { method: "POST", body: { refreshToken } }).catch(() => {});
    } finally { Auth.clear(); }
  },
  /** Crée une nouvelle organisation + admin initial. Endpoint public côté backend. */
  registerOrgAdmin: async (body: {
    organizationName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
  }) => {
    const data = await http<any>("/auth/register", { method: "POST", auth: false, body });
    const accessToken = data?.accessToken || data?.access_token || data?.token;
    const refreshToken = data?.refreshToken || data?.refresh_token || null;
    const user = data?.user || null;
    if (accessToken) Auth.setSession(accessToken, refreshToken, user);
    return { accessToken, refreshToken, user, organization: data?.organization } as {
      accessToken: string; refreshToken?: string; user: AdminUser; organization?: any;
    };
  },
};

/* ─── Generic CRUD list helpers ─── */
const list = <T = any>(path: string) => async (query?: Record<string, any>): Promise<T[]> =>
  http<any>(path, { query }).then(arr<T>).catch(() => []);

export const OrganizationsAPI = {
  list: list("/organizations"),
  get: (id: string) => http(`/organizations/${id}`).catch(() => null),
  create: (body: any) => http("/organizations", { method: "POST", body }),
  update: (id: string, body: any) => http(`/organizations/${id}`, { method: "PATCH", body }),
  remove: (id: string) => http(`/organizations/${id}`, { method: "DELETE" }),
};

export const BusesAPI = {
  list: list("/buses"),
  get: (id: string, opts?: { scope?: "all" }) =>
    http(`/buses/${id}`, { query: opts }).catch(() => null),
  // Pass `{ scope: "all" }` for super-admin cross-org seed; backend gates by role.
  live: (id: string, opts?: { scope?: "all" }) =>
    http(`/buses/${id}/live`, { query: opts }).catch(() => null),
  create: (body: any) => http("/buses", { method: "POST", body }),
  update: (id: string, body: any) => http(`/buses/${id}`, { method: "PATCH", body }),
  remove: (id: string) => http(`/buses/${id}`, { method: "DELETE" }),
};

export const DriversAPI = {
  list: list("/drivers"),
  get: (id: string) => http(`/drivers/${id}`).catch(() => null),
  assignments: (query?: Record<string, any>) =>
    http<any>("/drivers/assignments", { query }).then(arr).catch(() => []),
  createAssignment: (body: any) => http("/drivers/assignments", { method: "POST", body }),
  updateAssignment: (id: string, body: any) =>
    http(`/drivers/assignments/${id}`, { method: "PATCH", body }),
  deactivateAssignment: (id: string) =>
    http(`/drivers/assignments/${id}/deactivate`, { method: "POST" }),
  removeAssignment: (id: string) =>
    http(`/drivers/assignments/${id}`, { method: "DELETE" }),
};

export const RoutesAPI = {
  list: list("/routes"),
  get: (id: string) => http(`/routes/${id}`).catch(() => null),
  stops: (routeId: string) => http(`/routes/${routeId}/stops`).then(arr).catch(() => []),
  create: (body: any) => http("/routes", { method: "POST", body }),
  update: (id: string, body: any) => http(`/routes/${id}`, { method: "PATCH", body }),
  remove: (id: string) => http(`/routes/${id}`, { method: "DELETE" }),
  addStop: (routeId: string, body: any) =>
    http(`/routes/${routeId}/stops`, { method: "POST", body }),
  replaceStops: (routeId: string, stops: any[]) =>
    http(`/routes/${routeId}/stops`, { method: "PUT", body: { stops } }),
};

/** Pas d'endpoint /stops global — on agrège les stops de toutes les routes. */
import { mapPool } from "@/lib/concurrency";
export const StopsAPI = {
  list: async () => {
    const routes = await RoutesAPI.list();
    const all = await mapPool(routes || [], 6, async (r: any) => {
      const stops = await RoutesAPI.stops(r.id);
      return (stops || []).map((s: any) => ({ ...s, routeId: r.id, routeName: r.name }));
    });
    return all.flat();
  },
};

export const ChildrenAPI = {
  list: list("/children"),
  get: (id: string) => http(`/children/${id}`).catch(() => null),
  create: (body: any) => http("/children", { method: "POST", body }),
  update: (id: string, body: any) => http(`/children/${id}`, { method: "PATCH", body }),
  remove: (id: string) => http(`/children/${id}`, { method: "DELETE" }),
  assignRoute: (id: string, body: any) =>
    http(`/children/${id}/routes`, { method: "POST", body }),
  unassignRoute: (id: string, childRouteId: string) =>
    http(`/children/${id}/routes/${childRouteId}`, { method: "DELETE" }),
};

export const UsersAPI = {
  list: (params?: { role?: string; search?: string; limit?: number; offset?: number }) =>
    list("/users")(params),
  roles: () => http<any>("/users/roles").then(arr).catch(() => []),
  get: (id: string) => http(`/users/${id}`).catch(() => null),
  create: (body: any) => http("/users", { method: "POST", body }),
  update: (id: string, body: any) => http(`/users/${id}`, { method: "PATCH", body }),
  remove: (id: string) => http(`/users/${id}`, { method: "DELETE" }),
  resetPassword: (id: string, newPassword: string) =>
    http(`/users/${id}/reset-password`, { method: "POST", body: { newPassword } }),
  deactivate: (id: string) => http(`/users/${id}/deactivate`, { method: "POST" }),
};
export const ParentsAPI = {
  list: () => UsersAPI.list({ role: "parent" }),
  /** Création d'un parent (rôle = parent). */
  create: (body: { firstName: string; lastName: string; email: string; phone?: string; password: string }) =>
    UsersAPI.create({ ...body, roles: ["parent"] }),
};

export const TripsAPI = {
  active: list("/trips/active"),
  history: list("/trips/history"),
  forParent: () => http<any>("/trips/for-parent").then(arr).catch(() => []),
  get: (id: string) => http(`/trips/${id}`).catch(() => null),
};

/** Pas d'endpoint /checkins global — on agrège par trajets actifs. */
export const CheckinsAPI = {
  list: async () => {
    const trips = await TripsAPI.active();
    const all = await mapPool(trips || [], 6, async (t: any) => {
      const items = await http<any>(`/checkins/trip/${t.id}`).then(arr).catch(() => []);
      return (items || []).map((c: any) => ({ ...c, tripId: t.id, routeName: t.routeName || t.route_name }));
    });
    return all.flat();
  },
};

export const AbsencesAPI = { list: list("/absences") };

export const SosAPI = {
  list: list("/sos"),
  acknowledge: (id: string) => http(`/sos/${id}/acknowledge`, { method: "PATCH" }),
  resolve: (id: string) => http(`/sos/${id}/resolve`, { method: "PATCH" }),
};

export type NotificationTarget = {
  userIds?: string[];
  roles?: Array<"super_admin" | "admin" | "school_manager" | "driver" | "parent">;
  organizationId?: string;
  all?: boolean;
};
export type NotificationBroadcastInput = {
  title: string;
  message: string;
  type?: "info" | "warning" | "alert" | "sos" | "success";
  data?: Record<string, string | number | boolean>;
  target: NotificationTarget;
};
export const NotificationsAPI = {
  list: list("/notifications"),
  markAllRead: () => http("/notifications/read-all", { method: "PATCH" }).catch(() => null),
  markRead: (id: string) => http(`/notifications/${id}/read`, { method: "PATCH" }),
  broadcast: (input: NotificationBroadcastInput) =>
    http<{ recipients: number; inserted: number; push: { sent: number; failed: number; skipped: number; devices: number; pruned: number } }>(
      "/notifications",
      { method: "POST", body: input },
    ),
};

export const AnalyticsAPI = {
  overview: (days = 7) => http<any>("/analytics/overview", { query: { days } }).catch(() => null),
  superOverview: (days = 7) =>
    http<any>("/analytics/super-admin/overview", { query: { days } }).catch(() => null),
  attendance: (days = 30) =>
    http<any>("/analytics/reports/attendance", { query: { days } }).catch(() => null),
  driverPerformance: (days = 30) =>
    http<any>("/analytics/reports/driver-performance", { query: { days } }).catch(() => null),
  /** Compat: l'ancien `daily` est mappé sur overview pour les graphiques journaliers. */
  daily: (days = 14) => http<any>("/analytics/overview", { query: { days } }).catch(() => null),
};

export const AlertsAPI = {
  list: list("/alerts"),
  acknowledge: (id: string) => http(`/alerts/${id}/acknowledge`, { method: "PATCH" }),
  resolve: (id: string) => http(`/alerts/${id}/resolve`, { method: "PATCH" }),
};

export const GeofencesAPI = {
  list: list("/geofences"),
  get: (id: string) => http(`/geofences/${id}`).catch(() => null),
  create: (body: any) => http("/geofences", { method: "POST", body }),
  update: (id: string, body: any) => http(`/geofences/${id}`, { method: "PATCH", body }),
  remove: (id: string) => http(`/geofences/${id}`, { method: "DELETE" }),
};

/** Pas de table "schools" dans le backend — les écoles sont des organisations. */
export const SchoolsAPI = {
  list: async () => {
    const orgs = await OrganizationsAPI.list().catch(() => []);
    return (orgs || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      address: o.address,
      contactEmail: o.contactEmail ?? o.contact_email,
      phone: o.phone,
      subscriptionPlan: o.subscriptionPlan ?? o.subscription_plan,
      subscriptionStatus: o.subscriptionStatus ?? o.subscription_status,
    }));
  },
};

/**
 * Logs (super-admin). Le backend exige un token `X-Log-Token`.
 * On lit le token depuis localStorage `@ecobus-admin/log-token`.
 */
export const LogsAPI = {
  setToken: (t: string) => ls.set("@ecobus-admin/log-token", t),
  getToken: () => ls.get("@ecobus-admin/log-token") || "",
  tail: async (params: { limit?: number; level?: string; search?: string; file?: string } = {}) => {
    const token = LogsAPI.getToken();
    if (!token) return { count: 0, entries: [] as any[] };
    const qs = new URLSearchParams({ token, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== "")) as any });
    const res = await fetch(`${BASE_URL}/logs/tail?${qs.toString()}`, { headers: { "X-Log-Token": token } });
    const j = await res.json().catch(() => ({}));
    return (j?.data ?? j) as { count: number; entries: any[] };
  },
  files: async () => {
    const token = LogsAPI.getToken();
    if (!token) return [];
    const res = await fetch(`${BASE_URL}/logs/files?token=${encodeURIComponent(token)}`, { headers: { "X-Log-Token": token } });
    const j = await res.json().catch(() => ({}));
    return (j?.data ?? j) as any[];
  },
};
