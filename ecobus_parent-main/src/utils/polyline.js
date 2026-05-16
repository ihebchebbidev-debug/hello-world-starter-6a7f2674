/**
 * polyline.js — geometry helpers for animating a route as the bus moves.
 *
 * The map shows two overlaid polylines:
 *   - traveled:  origin → marker (muted, behind)
 *   - upcoming:  marker → destination (primary, on top)
 *
 * As the smoothed marker advances, we re-split the route at the point on
 * the path closest to the marker. This produces the "fill" effect without
 * any per-frame allocations beyond the two slice arrays.
 *
 * All math uses an equirectangular approximation centered on the marker
 * latitude. For city-scale distances (a few km) the error is well under
 * 1m — far below GPS noise — and we avoid the cost of haversine on every
 * RAF tick.
 */

const EPS = 1e-12;

// Mean meters per 1° of latitude. Longitude is corrected per-call by the
// cosine of the local latitude.
const M_PER_DEG_LAT = 111_320;

/**
 * Project point P onto segment AB and return:
 *   { t, lat, lng, d2 } where t ∈ [0,1] along AB, d2 is squared distance
 *   in DEGREES² (Cartesian on lat/lng — only ever compared against itself).
 */
function projectOnSegment(ax, ay, bx, by, px, py) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS) {
    const ddx = px - ax, ddy = py - ay;
    return { t: 0, lat: ax, lng: ay, d2: ddx * ddx + ddy * ddy };
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const lat = ax + dx * t;
  const lng = ay + dy * t;
  const ddx = px - lat, ddy = py - lng;
  return { t, lat, lng, d2: ddx * ddx + ddy * ddy };
}

/**
 * Convert a "perpendicular distance in degrees" (already projected — so
 * dLat and dLng are the lat/lng deltas between marker and split point)
 * into meters using the equirectangular approximation at `latDeg`.
 */
function degreesToMeters(dLat, dLng, latDeg) {
  const mLat = dLat * M_PER_DEG_LAT;
  const mLng = dLng * M_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180);
  return Math.sqrt(mLat * mLat + mLng * mLng);
}

/**
 * Default off-route threshold (meters). 40m is wider than typical GPS
 * scatter (5–15m) and lane width (~3.5m) so we don't flicker on tight
 * urban roads, but tight enough to detect a wrong-turn or detour.
 */
export const DEFAULT_OFFROUTE_METERS = 40;

/**
 * Split a polyline at the point closest to `marker`.
 *
 * Returns:
 *   {
 *     traveled:    [{latitude,longitude}, …],   // origin → marker
 *     upcoming:    [{latitude,longitude}, …],   // marker → destination
 *     offRoute:    boolean,                     // marker too far from path
 *     offsetMeters:number,                      // perpendicular distance
 *   }
 *
 * Behavior:
 *   - No marker: returns the full route as `upcoming` with `offRoute=false`
 *     and `offsetMeters=0`. The map shows a single un-split route.
 *   - Marker on or near the path (≤ `offRouteMeters`): splits normally.
 *     The split point is included as the LAST point of `traveled` AND the
 *     FIRST point of `upcoming` so the two polylines meet exactly.
 *   - Marker farther than `offRouteMeters`: snaps NOTHING — returns the
 *     full route as `upcoming` and an empty `traveled`, plus `offRoute=true`
 *     so the caller can downgrade styling (e.g. dim the polyline, show a
 *     "rerouting…" hint). Avoids the rubber-band effect of dragging the
 *     reveal point across the map every time the bus takes a side street.
 *
 * Returns `null` only if the input route is too short to render.
 */
export function splitRouteAtMarker(route, marker, opts = {}) {
  const { offRouteMeters = DEFAULT_OFFROUTE_METERS } = opts;

  if (!route || route.length < 2) return null;
  if (!marker || marker.latitude == null || marker.longitude == null) {
    return { traveled: [], upcoming: route, offRoute: false, offsetMeters: 0 };
  }

  const px = marker.latitude;
  const py = marker.longitude;

  let bestSeg = 0;
  let bestLat = route[0].latitude;
  let bestLng = route[0].longitude;
  let bestD2 = Infinity;

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const r = projectOnSegment(a.latitude, a.longitude, b.latitude, b.longitude, px, py);
    if (r.d2 < bestD2) {
      bestD2 = r.d2;
      bestSeg = i;
      bestLat = r.lat;
      bestLng = r.lng;
    }
  }

  // Convert the (degree-space) perpendicular offset into meters at the
  // marker's latitude — this is what we threshold against.
  const offsetMeters = degreesToMeters(px - bestLat, py - bestLng, px);

  if (offsetMeters > offRouteMeters) {
    // Off-route: don't snap. Show the full planned route as still-upcoming
    // so the parent sees the intended path; the marker floats wherever the
    // bus actually is. Caller may dim the line to signal "rerouting".
    return { traveled: [], upcoming: route, offRoute: true, offsetMeters };
  }

  const splitPoint = { latitude: bestLat, longitude: bestLng };

  // Traveled = route[0..bestSeg] + splitPoint
  const traveled = route.slice(0, bestSeg + 1);
  traveled.push(splitPoint);

  // Upcoming = splitPoint + route[bestSeg+1..end]
  const upcoming = [splitPoint, ...route.slice(bestSeg + 1)];

  return { traveled, upcoming, offRoute: false, offsetMeters };
}
