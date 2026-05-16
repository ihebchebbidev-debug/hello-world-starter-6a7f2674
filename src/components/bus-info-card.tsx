/**
 * Live bus details card shown on the map when a bus marker is selected.
 *
 * Surfaces, in real time:
 *   - Driver (name + phone), bus plate, organisation, route
 *   - Latest GPS coordinates + speed + heading
 *   - "Last update Xs ago" — refreshes every second
 *   - Children picked up / total on the route
 *   - Remaining stops + estimated finish time (heuristic)
 *
 * Computed entirely from existing endpoints — no backend change needed.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, User, Bus as BusIcon, MapPin, Gauge, Users, Flag, Clock, Phone } from "lucide-react";
import { http, RoutesAPI, UsersAPI } from "@/lib/api";
import type { BusLive } from "@/hooks/useLiveBuses";
import type { FleetBus } from "@/components/live-bus-map";

type ActiveTrip = {
  id: string;
  routeId?: string;
  route_id?: string;
  busId?: string;
  bus_id?: string;
  driverId?: string;
  driver_id?: string;
  routeName?: string;
  route_name?: string;
  startTime?: string;
  start_time?: string;
};

type Stop = {
  id: string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  sequence?: number;
  name?: string;
};

const toRad = (d: number) => (d * Math.PI) / 180;
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const fmtAgo = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
};

const fmtClock = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export function BusInfoCard({
  bus,
  position,
  trip,
  onClose,
}: {
  bus: FleetBus;
  position?: BusLive;
  trip?: ActiveTrip | null;
  onClose?: () => void;
}) {
  // Tick every second so "last update" stays live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const driverId = trip?.driverId || trip?.driver_id;
  const routeId = trip?.routeId || trip?.route_id;

  const driverQ = useQuery({
    queryKey: ["user", driverId],
    queryFn: () => UsersAPI.get(driverId!),
    enabled: !!driverId,
    staleTime: 60_000,
  });

  const stopsQ = useQuery({
    queryKey: ["routes", routeId, "stops"],
    queryFn: () => RoutesAPI.stops(routeId!) as Promise<Stop[]>,
    enabled: !!routeId,
    staleTime: 5 * 60_000,
  });

  const checkinsQ = useQuery({
    queryKey: ["checkins", "trip", trip?.id],
    queryFn: (): Promise<any[]> =>
      http<any>(`/checkins/trip/${trip!.id}`)
        .then((r: any) => (Array.isArray(r) ? r : r?.data ?? []))
        .catch(() => []),
    enabled: !!trip?.id,
    refetchInterval: 15_000,
  });

  const stops: Stop[] = stopsQ.data || [];
  const totalStops = stops.length;
  const pickedUp = useMemo(() => {
    const items = checkinsQ.data || [];
    return items.filter((c: any) => {
      const s = String(c.status || c.event || "").toLowerCase();
      return s === "picked_up" || s === "boarded" || s === "in" || s === "checkin";
    }).length;
  }, [checkinsQ.data]);
  const totalKids = useMemo(() => {
    const items = checkinsQ.data || [];
    const ids = new Set(items.map((c: any) => c.childId || c.child_id).filter(Boolean));
    return ids.size || items.length || 0;
  }, [checkinsQ.data]);

  // Remaining stops & ETA finish: pick the nearest stop ahead in sequence,
  // sum great-circle distance through the rest, divide by current speed
  // (clamped) — fall back to ~3 min/stop when GPS speed is unknown.
  const eta = useMemo(() => {
    if (!stops.length) return null;
    const ordered = [...stops]
      .map((s) => ({
        ...s,
        lat: Number((s as any).latitude ?? (s as any).lat),
        lng: Number((s as any).longitude ?? (s as any).lng),
        sequence: Number((s as any).sequence ?? 0),
      }))
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .sort((a, b) => a.sequence - b.sequence);
    if (!ordered.length) return null;

    let remaining = ordered;
    if (position) {
      // Find the next stop = stop with min distance from current bus pos.
      const idx = ordered.reduce(
        (best, s, i) => {
          const d = haversineMeters({ lat: position.lat, lng: position.lng }, s);
          return d < best.d ? { i, d } : best;
        },
        { i: 0, d: Infinity },
      ).i;
      remaining = ordered.slice(idx);
    }

    let meters = 0;
    if (position && remaining[0]) meters += haversineMeters({ lat: position.lat, lng: position.lng }, remaining[0]);
    for (let i = 1; i < remaining.length; i++) meters += haversineMeters(remaining[i - 1], remaining[i]);

    const speedKmh = Math.max(15, Number(position?.speed) || 0); // floor at 15km/h to avoid infinite ETAs
    const driveSec = (meters / 1000) / speedKmh * 3600;
    const dwellSec = remaining.length * 60; // ~1 min per stop
    const totalSec = Math.round(driveSec + dwellSec);
    const finishAt = new Date(Date.now() + totalSec * 1000);
    return { remainingStops: remaining.length, totalSec, finishAt };
  }, [stops, position]);

  const lastUpdateAgo = position?.updatedAt ? now - position.updatedAt : null;
  const driver: any = driverQ.data;
  const driverName =
    [driver?.firstName, driver?.lastName].filter(Boolean).join(" ").trim() ||
    driver?.first_name && [driver.first_name, driver.last_name].filter(Boolean).join(" ").trim() ||
    driver?.name ||
    driver?.email ||
    "—";

  return (
    <div className="pointer-events-auto absolute left-3 right-3 bottom-3 z-20 mx-auto max-w-md rounded-xl border border-border bg-background/95 p-4 text-sm shadow-lg backdrop-blur sm:left-auto sm:right-3 sm:max-w-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BusIcon className="h-4 w-4 text-muted-foreground" />
            <span className="truncate font-semibold">{bus.name || bus.plateNumber || bus.id.slice(0, 8)}</span>
            {bus.plateNumber && (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {bus.plateNumber}
              </span>
            )}
          </div>
          {bus.organizationName && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{bus.organizationName}</div>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Driver */}
      <div className="mb-2 flex items-center gap-2">
        <User className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">{driverName}</span>
        {driver?.phone && (
          <a href={`tel:${driver.phone}`} className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <Phone className="h-3 w-3" /> {driver.phone}
          </a>
        )}
      </div>

      {/* Route */}
      {(trip?.routeName || trip?.route_name) && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Flag className="h-3.5 w-3.5" />
          <span className="truncate">Trajet : <span className="font-medium text-foreground">{trip.routeName || trip.route_name}</span></span>
        </div>
      )}

      {/* Position + last update */}
      <div className="my-3 grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/30 p-2 text-xs">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="tabular-nums">
            {position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Gauge className="h-3 w-3 text-muted-foreground" />
          <span className="tabular-nums">
            {position?.speed != null ? `${Math.round(position.speed)} km/h` : "—"}
          </span>
        </div>
        <div className="col-span-2 flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${lastUpdateAgo != null && lastUpdateAgo < 30_000 ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"}`} />
          <span className="text-muted-foreground">
            Dernière mise à jour :{" "}
            <span className="font-medium tabular-nums text-foreground">
              {lastUpdateAgo != null ? `il y a ${fmtAgo(lastUpdateAgo)}` : "en attente…"}
            </span>
          </span>
        </div>
      </div>

      {/* Children */}
      <div className="mb-2 flex items-center gap-2 text-xs">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span>
          Enfants à bord :{" "}
          <span className="font-semibold tabular-nums text-foreground">{pickedUp}</span>
          {totalKids > 0 && <span className="text-muted-foreground"> / {totalKids}</span>}
        </span>
        {totalStops > 0 && (
          <span className="ml-auto text-muted-foreground">
            Arrêts restants :{" "}
            <span className="font-medium tabular-nums text-foreground">
              {eta?.remainingStops ?? totalStops}
            </span>
            <span className="text-muted-foreground"> / {totalStops}</span>
          </span>
        )}
      </div>

      {/* ETA */}
      {eta && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/5 px-2 py-2 text-xs">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="text-muted-foreground">Fin estimée :</span>
          <span className="ml-auto font-semibold tabular-nums text-foreground">
            {fmtClock(eta.finishAt)}
          </span>
          <span className="text-muted-foreground">(~{Math.round(eta.totalSec / 60)} min)</span>
        </div>
      )}
    </div>
  );
}
