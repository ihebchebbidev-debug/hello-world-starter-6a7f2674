import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { I18nManager } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { ErrorBoundary, ToastProvider } from './src/components';
import i18n, { setupI18n, RTL_LANGUAGES } from './src/i18n';
import { configureForegroundPresentation, registerPushNotifications } from './src/services/pushNotifications';
import { Auth } from './src/services/api';

function DirectionProvider({ children }) {
  const [isRTL, setIsRTL] = useState(() => RTL_LANGUAGES.includes(i18n.language));

  useEffect(() => {
    const handler = (lng) => {
      const rtl = RTL_LANGUAGES.includes(lng);
      setIsRTL(rtl);
      try {
        I18nManager.allowRTL(rtl);
        I18nManager.forceRTL(rtl);
      } catch {}
    };
    i18n.on('languageChanged', handler);
    return () => i18n.off('languageChanged', handler);
  }, []);

  return (
    <View style={[styles.fill, { direction: isRTL ? 'rtl' : 'ltr' }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      setupI18n(),
      configureForegroundPresentation(),
    ]).finally(async () => {
      // If a session already exists from a previous launch, refresh the push token now.
      try {
        const tok = await Auth.getAccessToken();
        if (tok) registerPushNotifications().catch(() => {});
      } catch { /* no-op */ }
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <ErrorBoundary>
            <DirectionProvider>
              <RootNavigator />
            </DirectionProvider>
          </ErrorBoundary>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
