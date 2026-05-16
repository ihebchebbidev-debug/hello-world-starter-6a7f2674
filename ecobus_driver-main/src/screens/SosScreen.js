import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography, radius } from '../theme';
import { SosAPI } from '../services/api';
import { useToast } from '../components';
import { humanizeError } from '../utils/errors';

const HOLD_DURATION = 2000; // 2 seconds hold to trigger

export default function SosScreen({ navigation }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('idle'); // idle | holding | sent
  const [holding, setHolding] = useState(false);
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const progress = useRef(new Animated.Value(0)).current;
  const pulse    = useRef(new Animated.Value(1)).current;
  const glow     = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef(null);
  const progressAnim = useRef(null);
  const mounted = useRef(true);

  // Pulsing glow animation + unmount cleanup
  useEffect(() => {
    Animated.timing(glow, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.10, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
    return () => {
      mounted.current = false;
      clearTimeout(holdTimer.current);
      progressAnim.current?.stop();
      Vibration.cancel();
    };
  }, []);

  const startHold = () => {
    if (phase !== 'idle') return;
    setHolding(true);
    Vibration.vibrate(50);

    // Progress bar fill
    progressAnim.current = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressAnim.current.start();

    holdTimer.current = setTimeout(triggerSos, HOLD_DURATION);
  };

  const cancelHold = () => {
    if (!holding || phase !== 'idle') return;
    setHolding(false);
    progressAnim.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    clearTimeout(holdTimer.current);
  };

  const triggerSos = async () => {
    if (!mounted.current) return;
    setHolding(false);
    setSending(true);
    Vibration.vibrate([0, 100, 100, 100]);
    try {
      await SosAPI.trigger();
      // Success — show the confirmation screen.
      if (mounted.current) {
        setPhase('sent');
        toast.show(t('sos.sent'), { tone: 'success' });
      }
    } catch (err) {
      // Real failure — surface it instead of pretending the SOS was sent.
      if (mounted.current) {
        const reason = humanizeError(err, t);
        toast.show(`${t('errors.sosFailed')} : ${reason}`, { tone: 'danger' });
        // Reset progress + UI so the driver can retry immediately.
        progress.setValue(0);
        setPhase('idle');
      }
    } finally {
      if (mounted.current) setSending(false);
    }
  };

  const dismiss = () => navigation?.goBack?.();

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.secondary} translucent={false} />

      {/* Background */}
      <Animated.View style={[s.glowBig, { opacity: glow, transform: [{ scale: pulse }] }]} pointerEvents="none" />
      <View style={s.glowSmall} pointerEvents="none" />

      <SafeAreaView style={s.safeArea}>

        {/* Close button */}
        <Pressable onPress={dismiss} style={s.closeBtn} hitSlop={12} accessibilityRole="button">
          <MaterialCommunityIcons name="close" size={22} color="rgba(255,255,255,0.6)" />
        </Pressable>

        {phase === 'sent' ? (
          /* ── Sent confirmation ── */
          <View style={s.center}>
            <View style={s.sentRing}>
              <View style={s.sentIcon}>
                <MaterialCommunityIcons name="check" size={44} color="#fff" />
              </View>
            </View>
            <Text style={s.sentTitle}>{t('sos.sent')}</Text>
            <Text style={s.sentBody}>{t('sos.sentBody')}</Text>
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [s.dismissBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Text style={s.dismissBtnText}>{t('common.close')}</Text>
            </Pressable>
          </View>
        ) : (
          /* ── Hold to send ── */
          <View style={s.center}>
            <Text style={s.screenTitle}>{t('sos.title')}</Text>
            <Text style={s.instruction}>{t('sos.instruction')}</Text>

            {/* SOS button */}
            <Pressable
              onPressIn={startHold}
              onPressOut={cancelHold}
              disabled={sending}
              style={({ pressed }) => [
                s.sosBtn,
                (holding || sending) && s.sosBtnHolding,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('sos.send')}
            >
              <MaterialCommunityIcons
                name="alert-octagon"
                size={56}
                color={holding || sending ? '#fff' : colors.danger}
              />
              <Text style={[s.sosBtnLabel, (holding || sending) && s.sosBtnLabelHolding]}>
                {sending ? '…' : holding ? t('sos.holding') : 'SOS'}
              </Text>
            </Pressable>

            {/* Hold progress bar */}
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressFill, { width: progressWidth }]} />
            </View>

            <Pressable onPress={dismiss} style={s.cancelLink} hitSlop={12}>
              <Text style={s.cancelText}>{t('sos.cancel')}</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const SOS_BTN = 140;

const s = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: colors.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  glowBig: {
    position: 'absolute', width: 400, height: 400, borderRadius: 200,
    backgroundColor: colors.danger, opacity: 0.08,
  },
  glowSmall: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: colors.danger, opacity: 0.06,
  },
  safeArea: { flex: 1, width: '100%' },
  closeBtn: {
    position: 'absolute', top: spacing.sm, right: spacing.md,
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },

  screenTitle: { ...typography.title, color: colors.textInverse, marginBottom: spacing.sm, textAlign: 'center' },
  instruction: {
    ...typography.body, color: 'rgba(255,255,255,0.55)',
    textAlign: 'center', maxWidth: 260, marginBottom: spacing.xxl,
  },

  sosBtn: {
    width: SOS_BTN, height: SOS_BTN, borderRadius: SOS_BTN / 2,
    borderWidth: 3, borderColor: colors.danger,
    backgroundColor: 'rgba(217,45,32,0.12)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
    marginBottom: spacing.xl,
  },
  sosBtnHolding: {
    backgroundColor: colors.danger, borderColor: colors.dangerDark,
    shadowColor: colors.danger, shadowOpacity: 0.6, shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  sosBtnLabel: {
    ...typography.button, fontSize: 18, color: colors.danger, letterSpacing: 2, fontWeight: '900',
  },
  sosBtnLabelHolding: { color: '#fff' },

  progressTrack: {
    width: 200, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', marginBottom: spacing.xl,
  },
  progressFill: {
    height: '100%', borderRadius: 2, backgroundColor: colors.danger,
  },

  cancelLink: { paddingVertical: spacing.xs },
  cancelText: { ...typography.bodySm, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },

  /* Sent state */
  sentRing: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 2, borderColor: 'rgba(3,152,85,0.30)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(3,152,85,0.08)', marginBottom: spacing.xl,
  },
  sentIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.success, shadowOpacity: 0.5, shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },
  sentTitle: { ...typography.title, color: colors.textInverse, marginBottom: spacing.sm, textAlign: 'center' },
  sentBody: {
    ...typography.body, color: 'rgba(255,255,255,0.55)',
    textAlign: 'center', maxWidth: 260, marginBottom: spacing.xxl,
  },
  dismissBtn: {
    paddingHorizontal: spacing.xxl, paddingVertical: spacing.sm,
    backgroundColor: colors.success, borderRadius: radius.pill,
  },
  dismissBtnText: { ...typography.button, color: '#fff' },
});
