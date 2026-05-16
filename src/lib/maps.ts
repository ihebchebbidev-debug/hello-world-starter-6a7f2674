/**
 * Google Maps configuration — shared by every map surface in the
 * EcoBus admin dashboard (live tracking, geofence editor, route designer,
 * stop picker, etc.).
 *
 * The same key is hardcoded in the parent and driver Expo apps
 * (ecobus_parent-main/app.json, ecobus_driver-main/app.json) so all three
 * surfaces hit the same Google Cloud project.
 *
 * Recommended restrictions in Google Cloud Console:
 *   - HTTP referrers (web): *.lovable.app, *.lovable.dev, your custom domain
 *   - Android apps: package + SHA-1 of app.ecobus.parents and app.ecobus.driver
 *   - iOS apps: bundle id app.ecobus.parents and app.ecobus.driver
 *   - APIs: Maps JavaScript API, Maps SDK Android, Maps SDK iOS, Geocoding,
 *           Directions, Places (only the ones you actually use)
 */
export const GOOGLE_MAPS_API_KEY = "AIzaSyCG5E5SZLZYoEo3SQujz-oIlRk5WMGarQI";

/** Tunisia centroid — sensible default map center for the dashboard. */
export const DEFAULT_MAP_CENTER = { lat: 34.0, lng: 9.0 };
export const DEFAULT_MAP_ZOOM = 7;

/** Convenience helper for the Maps JS API loader script. */
export const googleMapsScriptUrl = (libraries: string[] = ["places"]) =>
  `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=${libraries.join(",")}`;
