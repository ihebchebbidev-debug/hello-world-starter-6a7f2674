/**
 * Lightweight geo utilities — pure JS, no API calls.
 *
 * Used to derive distance / ETA from a bus live position to a stop without
 * round-tripping the backend. We use the haversine ("great-circle") formula
 * which is the spherical equivalent of Pythagoras on the lat/lng plane and
 * accurate within < 0.5 % over school-bus distances.
 */

const R_KM = 6371; // Earth radius
const toRad = (deg) => (deg * Math.PI) / 180;

export function distanceKm(a, b) {
  if (!a || !b) return null;
  const lat1 = Number(a.lat ?? a.latitude);
  const lng1 = Number(a.lng ?? a.longitude);
  const lat2 = Number(b.lat ?? b.latitude);
  const lng2 = Number(b.lng ?? b.longitude);
  if ([lat1, lng1, lat2, lng2].some((v) => !Number.isFinite(v))) return null;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * ETA in minutes from `from` → `to`, using `speedKmh` (defaults to a typical
 * urban school-bus average). Returns null if coordinates are missing.
 */
export function etaMinutes(from, to, speedKmh = 30) {
  const km = distanceKm(from, to);
  if (km == null) return null;
  const v = Math.max(8, Number(speedKmh) || 30); // floor to avoid /0 at red lights
  return Math.round((km / v) * 60);
}

/**
 * Convenience: returns { distanceKm, etaMinutes, arrivalAt } or null.
 */
export function localEta(from, to, speedKmh = 30) {
  const km = distanceKm(from, to);
  if (km == null) return null;
  const mins = etaMinutes(from, to, speedKmh);
  return {
    distanceKm: +km.toFixed(2),
    etaMinutes: mins,
    arrivalAt : new Date(Date.now() + mins * 60_000).toISOString(),
    source    : 'local',
  };
}

/** Compass bearing in degrees from a → b. */
export function bearing(a, b) {
  const lat1 = toRad(Number(a.lat ?? a.latitude));
  const lat2 = toRad(Number(b.lat ?? b.latitude));
  const dLng = toRad(Number(b.lng ?? b.longitude) - Number(a.lng ?? a.longitude));
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
