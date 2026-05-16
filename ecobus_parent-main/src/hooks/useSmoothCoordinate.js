import { useEffect, useRef, useState } from 'react';

/**
 * useSmoothCoordinate — client-side interpolation for live GPS markers.
 *
 * GPS sockets typically deliver one fix every 3–10 seconds. Plotting each
 * fix directly makes the marker "teleport" between points, which feels
 * broken even when the data is correct. This hook smooths the path by
 * easing from the previously-rendered position to each new target over
 * the expected interval between updates, using requestAnimationFrame.
 *
 * Design notes:
 * - We render through React state (not Animated) so existing <Marker>
 *   props keep working unchanged and we don't need MapView.AnimatedRegion.
 * - State updates are throttled to ~30 fps to keep JS bridge traffic low
 *   on Android while still looking fluid.
 * - First fix snaps instantly (no animation from a null origin).
 * - If a new target arrives mid-tween we re-base from the *current*
 *   interpolated position so motion stays continuous (no rubber-banding).
 * - Tweens longer than `maxDurationMs` are clamped — protects against
 *   a stale fix arriving after a long socket gap and dragging the marker
 *   slowly across the city.
 *
 * @param {{lat:number,lng:number}|null} target - latest GPS fix
 * @param {object} [opts]
 * @param {number} [opts.durationMs=2500] expected gap between fixes
 * @param {number} [opts.maxDurationMs=4000] clamp for the tween length
 * @param {number} [opts.frameMs=33] min ms between state updates (~30 fps)
 * @returns {{latitude:number,longitude:number}|null}
 */
export default function useSmoothCoordinate(target, opts = {}) {
  const { durationMs = 2500, maxDurationMs = 4000, frameMs = 33 } = opts;

  const [coord, setCoord] = useState(() =>
    target?.lat != null && target?.lng != null
      ? { latitude: target.lat, longitude: target.lng }
      : null,
  );

  const rafRef       = useRef(0);
  const fromRef      = useRef(null); // {lat,lng} we're easing FROM
  const toRef        = useRef(null); // {lat,lng} we're easing TO
  const startRef     = useRef(0);
  const durRef       = useRef(durationMs);
  const lastEmitRef  = useRef(0);
  const currentRef   = useRef(coord); // latest interpolated value

  // easeInOutQuad — gentle accel/decel, cheap to compute.
  const ease = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

  useEffect(() => {
    const lat = target?.lat;
    const lng = target?.lng;
    if (lat == null || lng == null) return undefined;

    // First fix: snap and bail.
    if (!currentRef.current) {
      const next = { latitude: lat, longitude: lng };
      currentRef.current = next;
      setCoord(next);
      return undefined;
    }

    // No-op if the new fix matches our destination (prevents re-tweening
    // when upstream callers re-emit identical payloads).
    const prevTo = toRef.current;
    if (prevTo && prevTo.lat === lat && prevTo.lng === lng) return undefined;

    // Re-base from the current interpolated position so motion stays
    // continuous if a new fix arrives mid-tween.
    fromRef.current  = { lat: currentRef.current.latitude, lng: currentRef.current.longitude };
    toRef.current    = { lat, lng };
    startRef.current = performance.now();
    durRef.current   = Math.min(maxDurationMs, Math.max(250, durationMs));

    const tick = (now) => {
      const t = Math.min(1, (now - startRef.current) / durRef.current);
      const k = ease(t);
      const from = fromRef.current;
      const to   = toRef.current;
      const latitude  = from.lat + (to.lat - from.lat) * k;
      const longitude = from.lng + (to.lng - from.lng) * k;

      currentRef.current = { latitude, longitude };

      // Throttle React state updates — RAF can fire at 60–120Hz but the
      // map only needs ~30 fps to look fluid, and each setState crosses
      // the JS bridge.
      if (t === 1 || now - lastEmitRef.current >= frameMs) {
        lastEmitRef.current = now;
        setCoord(currentRef.current);
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = 0;
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [target?.lat, target?.lng, durationMs, maxDurationMs, frameMs]);

  // Cleanup on unmount.
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  return coord;
}
