import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography, shadows } from '../theme';

const ToastCtx = createContext({ show: () => {} });

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(20)).current;
  const hideTimer = useRef(null);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity,   { toValue: 0,  duration: 180, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 20, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translate]);

  const show = useCallback((message, { tone = 'info', duration = 2500 } = {}) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast({ message, tone });
    Animated.parallel([
      Animated.timing(opacity,   { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
    AccessibilityInfo.announceForAccessibility?.(message);
    hideTimer.current = setTimeout(dismiss, duration);
  }, [opacity, translate, dismiss]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            shadows.modal,
            {
              opacity,
              transform: [{ translateY: translate }],
              bottom: insets.bottom + spacing.lg,
              backgroundColor: TONE_BG[toast.tone] ?? TONE_BG.info,
            },
          ]}
        >
          <Text style={styles.text}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

const TONE_BG = {
  info:    colors.textPrimary,
  success: colors.primaryDark,
  danger:  colors.danger,
  warning: colors.warningDark,
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  text: { ...typography.bodySm, color: colors.textInverse, fontWeight: '500' },
});
