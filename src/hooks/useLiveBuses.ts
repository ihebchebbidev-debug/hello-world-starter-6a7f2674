/**
 * Realtime bus tracking for the EcoBus admin dashboard.
 *
 * Connects to the backend's Socket.IO `/ws` namespace (same channel the
 * parent + driver mobile apps use), authenticates with the admin JWT, and
 * subscribes to every bus in the org.
 *
 * Backend scopes by the JWT's `org` claim, so:
 *   - school admins only get pings for THEIR org's buses,
 *   - super admins get pings for every org (backend joins them to all rooms).
 *
 * Returns a map { busId -> { lat, lng, speed, heading, updatedAt, ... } }
 * that updates in place. Falls back to seeding from `GET /buses/:id/live`
 * so the map shows last-known positions before any socket event arrives.
 */
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Auth, BASE_URL, BusesAPI } from "@/lib/api";
import { mapPool } from "@/lib/concurrency";

export type BusLive = {
  busId: string;
  tripId?: string | null;
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  batteryLevel?: number | null;
  updatedAt: number;
};

const SOCKET_ROOT = BASE_URL.replace(/\/api\/v1\/?$/, "");

function normalize(p: any): BusLive | null {
  const lat = Number(p?.lat ?? p?.latitude);
  const lng = Number(p?.lng ?? p?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    busId: String(p?.busId ?? p?.bus_id ?? ""),
    tripId: p?.tripId ?? p?.trip_id ?? null,
    lat,
    lng,
    speed: p?.speed != null ? Number(p.speed) : null,
    heading: p?.heading != null ? Number(p.heading) : null,
    accuracy: p?.accuracy != null ? Number(p.accuracy) : null,
    batteryLevel: p?.batteryLevel ?? p?.battery_level ?? null,
    updatedAt: Date.now(),
  };
}

// Drop noise jitter (<5m) so identical GPS pings don't trigger React renders.
function isMeaningfulMove(prev: BusLive | undefined, next: BusLive): boolean {
  if (!prev) return true;
  const dLat = Math.abs(prev.lat - next.lat);
  const dLng = Math.abs(prev.lng - next.lng);
  // ~0.00005 deg ≈ 5.5m. Always accept if speed/heading changed materially.
  if (dLat > 0.00005 || dLng > 0.00005) return true;
  if (Math.abs((prev.speed ?? 0) - (next.speed ?? 0)) > 1) return true;
  return false;
}

export function useLiveBuses(busIds: string[], opts?: { crossOrg?: boolean }) {
  const crossOrg = !!opts?.crossOrg;
  const [positions, setPositions] = useState<Record<string, BusLive>>({});
  const [connected, setConnected] = useState(false);
  const idsKey = busIds.slice().sort().join(",");
  const socketRef = useRef<Socket | null>(null);

  // Coalesce bursty socket updates into one render per animation frame.
  const pendingRef = useRef<Record<string, BusLive>>({});
  const rafRef = useRef<number | null>(null);
  const flush = () => {
    rafRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = {};
    setPositions((prev) => {
      let changed = false;
      const next = prev;
      const merged: Record<string, BusLive> = { ...prev };
      for (const [id, p] of Object.entries(pending)) {
        if (isMeaningfulMove(prev[id], p)) {
          merged[id] = p;
          changed = true;
        }
      }
      return changed ? merged : next;
    });
  };
  const enqueue = (p: BusLive) => {
    pendingRef.current[p.busId] = p;
    if (rafRef.current != null) return;
    rafRef.current =
      typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame(flush)
        : (setTimeout(flush, 100) as unknown as number);
  };

  // Seed last-known positions from REST so the map isn't empty before sockets fire.
  useEffect(() => {
    let cancelled = false;
    if (!busIds.length) return;
    // Cap at 6 parallel HTTP calls — large fleets don't open hundreds of sockets.
    mapPool(busIds, 6, async (id) => {
      // Super-admins seed across orgs via `?scope=all`; otherwise the call
      // is org-scoped exactly as before. Backend gates `scope=all` by role.
      const live = await BusesAPI.live(id, crossOrg ? { scope: "all" } : undefined).catch(() => null);
      return live ? normalize({ ...live, busId: id }) : null;
    }).then((rows) => {
      if (cancelled) return;
      setPositions((prev) => {
        const next = { ...prev };
        for (const r of rows) if (r && r.busId) next[r.busId] = r;
        return next;
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = Auth.getToken();
    if (!token) return;

    const socket = io(`${SOCKET_ROOT}/ws`, {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      for (const id of busIds) socket.emit("subscribe", `bus:${id}`);
      socket.emit("subscribe", "org");
    });
    socket.on("disconnect", () => setConnected(false));

    const handleLocation = (payload: any) => {
      const norm = normalize(payload);
      if (!norm || !norm.busId) return;
      enqueue(norm);
    };
    socket.on("bus.location.updated", handleLocation);
    socket.on("bus.location", handleLocation);
    socket.on("bus:location", handleLocation);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      if (rafRef.current != null) {
        if (typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(rafRef.current);
        else clearTimeout(rafRef.current as unknown as number);
        rafRef.current = null;
      }
      pendingRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return { positions, connected };
}
