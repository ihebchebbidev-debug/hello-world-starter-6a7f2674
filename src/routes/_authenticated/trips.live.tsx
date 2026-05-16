import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DataList } from "@/components/data-list";
import { LiveBusMap, type FleetBus, type TripRouteRef } from "@/components/live-bus-map";
import { useLiveBuses } from "@/hooks/useLiveBuses";
import { BusesAPI, TripsAPI, OrganizationsAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Eye, Bus as BusIcon, Gauge } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trips/live")({ component: TripsLivePage });

function TripsLivePage() {
  const { isSuperAdmin } = useAuth();
  const [tab, setTab] = useState<"map" | "table">("map");
  const [selected, setSelected] = useState<string | null>(null);

  // Super-admins opt into the cross-org listing via `?scope=all`. Backend
  // gates the flag by role, so passing it from a non-super_admin is a no-op.
  const scope = isSuperAdmin ? { scope: "all" } : undefined;
  const buses = useQuery({
    queryKey: ["buses", { scope: isSuperAdmin ? "all" : "org" }],
    queryFn: () => BusesAPI.list(scope),
  });
  const trips = useQuery({
    queryKey: ["trips", "active", { scope: isSuperAdmin ? "all" : "org" }],
    queryFn: () => TripsAPI.active(scope),
    refetchInterval: 15_000,
  });
  const orgs = useQuery({
    queryKey: ["organizations"],
    queryFn: () => OrganizationsAPI.list(),
    enabled: isSuperAdmin,
  });

  // Buses currently driving a trip → that's our live fleet.
  const fleet: FleetBus[] = useMemo(() => {
    const orgById = new Map((orgs.data || []).map((o: any) => [o.id, o.name]));
    const tripBusIds = new Set(
      (trips.data || [])
        .map((t: any) => t.busId || t.bus_id)
        .filter(Boolean),
    );
    // Only buses tied to an in_progress trip count as "live". Previously,
    // when no trips were active, every bus in the org was shown — making
    // the live map indistinguishable from the buses inventory.
    const list = (buses.data || [])
      .filter((b: any) => tripBusIds.has(b.id))
      .map((b: any) => ({
        id: b.id,
        name: b.name,
        plateNumber: b.plateNumber || b.plate_number,
        organizationName:
          b.organizationName || b.organization_name || orgById.get(b.organizationId || b.organization_id),
      }));
    return list;
  }, [buses.data, trips.data, orgs.data]);

  const fleetIds = useMemo(() => fleet.map((b) => b.id), [fleet]);
  const { positions, connected } = useLiveBuses(fleetIds, { crossOrg: isSuperAdmin });

  const tripRoutes: TripRouteRef[] = useMemo(
    () =>
      (trips.data || [])
        .map((t: any) => ({
          busId: t.busId || t.bus_id,
          routeId: t.routeId || t.route_id,
        }))
        .filter((r: TripRouteRef) => r.busId && r.routeId),
    [trips.data],
  );

  const sidebar = fleet.map((b) => {
    const p = positions[b.id];
    const t = (trips.data || []).find((x: any) => (x.busId || x.bus_id) === b.id);
    return { ...b, pos: p, trip: t };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Opérations · Live"
        title={isSuperAdmin ? "Flotte en temps réel — toutes les écoles" : "Vos bus en temps réel"}
        description={
          isSuperAdmin
            ? "Toutes les écoles confondues. Chaque marqueur est un bus actif, mis à jour en direct via Socket.IO."
            : "Suivi temps réel des bus de votre école. Mise à jour en direct dès qu'un chauffeur démarre un trajet."
        }
        actions={
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
            <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            <span className="font-medium">{connected ? "Live" : "Connexion…"}</span>
          </div>
        }
      />

      <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
        <button
          className={`rounded-md px-3 py-1.5 ${tab === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          onClick={() => setTab("map")}
        >
          Carte
        </button>
        <button
          className={`rounded-md px-3 py-1.5 ${tab === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          onClick={() => setTab("table")}
        >
          Tableau
        </button>
      </div>

      {tab === "map" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr,340px]">
          <LiveBusMap
            buses={fleet}
            height={560}
            selectedBusId={selected}
            onSelect={(id) => setSelected(id)}
            tripRoutes={tripRoutes}
            activeTrips={trips.data || []}
          />
          <Card className="max-h-[560px] overflow-y-auto p-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <div className="text-sm font-semibold">Bus actifs</div>
              <Badge variant="outline">{fleet.length}</Badge>
            </div>
            {sidebar.length === 0 && (
              <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                Aucun bus en service pour le moment.
              </div>
            )}
            <ul className="space-y-1">
              {sidebar.map((b) => {
                const isLive = !!b.pos;
                const speed = b.pos?.speed != null ? Math.round(b.pos.speed) : null;
                return (
                  <li key={b.id}>
                    <button
                      onClick={() => setSelected(b.id)}
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selected === b.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <BusIcon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 truncate text-sm font-medium">
                          {b.name || b.plateNumber || b.id.slice(0, 8)}
                        </div>
                        <span className={`inline-block h-2 w-2 rounded-full ${isLive ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {b.organizationName && <span className="truncate">{b.organizationName}</span>}
                        {speed != null && (
                          <span className="ml-auto inline-flex items-center gap-1 tabular-nums">
                            <Gauge className="h-3 w-3" /> {speed} km/h
                          </span>
                        )}
                      </div>
                      {b.trip?.routeName || b.trip?.route_name ? (
                        <div className="mt-1 truncate text-xs">
                          Route : <span className="font-medium text-foreground">{b.trip.routeName || b.trip.route_name}</span>
                        </div>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      ) : (
        <DataList
          queryKey={["trips", "active"]}
          queryFn={() => TripsAPI.active()}
          searchKeys={["routeName", "route_name", "busNumber", "bus_number", "driverName"]}
          searchPlaceholder="Rechercher route, bus, chauffeur…"
          refetchInterval={15_000}
          emptyHint="Aucun trajet en cours pour le moment."
          columns={[
            { key: "route", header: "Route", cell: (r) => <span className="font-medium text-foreground">{r.routeName || r.route_name || "—"}</span> },
            { key: "bus", header: "Bus", cell: (r) => <Badge variant="outline">{r.busNumber || r.bus_number || "—"}</Badge> },
            { key: "driver", header: "Chauffeur", cell: (r) => r.driverName || r.driver_name || "—" },
            { key: "started", header: "Démarré", cell: (r) => <span className="tabular-nums">{r.startedAt?.slice?.(11, 16) || "—"}</span> },
            { key: "kids", header: "Enfants", cell: (r) => <span className="tabular-nums">{r.childrenCount ?? "—"}</span> },
            { key: "status", header: "Statut", cell: () => (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                <span className="live-dot" />en cours
              </span>
            ) },
          ]}
          actions={(r: any) => (
            <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0" title="Détails">
              <Link to="/trips/history" search={{ tripId: r.id } as any}><Eye className="h-4 w-4" /></Link>
            </Button>
          )}
        />
      )}
    </div>
  );
}
