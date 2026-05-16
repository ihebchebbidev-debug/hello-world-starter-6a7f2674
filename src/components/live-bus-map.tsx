/**
 * Real-time fleet map (Leaflet + OpenStreetMap).
 * No Google Maps API key, no ApiNotActivatedMapError. Pure JS map.
 *
 * Route polylines:
 *   - Straight dashed line through stops (free, local).
 *   - "Routes" mode: road-snapped path via OSRM public demo
 *     (https://router.project-osrm.org — no key), cached 7 days in localStorage.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { RoutesAPI } from "@/lib/api";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/maps";
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

const STALE_MS = 60_000;
const PALETTE = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6", "#ef4444", "#6366f1"];

function busDivIcon(L: any, color: string, selected: boolean) {
  const size = selected ? 34 : 28;
  return L.divIcon({
    className: "ecobus-marker",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;">
      <div style="transform:rotate(45deg);color:#fff;font-size:14px;font-weight:700;">🚌</div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

function stopDivIcon(L: any, color: string) {
  return L.divIcon({
    className: "ecobus-stop-marker",
    html: `<div style="
      width:12px;height:12px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 3px rgba(0,0,0,.35);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

/** Fetch a road-snapped path from public OSRM. No API key. */
async function fetchOsrmPath(points: LatLng[]): Promise<LatLng[] | null> {
  if (points.length < 2) return null;
  // OSRM caps URL length; sample if very long.
  const MAX = 25;
  const sample =
    points.length <= MAX
      ? points
      : Array.from({ length: MAX }, (_, i) =>
          points[Math.round((i * (points.length - 1)) / (MAX - 1))],
        );
  const coords = sample.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json: any = await res.json();
    const c = json?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(c)) return null;
    return c.map((pt: [number, number]) => ({ lat: pt[1], lng: pt[0] }));
  } catch {
    return null;
  }
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
  tripRoutes?: TripRouteRef[];
  activeTrips?: any[];
}) {
  const ids = useMemo(() => buses.map((b) => b.id).filter(Boolean), [buses]);
  const { positions, connected } = useLiveBuses(ids);
  const [now, setNow] = useState(() => Date.now());
  const [pathMode, setPathMode] = useState<"stops" | "snapped">("stops");
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

  // Client-only mount gate (Leaflet touches window/document at import time).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="absolute left-3 top-3 z-[1000] inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
        <span className={`inline-block h-2 w-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
        <span className="font-medium">{connected ? "Live" : "Connexion…"}</span>
        <span className="text-muted-foreground">· {points.length}/{buses.length} bus</span>
      </div>
      {tripRoutes.length > 0 && (
        <div
          className="absolute right-3 top-3 z-[1000] inline-flex rounded-full border border-border bg-background/90 p-0.5 text-xs shadow-sm backdrop-blur"
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
            title="Tracé routier réel via OSRM (mis en cache 7j)"
          >
            Routes
          </button>
        </div>
      )}
      <div style={{ height }}>
        {mounted ? (
          <LeafletInner
            points={points}
            byId={byId}
            now={now}
            effectiveSelected={effectiveSelected}
            handleSelect={handleSelect}
            uniqueRouteIds={uniqueRouteIds}
            selectedRouteId={selectedRouteId}
            routeColor={routeColor}
            pathMode={pathMode}
            height={height}
          />
        ) : (
          <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground">
            Chargement de la carte…
          </div>
        )}
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

/** Client-only Leaflet renderer. */
function LeafletInner(props: {
  points: BusLive[];
  byId: Map<string, FleetBus>;
  now: number;
  effectiveSelected: string | null | undefined;
  handleSelect: (id: string) => void;
  uniqueRouteIds: string[];
  selectedRouteId: string | null;
  routeColor: Map<string, string>;
  pathMode: "stops" | "snapped";
  height: number;
}) {
  const {
    points,
    byId,
    now,
    effectiveSelected,
    handleSelect,
    uniqueRouteIds,
    selectedRouteId,
    routeColor,
    pathMode,
    height,
  } = props;

  // Dynamic imports so SSR never touches window/document.
  const [mods, setMods] = useState<any>(null);
  useEffect(() => {
    let cancel = false;
    Promise.all([
      import("react-leaflet"),
      import("leaflet"),
      // Side-effect: leaflet CSS
      import("leaflet/dist/leaflet.css" as any).catch(() => null),
      import("leaflet.markercluster" as any).catch(() => null),
      import("leaflet.markercluster/dist/MarkerCluster.css" as any).catch(() => null),
      import("leaflet.markercluster/dist/MarkerCluster.Default.css" as any).catch(() => null),
    ]).then(([rl, L]) => {
      if (!cancel) setMods({ rl, L: (L as any).default ?? L });
    });
    return () => {
      cancel = true;
    };
  }, []);

  if (!mods) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-muted-foreground">
        Chargement de la carte…
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Polyline, useMap } = mods.rl;
  const L = mods.L;

  function FitBounds({ pts }: { pts: BusLive[] }) {
    const map = useMap();
    const sig = pts
      .map((p) => `${p.busId}:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`)
      .sort()
      .join("|");
    useEffect(() => {
      if (!map || pts.length === 0) return;
      if (pts.length === 1) {
        map.setView([pts[0].lat, pts[0].lng], Math.max(map.getZoom(), 13));
        return;
      }
      const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [64, 64] });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sig]);
    return null;
  }

  function RoutePolyline({ routeId, isSelected, color, mode }: {
    routeId: string; isSelected: boolean; color: string; mode: "stops" | "snapped";
  }) {
    const stopsQ = useRouteStops(routeId);
    const stops = useMemo<LatLng[]>(() => stopsToLatLng(stopsQ.data), [stopsQ.data]);
    const hash = useMemo(() => pathHash(stops), [stops]);
    const [snapped, setSnapped] = useState<LatLng[] | null>(null);

    useEffect(() => {
      if (stops.length < 2) return;
      const cached = loadCachedSnap(routeId, hash);
      if (cached) setSnapped(cached);
    }, [routeId, hash, stops.length]);

    const wantsSnap = mode === "snapped" || isSelected;
    useEffect(() => {
      if (!wantsSnap || snapped || stops.length < 2) return;
      let cancel = false;
      fetchOsrmPath(stops).then((path) => {
        if (cancel || !path) return;
        setSnapped(path);
        saveCachedSnap(routeId, hash, path);
      });
      return () => { cancel = true; };
    }, [wantsSnap, snapped, stops, hash, routeId]);

    if (stops.length < 2) return null;
    const useSnapped = mode === "snapped" && !!snapped;
    const path = useSnapped ? snapped! : stops;
    const positions = path.map((p) => [p.lat, p.lng]) as [number, number][];

    return (
      <Polyline
        positions={positions}
        pathOptions={{
          color,
          weight: isSelected ? 5 : 3,
          opacity: useSnapped ? (isSelected ? 0.95 : 0.6) : (isSelected ? 0.9 : 0.55),
          dashArray: useSnapped ? undefined : "6 8",
        }}
      />
    );
  }

  /**
   * Stop markers for active routes, clustered + viewport-culled.
   * Stops are only rendered when the map is zoomed in enough (>= 11)
   * AND within the visible bounds — large fleets with many routes stay smooth.
   */
  function StopsClusterLayer({ routeIds, colors }: { routeIds: string[]; colors: Map<string, string> }) {
    const map = useMap();
    const groupRef = useRef<any>(null);
    const [bounds, setBounds] = useState<any>(() => map.getBounds());
    const [zoom, setZoom] = useState<number>(() => map.getZoom());

    useEffect(() => {
      const handler = () => { setBounds(map.getBounds()); setZoom(map.getZoom()); };
      map.on("moveend", handler);
      map.on("zoomend", handler);
      return () => { map.off("moveend", handler); map.off("zoomend", handler); };
    }, [map]);

    // useQueries safely handles a dynamic list of routes (no hooks-in-loop).
    const stopQueries = useQueries({
      queries: routeIds.map((rid) => ({
        queryKey: ["route-stops", rid],
        queryFn: () => RoutesAPI.stops(rid),
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
      })),
    });
    const updatedSig = stopQueries.map((q) => q.dataUpdatedAt).join("|");
    const allStops = useMemo(() => {
      const out: { lat: number; lng: number; color: string }[] = [];
      routeIds.forEach((rid, i) => {
        const color = colors.get(rid) || "#0ea5e9";
        const pts = stopsToLatLng(stopQueries[i]?.data);
        for (const p of pts) out.push({ lat: p.lat, lng: p.lng, color });
      });
      return out;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updatedSig, colors, routeIds.join("|")]);

    useEffect(() => {
      if (!(L as any).markerClusterGroup) return;
      if (!groupRef.current) {
        groupRef.current = (L as any).markerClusterGroup({
          chunkedLoading: true,
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          maxClusterRadius: 50,
        });
        map.addLayer(groupRef.current);
      }
      const group = groupRef.current;
      group.clearLayers();
      if (zoom < 11) return; // hide stops when zoomed out
      const visible = allStops.filter((s) => bounds.contains([s.lat, s.lng] as any));
      const markers = visible.map((s) =>
        L.marker([s.lat, s.lng], { icon: stopDivIcon(L, s.color), keyboard: false }),
      );
      group.addLayers(markers);
    }, [map, allStops, bounds, zoom]);

    useEffect(() => {
      return () => {
        if (groupRef.current) {
          map.removeLayer(groupRef.current);
          groupRef.current = null;
        }
      };
    }, [map]);

    return null;
  }

  /**
   * Bus markers — clustered, viewport-culled, and reused per busId so
   * realtime position updates animate smoothly instead of recreating markers.
   */
  function BusesClusterLayer({
    points, byId, now, selectedId, onPick,
  }: {
    points: BusLive[];
    byId: Map<string, FleetBus>;
    now: number;
    selectedId: string | null | undefined;
    onPick: (id: string) => void;
  }) {
    const map = useMap();
    const groupRef = useRef<any>(null);
    const markersRef = useRef<Map<string, any>>(new Map());
    const [bounds, setBounds] = useState<any>(() => map.getBounds());

    useEffect(() => {
      const handler = () => setBounds(map.getBounds());
      map.on("moveend", handler);
      map.on("zoomend", handler);
      return () => { map.off("moveend", handler); map.off("zoomend", handler); };
    }, [map]);

    // Initialize the cluster group once.
    useEffect(() => {
      if (!(L as any).markerClusterGroup) return;
      groupRef.current = (L as any).markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 60,
        disableClusteringAtZoom: 16,
      });
      map.addLayer(groupRef.current);
      return () => {
        if (groupRef.current) {
          map.removeLayer(groupRef.current);
          groupRef.current = null;
        }
        markersRef.current.clear();
      };
    }, [map]);

    // Sync markers — reuse per busId, only show those in viewport.
    useEffect(() => {
      const group = groupRef.current;
      if (!group) return;

      const liveIds = new Set(points.map((p) => p.busId));
      // Remove markers for buses that disappeared.
      for (const [id, m] of markersRef.current) {
        if (!liveIds.has(id)) {
          group.removeLayer(m);
          markersRef.current.delete(id);
        }
      }

      const toAdd: any[] = [];
      for (const p of points) {
        const inView = bounds.contains([p.lat, p.lng] as any);
        const existing = markersRef.current.get(p.busId);
        const stale = now - p.updatedAt > STALE_MS;
        const isSelected = selectedId === p.busId;
        const color = stale ? "#9ca3af" : isSelected ? "#0ea5e9" : "#10b981";

        if (!inView) {
          if (existing) {
            group.removeLayer(existing);
            markersRef.current.delete(p.busId);
          }
          continue;
        }

        if (existing) {
          existing.setLatLng([p.lat, p.lng]);
          existing.setIcon(busDivIcon(L, color, isSelected));
        } else {
          const bus = byId.get(p.busId);
          const m = L.marker([p.lat, p.lng], {
            icon: busDivIcon(L, color, isSelected),
            title: bus?.name || bus?.plateNumber || p.busId,
          });
          m.on("click", () => onPick(p.busId));
          markersRef.current.set(p.busId, m);
          toAdd.push(m);
        }
      }
      if (toAdd.length) group.addLayers(toAdd);
    }, [points, bounds, now, selectedId, byId, onPick]);

    return null;
  }

  return (
    <MapContainer
      center={[DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng]}
      zoom={DEFAULT_MAP_ZOOM}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
      />
      <FitBounds pts={points} />
      {uniqueRouteIds.map((rid) => (
        <RoutePolyline
          key={rid}
          routeId={rid}
          isSelected={rid === selectedRouteId}
          color={routeColor.get(rid) || "#0ea5e9"}
          mode={pathMode}
        />
      ))}
      {uniqueRouteIds.length > 0 && (
        <StopsClusterLayer routeIds={uniqueRouteIds} colors={routeColor} />
      )}
      <BusesClusterLayer
        points={points}
        byId={byId}
        now={now}
        selectedId={effectiveSelected ?? null}
        onPick={handleSelect}
      />
    </MapContainer>
  );
}
