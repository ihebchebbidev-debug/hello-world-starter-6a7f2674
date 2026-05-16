/**
 * Route-path utilities for live tracking maps.
 *
 * Cost-conscious strategy to avoid burning Google Maps Directions tokens:
 *   1. Stops are fetched from our own backend (free) and cached aggressively
 *      via react-query (staleTime 5min, no refetch on focus).
 *   2. The straight-line polyline through stops is computed locally — free.
 *   3. The road-snapped polyline (Google Directions API) is only requested
 *      LAZILY when a bus is explicitly selected by the user, and the result
 *      is persisted in localStorage for 7 days, keyed by a hash of the stop
 *      coordinates. Re-ordering a route invalidates the cache automatically.
 *   4. Identical routes shared by multiple buses fetch stops & snapped path
 *      exactly once thanks to react-query de-duplication + the cache key.
 */
import { useQuery } from "@tanstack/react-query";
import { RoutesAPI } from "@/lib/api";

export type LatLng = { lat: number; lng: number };

const SNAP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_PREFIX = "ecobus:routepath:v1:";

export function useRouteStops(routeId?: string | null) {
  return useQuery({
    queryKey: ["route-stops", routeId],
    queryFn: () => RoutesAPI.stops(routeId!),
    enabled: !!routeId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Extract a sorted, deduplicated LatLng list from a stops payload. */
export function stopsToLatLng(stops: any[] | undefined | null): LatLng[] {
  if (!Array.isArray(stops)) return [];
  const sorted = [...stops].sort((a, b) => {
    const ai = a.sequence ?? a.order ?? a.position ?? 0;
    const bi = b.sequence ?? b.order ?? b.position ?? 0;
    return ai - bi;
  });
  const out: LatLng[] = [];
  for (const s of sorted) {
    const lat = Number(s.lat ?? s.latitude);
    const lng = Number(s.lng ?? s.lon ?? s.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const last = out[out.length - 1];
      if (!last || last.lat !== lat || last.lng !== lng) out.push({ lat, lng });
    }
  }
  return out;
}

/** Stable fingerprint for the ordered stop list — invalidates cache on edit. */
export function pathHash(points: LatLng[]): string {
  if (points.length === 0) return "empty";
  // 5 decimals ≈ 1.1m precision; collapses tiny FP noise without losing fidelity.
  return points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
}

type CachedSnap = { hash: string; path: LatLng[]; savedAt: number };

export function loadCachedSnap(routeId: string, hash: string): LatLng[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + routeId);
    if (!raw) return null;
    const parsed: CachedSnap = JSON.parse(raw);
    if (parsed.hash !== hash) return null;
    if (Date.now() - parsed.savedAt > SNAP_TTL_MS) return null;
    return parsed.path;
  } catch {
    return null;
  }
}

export function saveCachedSnap(routeId: string, hash: string, path: LatLng[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedSnap = { hash, path, savedAt: Date.now() };
    localStorage.setItem(STORAGE_PREFIX + routeId, JSON.stringify(payload));
  } catch {
    /* quota exceeded — silently ignore, we'll retry next session */
  }
}
