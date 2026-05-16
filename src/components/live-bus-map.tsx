/**
 * Real-time fleet map. Shows every provided bus on a Google Map, refreshed
 * via Socket.IO. Auto-fits the viewport to all currently-known positions.
 *
 * Route polylines:
 *   - For every active trip with a routeId we draw a *free* dashed line
 *     through the route's stops (computed locally from our backend).
 *   - When the user selects a bus, we lazily request a road-snapped path
 *     from Google Directions API ONCE and cache it for 7 days in
 *     localStorage. See `useRoutePath` for the full cost strategy.
 */
import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  Map as GMap,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { GOOGLE_MAPS_API_KEY, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/maps";
import { useLiveBuses, type BusLive } from "@/hooks/useLiveBuses";
import {
  useRouteStops,
  stopsToLatLng,
  pathHash,
  loadCachedSnap,
  saveCachedSnap,
  type LatLng,
} from "@/hooks/useRoutePath";
import { BusInfoCard } from "@/components/bus-info-card";

export type FleetBus = {
  id: string;
  name?: string;
  plateNumber?: string;
  organizationName?: string;
};

export type TripRouteRef = {
  busId: string;
  routeId: string;
  color?: string;
};

function FitBounds({ points }: { points: BusLive[] }) {
  const map = useMap();
  // Round to ~10m so tiny GPS jitter doesn't trigger a full bounds recompute.
  const sig = useMemo(
    () =>
      points
        .map((p) => `${p.busId}:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`)
        .sort()
        .join("|"),
    [points],
  );
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.panTo({ lat: points[0].lat, lng: points[0].lng });
      return;
    }
    const g = (window as any).google;
    if (!g?.maps?.LatLngBounds) return;
    const Bounds = g.maps.LatLngBounds as new () => any;
    const bounds = new Bounds();
    for (const p of points) bounds.extend({ lat: p.lat, lng: p.lng });
    map.fitBounds(bounds, 64);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, sig]);
  return null;
}

const STALE_MS = 60_000;
const PALETTE = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6", "#ef4444", "#6366f1"];

/**
 * Renders a polyline for one trip's route. Straight-line through stops by
 * default (free), upgraded to a road-snapped path on selection (one
 * Directions API call per route per 7-day window per browser).
 */
function TripRoutePolyline({
  routeId,
  isSelected,
  color,
  mode,
}: {
  routeId: string;
  isSelected: boolean;
  color: string;
  mode: "stops" | "snapped";
}) {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const stopsQ = useRouteStops(routeId);

  const stops = useMemo<LatLng[]>(() => stopsToLatLng(stopsQ.data), [stopsQ.data]);
  const hash = useMemo(() => pathHash(stops), [stops]);

  const [snapped, setSnapped] = useState<LatLng[] | null>(null);

  // Hydrate snapped path from localStorage once stops are known.
  useEffect(() => {
    if (stops.length < 2) return;
    const cached = loadCachedSnap(routeId, hash);
    if (cached) setSnapped(cached);
  }, [routeId, hash, stops.length]);

  // Fetch road-snapped path on demand (cache miss only).
  // Triggered by either: snapped-mode toggle OR explicit selection.
  const wantsSnap = mode === "snapped" || isSelected;
  useEffect(() => {
    if (!wantsSnap || snapped || !routesLib || stops.length < 2) return;
    let cancelled = false;
    const svc = new routesLib.DirectionsService();
    const origin = stops[0];
    const destination = stops[stops.length - 1];
    // Google caps waypoints at 25 (excl. origin/destination). Sample evenly if needed.
    const middle = stops.slice(1, -1);
    const MAX_WP = 23;
    const waypoints =
      middle.length <= MAX_WP
        ? middle
        : Array.from({ length: MAX_WP }, (_, i) =>
            middle[Math.round((i * (middle.length - 1)) / (MAX_WP - 1))],
          );

    svc
      .route({
        origin,
        destination,
        waypoints: waypoints.map((p) => ({ location: p, stopover: true })),
        travelMode: (window as any).google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      })
      .then((res: any) => {
        if (cancelled) return;
        const route = res.routes?.[0];
        if (!route?.overview_path?.length) return;
        const path = route.overview_path.map((ll: any) => ({ lat: ll.lat(), lng: ll.lng() }));
        setSnapped(path);
        saveCachedSnap(routeId, hash, path);
      })
      .catch(() => {
        /* keep showing straight-line fallback on quota / network errors */
      });
    return () => {
      cancelled = true;
    };
  }, [wantsSnap, snapped, routesLib, stops, hash, routeId]);

  // Draw the polyline with the imperative Maps API (vis.gl has no <Polyline />).
  useEffect(() => {
    if (!map || stops.length < 2) return;
    const g = (window as any).google;
    if (!g?.maps?.Polyline) return;

    // In "stops" mode we always render the straight dashed path, even if a
    // snapped one is cached — the toggle is the source of truth.
    const useSnapped = mode === "snapped" && !!snapped;
    const path = useSnapped ? snapped! : stops;
    const poly = new g.maps.Polyline({
      path,
      map,
      strokeColor: color,
      strokeOpacity: useSnapped ? (isSelected ? 0.95 : 0.55) : 0,
      strokeWeight: isSelected ? 5 : 3,
      icons: useSnapped
        ? undefined
        : [
            {
              icon: {
                path: "M 0,-1 0,1",
                strokeOpacity: isSelected ? 0.9 : 0.5,
                strokeColor: color,
                scale: isSelected ? 3 : 2,
              },
              offset: "0",
              repeat: "12px",
            },
          ],
      zIndex: isSelected ? 10 : 1,
      clickable: false,
    });
    return () => poly.setMap(null);
  }, [map, snapped, stops, isSelected, color, mode]);

  return null;
}

