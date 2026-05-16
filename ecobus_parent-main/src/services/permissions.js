import { Alert, Linking, Platform, PermissionsAndroid } from 'react-native';

/**
 * Two-step permission flow required by both stores:
 *   1. Show a *contextual* rationale BEFORE the system prompt.
 *   2. Only then ask the OS.
 *
 * This file is the only place that calls the OS permission APIs so we
 * can audit it for the Data Safety form.
 */

const askWithRationale = ({ title, message, settingsHint }) =>
  new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continue', onPress: () => resolve(true) },
      ...(settingsHint
        ? [{ text: 'Open settings', onPress: () => { Linking.openSettings(); resolve(false); } }]
        : []),
    ]);
  });

/**
 * Foreground location — only used to center the live tracking map.
 * We never request background location.
 */
export async function requestLocationPermission() {
  const ok = await askWithRationale({
    title: 'Show your area on the map?',
    message:
      "EcoBus uses your location only to center the live tracking map. " +
      "Your location is never stored or shared. You can decline and still see the bus.",
  });
  if (!ok) return false;

  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location for live map',
        message: 'EcoBus uses your location to center the live tracking map.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  // iOS: the Info.plist NSLocationWhenInUseUsageDescription string drives the system dialog.
  // The actual prompt is shown by react-native-maps the first time it reads location.
  return true;
}

/**
 * Push notifications — Android 13+ requires runtime grant. iOS prompt
 * is triggered from the notification service.
 */
export async function requestNotificationPermission() {
  const ok = await askWithRationale({
    title: 'Get bus alerts?',
    message:
      'We send a notification when your child boards the bus, when the bus is near the stop, and for emergencies. You can disable this anytime in Settings.',
  });
  if (!ok) return false;

  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}
