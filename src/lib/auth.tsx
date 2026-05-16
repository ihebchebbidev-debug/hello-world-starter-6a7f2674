import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AuthAPI, Auth, type AdminUser } from "./api";

type AuthCtx = {
  user: AdminUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isSchoolAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedUser = typeof window !== "undefined" ? Auth.getUser() : null;
  const [user, setUser] = useState<AdminUser | null>(cachedUser);
  const [authError, setAuthError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  // If we already have a cached user, do NOT show a loading state — render
  // the app immediately and refresh /me in the background. This prevents the
  // dashboard from "freezing" on Vercel/Render when the API is slow or cold.
  const [loading, setLoading] = useState(
    !cachedUser && typeof window !== "undefined" && !!Auth.getToken(),
  );

  useEffect(() => {
    mountedRef.current = true;
    if (typeof window === "undefined") return () => { mountedRef.current = false; };

    let alive = true;
    const token = Auth.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // Hard timeout: loading must never stay true forever, even if /me hangs.
    const safety = setTimeout(() => {
      if (!alive) return;
      setAuthError("Le backend ne répond pas. Vous pouvez réessayer dans quelques secondes.");
      setLoading(false);
    }, 8000);

    AuthAPI.me()
      .then((u) => {
        if (!alive) return;
        if (u) setUser(u);
        else if (!cachedUser) { Auth.clear(); setUser(null); }
      })
      .catch(() => {
        // Network/CORS/timeout: keep cached user if any; otherwise clear.
        if (!alive) return;
        setAuthError("Connexion au backend impossible. Vérifiez le déploiement et CORS.");
        if (!cachedUser) { Auth.clear(); setUser(null); }
      })
      .finally(() => {
        if (!alive) return;
        clearTimeout(safety);
        setLoading(false);
      });

    return () => { alive = false; mountedRef.current = false; clearTimeout(safety); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Roles can come as `role: "admin"`, `roles: ["admin"]`, or `roles: [{name:"admin"}]`.
  const allRoles: string[] = (() => {
    const raw: any = (user as any)?.roles;
    if (Array.isArray(raw)) return raw.map((r) => (typeof r === "string" ? r : r?.name)).filter(Boolean);
    return user?.role ? [String(user.role)] : [];
  })().map((r) => r.toLowerCase());
  // Platform owners (super admins) use role "admin" in the backend.
  // School-level admins use "school_admin" / "school_manager" / "org_admin".
  const isSuperAdmin = allRoles.some((r) =>
    ["admin", "super_admin", "superadmin", "platform_admin"].includes(r),
  );
  const isSchoolAdmin = allRoles.some((r) =>
    ["school_admin", "school_manager", "org_admin"].includes(r),
  ) || isSuperAdmin;

  const value: AuthCtx = {
    user,
    loading,
    isAuthenticated: !!user,
    isSuperAdmin,
    isSchoolAdmin: isSchoolAdmin || isSuperAdmin,
    login: async (email, password) => {
      setAuthError(null);
      const { user: u } = await AuthAPI.login(email, password);
      if (!mountedRef.current) return;
      setUser(u);
      setLoading(false);
    },
    logout: async () => {
      await AuthAPI.logout();
      setUser(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
