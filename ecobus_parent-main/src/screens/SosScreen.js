import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Platform, Pressable,
  StyleSheet, Text, Vibration, View, useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, Icon, Badge, useToast, ScreenHeader } from '../components';
import { SosAPI } from '../services/api';
import { humanizeError } from '../utils/errors';
import { colors, radius, spacing, typography, shadows, layout } from '../theme';

const HOLD_MS = 2000;

/**
 * SOS — emergency alert with circular pulse pattern and a
 * deliberate long-press confirmation to prevent accidental triggers.
 */
export default function SosScreen({ navigation }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { width: screenWidth } = useWindowDimensions();
  // Clamp ring: 55% of screen width, min 180, max 240 — safe on 320pt SE & tablets
  const RING_SIZE = Math.min(240, Math.max(180, Math.round(screenWidth * 0.55)));
  const [state, setState] = useState('idle'); // idle | holding | sent
  const [sentAt, setSentAt] = useState(null);

  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const fill   = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef(null);
  const fillAnim  = useRef(null);

  useEffect(() => {
    if (state === 'sent') return undefined;
    const loop = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ]),
      );
    const a = loop(pulse1, 0);
    const b = loop(pulse2, 900);
    a.start(); b.start();
    return () => { a.stop(); b.stop(); };
  }, [state, pulse1, pulse2]);

  const cleanup = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (fillAnim.current)  { fillAnim.current.stop(); fillAnim.current = null; }
  };

  const startHold = () => {
    if (state === 'sent') return;
    setState('holding');
    if (Platform.OS === 'android') Vibration.vibrate(20);
    AccessibilityInfo.announceForAccessibility?.(t('sos.a11yHolding'));

    fillAnim.current = Animated.timing(fill, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    fillAnim.current.start();

    holdTimer.current = setTimeout(async () => {
      cleanup();
      // Don't lie to the parent: keep state as 'holding' until the server
      // confirms. Only flip to 'sent' on a successful response.
      Vibration.vibrate(Platform.OS === 'android' ? [0, 80, 60, 120] : 400);
      try {
        await SosAPI.trigger({ message: 'Parent emergency from mobile app' });
        setState('sent');
        setSentAt(new Date());
        AccessibilityInfo.announceForAccessibility?.(t('sos.a11ySent'));
        toast.show(t('sos.sentToast'), { tone: 'success' });
      } catch (err) {
        // Real failure — surface it in French and reset so the parent can retry.
        const reason = humanizeError(err, t);
        toast.show(`${t('errors.sosFailed')} : ${reason}`, { tone: 'danger' });
        fill.setValue(0);
        setState('idle');
      }
    }, HOLD_MS);
  };

  const cancelHold = () => {
    if (state !== 'holding') return;
    cleanup();
    Animated.timing(fill, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    setState('idle');
  };

  const reset = () => {
    cleanup();
    fill.setValue(0);
    setState('idle');
    setSentAt(null);
  };

  useEffect(() => () => cleanup(), []);

  const ringStyle = (val) => ({
    transform: [{
      scale: val.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }),
    }],
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
  });

  const sent = state === 'sent';

  return (
    <Screen background={sent ? colors.successDark : colors.secondary} statusBarStyle="light-content">
      <ScreenHeader
        title={t('sos.title')}
        onBack={() => navigation.goBack()}
        inverted
      />

      {/* Status pill */}
      <View style={s.pillWrap}>
        <Badge
          label={sent ? t('sos.alertSent') : state === 'holding' ? t('sos.holdToConfirm') : t('sos.pressAndHold')}
          tone={sent ? 'success' : state === 'holding' ? 'warning' : 'danger'}
        />
      </View>

      {/* Pulse area */}
      <View style={s.center}>
        {!sent ? (
          <>
            <Animated.View style={[s.ring, { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2 }, ringStyle(pulse1)]} />
            <Animated.View style={[s.ring, { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2 }, ringStyle(pulse2)]} />
          </>
        ) : null}

        <Pressable
          onPressIn={startHold}
          onPressOut={cancelHold}
          onPress={sent ? reset : undefined}
          style={({ pressed }) => [
            s.button,
            { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2 },
            sent ? s.buttonSent : null,
            pressed && !sent ? { transform: [{ scale: 0.97 }] } : null,
          ]}
          android_disableSound
          accessibilityRole="button"
          accessibilityLabel={sent ? t('sos.a11yReset') : t('sos.a11yHold')}
          accessibilityHint={t('sos.a11yHint')}
        >
          {!sent ? (
            <Animated.View
              pointerEvents="none"
              style={[
                s.progress,
                {
                  width: RING_SIZE + 24, height: RING_SIZE + 24,
                  borderRadius: (RING_SIZE + 24) / 2,
                  opacity: fill.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 1, 1] }),
                  transform: [{
                    scale: fill.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.05] }),
                  }],
                },
              ]}
            />
          ) : null}

          <Icon
            name={sent ? 'statusOnBus' : 'sos'}
            size={64}
            tint={colors.textInverse}
          />
        </Pressable>

        <Text style={s.bigLabel}>
          {sent ? t('sos.alertSent') : state === 'holding' ? t('sos.hold') : t('sos.emergencyAlert')}
        </Text>
        {sent && sentAt ? (
          <Text style={s.sentTime}>
            {t('sos.sentAt', {
              time: sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            })}
          </Text>
        ) : null}
        <Text style={s.help}>
          {sent ? t('sos.sentBody') : t('sos.instructions')}
        </Text>
      </View>

      {/* Footer action */}
      {sent ? (
        <Pressable onPress={reset} style={s.secondary} accessibilityRole="button">
          <Text style={s.secondaryText}>{t('common.done')}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  pillWrap: { alignItems: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  ring: {
    position: 'absolute',
    backgroundColor: colors.dangerLight,
  },
  button: {
    backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.modal,
  },
  buttonSent: { backgroundColor: colors.primary },
  progress: {
    position: 'absolute',
    borderWidth: 4, borderColor: colors.danger,
  },

  bigLabel: { ...typography.title, color: colors.textInverse, fontWeight: '700', marginTop: spacing.xl },
  sentTime: {
    ...typography.caption,
    color: colors.onBrandMuted,
    marginTop: spacing.xs,
    letterSpacing: 0.3,
  },
  help: {
    ...typography.bodySm, color: colors.onBrandMuted,
    textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md,
    maxWidth: 320,
  },

  secondary: {
    height: 52, borderRadius: radius.md,
    backgroundColor: colors.onBrandHigh,
    borderWidth: 1, borderColor: colors.onBrandMid,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: layout.bottomSafe,
  },
  secondaryText: { ...typography.button, color: colors.onBrandMuted, fontWeight: '600' },
});
