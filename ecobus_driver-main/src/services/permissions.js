import * as Location from 'expo-location';

/**
 * Foreground location for the driver. Required to push GPS to the backend
 * during an active trip. Returns true only when the user accepted.
 */
export async function ensureForegroundLocation() {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') return true;
  const req = await Location.requestForegroundPermissionsAsync();
  return req.status === 'granted';
}

/**
 * Make sure location services are enabled at the device level (settings off
 * for example). Returns true if usable.
 */
export async function locationServicesEnabled() {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}
