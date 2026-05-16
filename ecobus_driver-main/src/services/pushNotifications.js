import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevicesAPI } from './api';

/**
 * Driver push-notification service.
 * Mirrors the parent app's contract:
 *   - configureForegroundPresentation(): wires foreground banner/sound/badge
 *   - registerPushNotifications(): asks permission, gets the FCM/APNs token,
 *     creates the Android channel, posts the token to the backend, and caches
 *     it locally so we don't re-register on every launch.
 *
 * Remote push was removed from Expo Go in SDK 53, so all of this is a no-op
 * inside Expo Go. On a production build (FCM/APNs) it works normally.
 */
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
const LAST_TOKEN_KEY = '@ecobus-driver/lastPushToken';

let cached = null;

async function loadDeps() {
  const Notifications = await import('expo-notifications').catch(() => null);
  const Device        = await import('expo-device').catch(() => null);
  if (!Notifications || !Device) return null;
  return { Notifications, Device };
}

async function ensureAndroidChannel(Notifications) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'EcoBus Driver alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#229BA6',
  });
}

async function requestPermission(Notifications) {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function registerPushNotifications() {
  if (IS_EXPO_GO) return null;
  if (cached) return cached;

  const deps = await loadDeps();
  if (!deps) return null;
  const { Notifications, Device } = deps;

  if (!Device.isDevice) return null;

  const granted = await requestPermission(Notifications);
  if (!granted) return null;

  await ensureAndroidChannel(Notifications);

  let token;
  try {
    const result = await Notifications.getDevicePushTokenAsync();
    token = result?.data;
  } catch {
    return null;
  }
  if (!token) return null;

  const lastToken = await AsyncStorage.getItem(LAST_TOKEN_KEY);
  if (lastToken === token) {
    cached = token;
    return token;
  }

  try {
    await DevicesAPI.registerToken({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    await AsyncStorage.setItem(LAST_TOKEN_KEY, token);
    cached = token;
    return token;
  } catch {
    return null;
  }
}

export async function configureForegroundPresentation() {
  if (IS_EXPO_GO) return;
  const deps = await loadDeps();
  if (!deps) return;
  const { Notifications } = deps;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList:   true,
        shouldPlaySound:  true,
        shouldSetBadge:   true,
      }),
    });
  } catch { /* push not available */ }
}