export function LiveBusMap({
  buses,
  height = 520,
  selectedBusId,
  onSelect,
  tripRoutes = [],
  activeTrips = [],
}: {
  buses: FleetBus[];
  height?: number;
  selectedBusId?: string | null;
  onSelect?: (busId: string) => void;
  /** Active trips → route mapping. Used to render route polylines. */
  tripRoutes?: TripRouteRef[];
  /** Full active-trip records, used to enrich the selected bus info card. */
  activeTrips?: any[];
}) {
  const ids = useMemo(() => buses.map((b) => b.id).filter(Boolean), [buses]);
  const { positions, connected } = useLiveBuses(ids);
  const [now, setNow] = useState(() => Date.now());
  const [pathMode, setPathMode] = useState<"stops" | "snapped">("stops");
  // Internal fallback selection so the info card works even when callers
  // don't wire up controlled selection (e.g. the dashboard map).
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const effectiveSelected = selectedBusId !== undefined ? selectedBusId : internalSelected;
  const handleSelect = (id: string) => {
    setInternalSelected((cur) => (cur === id ? null : id));
    onSelect?.(id);
  };
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const points = useMemo(() => Object.values(positions), [positions]);
  const byId = useMemo(() => new Map<string, FleetBus>(buses.map((b) => [b.id, b])), [buses]);

  // Stable color per route across renders.
  const routeColor = useMemo(() => {
    const m = new Map<string, string>();
    const uniques = Array.from(new Set(tripRoutes.map((t) => t.routeId)));
    uniques.forEach((rid, i) => m.set(rid, PALETTE[i % PALETTE.length]));
    return m;
  }, [tripRoutes]);

  const uniqueRouteIds = useMemo(
    () => Array.from(new Set(tripRoutes.map((t) => t.routeId))),
    [tripRoutes],
  );

  const selectedRouteId = effectiveSelected
    ? tripRoutes.find((t) => t.busId === effectiveSelected)?.routeId ?? null
    : null;

  const selectedBus = effectiveSelected ? byId.get(effectiveSelected) : undefined;
  const selectedPos = effectiveSelected ? positions[effectiveSelected] : undefined;
  const selectedTrip = effectiveSelected
    ? activeTrips.find((t: any) => (t.busId || t.bus_id) === effectiveSelected)
    : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
        <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
        <span className="font-medium">{connected ? "Live" : "Connexion…"}</span>
        <span className="text-muted-foreground">· {points.length}/{buses.length} bus</span>
      </div>
      {tripRoutes.length > 0 && (
        <div
          className="absolute right-3 top-3 z-10 inline-flex rounded-full border border-border bg-background/90 p-0.5 text-xs shadow-sm backdrop-blur"
          role="radiogroup"
          aria-label="Affichage du trajet"
        >
          <button
            type="button"
            role="radio"
            aria-checked={pathMode === "stops"}
            onClick={() => setPathMode("stops")}
            className={`rounded-full px-3 py-1 font-medium transition ${
              pathMode === "stops" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Lignes pointillées entre arrêts (gratuit)"
          >
            Arrêts
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={pathMode === "snapped"}
            onClick={() => setPathMode("snapped")}
            className={`rounded-full px-3 py-1 font-medium transition ${
              pathMode === "snapped" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Tracé routier réel via Google Directions (mis en cache 7j)"
          >
            Routes
          </button>
        </div>
      )}
      <div style={{ height }}>
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={["routes"]}>
          <GMap
            mapId="ecobus-live-fleet"
            defaultCenter={DEFAULT_MAP_CENTER}
            defaultZoom={DEFAULT_MAP_ZOOM}
            gestureHandling="greedy"
            disableDefaultUI={false}
            clickableIcons={false}
          >
            <FitBounds points={points} />
            {uniqueRouteIds.map((rid) => (
              <TripRoutePolyline
                key={rid}
                routeId={rid}
                isSelected={rid === selectedRouteId}
                color={routeColor.get(rid) || "#0ea5e9"}
                mode={pathMode}
              />
            ))}
            {points.map((p) => {
              const bus = byId.get(p.busId);
              const stale = now - p.updatedAt > STALE_MS;
              const isSelected = effectiveSelected === p.busId;
              return (
                <AdvancedMarker
                  key={p.busId}
                  position={{ lat: p.lat, lng: p.lng }}
                  onClick={() => handleSelect(p.busId)}
                  title={bus?.name || bus?.plateNumber || p.busId}
                >
                  <Pin
                    background={stale ? "#9ca3af" : isSelected ? "#0ea5e9" : "#10b981"}
                    borderColor={isSelected ? "#0369a1" : "#065f46"}
                    glyphColor="#ffffff"
                    scale={isSelected ? 1.3 : 1.0}
                  />
                </AdvancedMarker>
              );
            })}
          </GMap>
        </APIProvider>
        {effectiveSelected && selectedBus && (
          <BusInfoCard
            bus={selectedBus}
            position={selectedPos}
            trip={selectedTrip}
            onClose={() => {
              setInternalSelected(null);
              onSelect?.(effectiveSelected);
            }}
          />
        )}
      </div>
    </div>
  );
}
