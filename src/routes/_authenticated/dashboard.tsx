import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bus, IdCard, Users, Navigation, Siren, Bell,
  Route as RouteIcon, School, Activity, ShieldAlert, ArrowRight, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveBusMap, type FleetBus } from "@/components/live-bus-map";
import {
  BusesAPI, DriversAPI, ChildrenAPI, TripsAPI, SosAPI, NotificationsAPI,
  RoutesAPI, SchoolsAPI, AnalyticsAPI, AlertsAPI,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const { user, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isClearing, setIsClearing] = useState(false);

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      // Clear all cached data
      await queryClient.invalidateQueries();
      toast.success("Cache vidé avec succès");
    } catch (error) {
      toast.error("Erreur lors du vidage du cache");
    } finally {
      setIsClearing(false);
    }
  };

  const buses    = useQuery({ queryKey: ["buses"],    queryFn: () => BusesAPI.list() });
  const drivers  = useQuery({ queryKey: ["drivers"],  queryFn: () => DriversAPI.list() });
  const children = useQuery({ queryKey: ["children"], queryFn: () => ChildrenAPI.list() });
  const liveTrips = useQuery({ queryKey: ["trips", "active"], queryFn: () => TripsAPI.active(), refetchInterval: 15_000 });
  const tripsHistory = useQuery({ queryKey: ["trips", "history"], queryFn: () => TripsAPI.history() });
  const sos      = useQuery({ queryKey: ["sos"],      queryFn: () => SosAPI.list(), refetchInterval: 20_000 });
  const notifs   = useQuery({ queryKey: ["notifications"], queryFn: () => NotificationsAPI.list() });
  const routes   = useQuery({ queryKey: ["routes"],   queryFn: () => RoutesAPI.list() });
  const schools  = useQuery({ queryKey: ["schools"],  queryFn: () => SchoolsAPI.list(), enabled: isSuperAdmin });
  const alerts   = useQuery({ queryKey: ["alerts"],   queryFn: () => AlertsAPI.list() });
  const overview = useQuery({
    queryKey: ["analytics", "overview", 7],
    queryFn: () => AnalyticsAPI.overview(7),
    refetchInterval: 60_000,
  });

  const ov = overview.data || {};
  const openSos = (sos.data || []).filter((s: any) => !s.resolvedAt && !s.resolved_at && s.status !== "resolved");
  const openAlerts = (alerts.data || []).filter((a: any) => (a.status ?? "active") !== "resolved" && !a.resolved);

  // Last 7 days bucket for trips & alerts
  const last7 = useMemo(() => {
    const out: { day: string; label: string; trips: number; alerts: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const day = d.toISOString().slice(0, 10);
      out.push({
        day,
        label: d.toLocaleDateString("fr-FR", { weekday: "short" }),
        trips: 0,
        alerts: 0,
      });
    }
    const idx = new Map(out.map((b, i) => [b.day, i]));
    for (const t of (tripsHistory.data || [])) {
      const d = (t.startedAt || "").slice(0, 10);
      const i = idx.get(d); if (i != null) out[i].trips++;
    }
    for (const a of (alerts.data || [])) {
      const d = ((a.createdAt || a.created_at) || "").slice(0, 10);
      const i = idx.get(d); if (i != null) out[i].alerts++;
    }
    return out;
  }, [tripsHistory.data, alerts.data]);

  // Fleet utilization — la liste réelle est la source de vérité pour le total ;
  // `fleet.total` du backend analytics peut être désynchronisé (vu en QA).
  const totalBuses = buses.data?.length ?? ov.fleet?.total ?? 0;
  const rawActive = ov.fleet?.active ?? (liveTrips.data?.length || 0);
  const activeBuses = Math.min(rawActive, totalBuses);
  const utilization = totalBuses ? Math.round((activeBuses / totalBuses) * 100) : 0;

  const greeting =
    new Date().getHours() < 12 ? "Bonjour" : new Date().getHours() < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div>
      <PageHeader
        eyebrow={isSuperAdmin ? "Super admin · Toutes organisations" : "Tableau de bord"}
        title={`${greeting}, ${user?.firstName || user?.email?.split("@")[0] || "admin"}`}
        description="Aperçu temps réel de votre flotte, vos trajets et vos alertes."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
              <span className="live-dot" />
              <span className="font-medium text-foreground">Live</span>
              <span className="text-muted-foreground/60">·</span>
              <span>màj automatique</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearCache}
              disabled={isClearing}
              className="h-9"
              title="Vider le cache et actualiser les données"
            >
              <RotateCcw className={`h-4 w-4 ${isClearing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline ml-1.5">Vider le cache</span>
            </Button>
          </div>
        }
      />

      <div className="space-y-8 p-6">
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Flotte</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            <StatCard label="Bus actifs" value={`${activeBuses}/${totalBuses || "—"}`} icon={Bus} hint={totalBuses ? `${utilization}% en service` : undefined} />
            <StatCard label="Chauffeurs" value={drivers.data?.length ?? "—"} icon={IdCard} />
            <StatCard label="Routes" value={routes.data?.length ?? "—"} icon={RouteIcon} />
            {isSuperAdmin && <StatCard label="Écoles / Orgs" value={schools.data?.length ?? "—"} icon={School} />}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Opérations · 7 derniers jours</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Trajets en cours" value={ov.trips?.active ?? liveTrips.data?.length ?? 0} icon={Navigation} tone="info" />
            <StatCard label="Trajets aujourd'hui" value={ov.trips?.today ?? "—"} icon={Activity} />
            <StatCard label="Embarquements" value={ov.attendance?.boarded ?? "—"} icon={Users} tone="success" />
            <StatCard label="Enfants inscrits" value={children.data?.length ?? "—"} icon={Users} />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sécurité & communication</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="SOS ouverts" value={ov.sos?.open ?? openSos.length} icon={Siren} tone={(ov.sos?.open ?? openSos.length) ? "danger" : "default"} />
            <StatCard label="Alertes ouvertes" value={openAlerts.length} icon={ShieldAlert} tone={openAlerts.length ? "warning" : "default"} />
            <StatCard label="Absences (7j)" value={ov.attendance?.absent ?? "—"} icon={Users} />
            <StatCard label="Notifications (7j)" value={ov.notifications?.sent ?? notifs.data?.length ?? "—"} icon={Bell} />
          </div>
        </section>

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="overflow-hidden p-0 shadow-xs lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Trajets · 7 derniers jours</h3>
                <p className="text-xs text-muted-foreground">Volume quotidien de trajets terminés.</p>
              </div>
              <Button asChild size="sm" variant="ghost" className="text-xs">
                <Link to="/trips/history">Détails <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
            <div className="h-[240px] w-full px-2 py-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={last7} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gTrips" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="trips" stroke="var(--primary)" strokeWidth={2} fill="url(#gTrips)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden p-0 shadow-xs">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Alertes · 7 derniers jours</h3>
                <p className="text-xs text-muted-foreground">Tendance des alertes système.</p>
              </div>
              <Button asChild size="sm" variant="ghost" className="text-xs">
                <Link to="/alerts">Voir <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
            <div className="h-[240px] w-full px-2 py-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="alerts" fill="var(--warning)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {isSuperAdmin ? "Carte temps réel · toutes les écoles" : "Carte temps réel · vos bus"}
            </h2>
            <Button asChild size="sm" variant="ghost" className="text-xs">
              <Link to="/trips/live">Plein écran <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <LiveBusMap
            height={380}
            buses={(() => {
              const tripBusIds = new Set(
                (liveTrips.data || []).map((t: any) => t.busId || t.bus_id).filter(Boolean),
              );
              const list = (buses.data || [])
                .filter((b: any) => tripBusIds.size === 0 ? true : tripBusIds.has(b.id))
                .map((b: any): FleetBus => ({
                  id: b.id,
                  name: b.name,
                  plateNumber: b.plateNumber || b.plate_number,
                  organizationName: b.organizationName || b.organization_name,
                }));
              return list;
            })()}
            tripRoutes={(liveTrips.data || [])
              .map((t: any) => ({ busId: t.busId || t.bus_id, routeId: t.routeId || t.route_id }))
              .filter((r: { busId?: string; routeId?: string }) => r.busId && r.routeId)}
            activeTrips={liveTrips.data || []}
          />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden p-0 shadow-xs">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="live-dot" />
                <h3 className="text-sm font-semibold text-foreground">Trajets en cours</h3>
                <Badge variant="secondary" className="rounded-full text-[10.5px]">{liveTrips.data?.length ?? 0}</Badge>
              </div>
              <Button asChild size="sm" variant="ghost" className="text-xs"><Link to="/trips/live">Voir tout <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
            </div>
            {!liveTrips.data?.length ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">Aucun trajet en cours pour le moment.</div>
            ) : (
              <ul className="divide-y divide-border/70">
                {liveTrips.data.slice(0, 6).map((t: any) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{t.routeName || t.route_name || `Trajet ${t.id?.slice?.(0, 6)}`}</div>
                      <div className="truncate text-xs text-muted-foreground">Bus {t.busNumber || t.bus_number || t.busId || "—"} · démarré {(t.startedAt || t.start_time)?.slice?.(11, 16) || "—"}</div>
                    </div>
                    <Badge className="bg-success-soft text-success hover:bg-success-soft">en cours</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden p-0 shadow-xs">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Siren className={`h-4 w-4 ${openSos.length ? "text-destructive" : "text-muted-foreground"}`} />
                <h3 className="text-sm font-semibold text-foreground">Alertes SOS récentes</h3>
                <Badge variant={openSos.length ? "destructive" : "secondary"} className="rounded-full text-[10.5px]">{openSos.length} ouverte{openSos.length > 1 ? "s" : ""}</Badge>
              </div>
              <Button asChild size="sm" variant="ghost" className="text-xs"><Link to="/sos">Voir tout <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
            </div>
            {!sos.data?.length ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">Aucune alerte récente. Tout va bien.</div>
            ) : (
              <ul className="divide-y divide-border/70">
                {sos.data.slice(0, 6).map((s: any) => {
                  const resolved = s.resolvedAt || s.resolved_at || s.status === "resolved";
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{s.type || "SOS"}</div>
                        <div className="truncate text-xs text-muted-foreground">{(s.createdAt || s.created_at)?.slice?.(0, 16)?.replace("T", " ") || "—"}</div>
                      </div>
                      <Badge variant={resolved ? "secondary" : "destructive"}>{resolved ? "résolu" : (s.status || "ouvert")}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
