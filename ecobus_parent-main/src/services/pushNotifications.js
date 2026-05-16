import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevicesAPI } from './api';

// Remote push notifications were removed from Expo Go in SDK 53.
// Skip all push setup when running inside Expo Go to avoid the hard crash.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

const LAST_TOKEN_KEY = '@ecobus/lastPushToken';

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
    name: 'EcoBus alerts',
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

/**
 * Register the device for push and persist the token on the backend.
 * No-op in Expo Go (remote push not supported there since SDK 53).
 */
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

/**
 * Set up a foreground handler that surfaces alerts as banners + sound.
 * No-op in Expo Go.
 */
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
  } catch {
    // Silently ignore — push not available in this environment.
  }
}
