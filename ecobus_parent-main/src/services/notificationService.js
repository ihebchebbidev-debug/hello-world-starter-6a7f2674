import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Push permission façade. Wire up to a real provider (FCM, expo-notifications,
 * OneSignal) inside the marked sections — the rest of the app stays decoupled.
 *
 * Platform notes:
 *   iOS — Apple HIG: ask only after the user has seen value, never on first launch.
 *         Use UNUserNotificationCenter via your push library.
 *   Android — API 33+ requires the runtime POST_NOTIFICATIONS permission.
 *             Older versions grant it implicitly via the manifest.
 */
export async function requestNotificationPermission() {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    // iOS / older Android — wire your push SDK here and return its boolean.
    return true;
  } catch {
    return false;
  }
}

export async function getDeviceToken() {
  // Wire to your push SDK, e.g. messaging().getToken().
  return null;
}