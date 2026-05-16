import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Auth } from '../services/api';
import { ONBOARDED_KEY } from './OnboardingScreen';
import { LOCALE_STORAGE_KEY } from '../i18n';
import { colors, spacing, typography } from '../theme';
import { useContentStyle, useResponsive } from '../theme/responsive';
import { Icons } from '../assets/icons';

const BG = colors.secondary; // deep navy #0E1726

export default function SplashScreen({ navigation }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentStyle = useContentStyle();
  const { isCompact } = useResponsive();

  /* ── Animated values ── */
  const pulse     = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOp    = useRef(new Animated.Value(0)).current;
  const textOp    = useRef(new Animated.Value(0)).current;
  const barWidth  = useRef(new Animated.Value(0)).current;
  const barOp     = useRef(new Animated.Value(0)).current;
  const glowOp    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Glow fade-in
    Animated.timing(glowOp, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    // Subtle glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    // Logo spring entrance
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.timing(logoOp,    { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    // Text fade
    Animated.timing(textOp, { toValue: 1, duration: 500, delay: 350, useNativeDriver: true }).start();

    // Progress bar
    Animated.sequence([
      Animated.timing(barOp,    { toValue: 1, duration: 200, delay: 500, useNativeDriver: true }),
      Animated.timing(barWidth, { toValue: 1, duration: 1700, delay: 50, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, []);

  /* ── Route after animation ── */
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const [token, onboarded, langSet] = await Promise.all([
        Auth.getAccessToken().catch(() => null),
        AsyncStorage.getItem(ONBOARDED_KEY).catch(() => null),
        AsyncStorage.getItem(LOCALE_STORAGE_KEY).catch(() => null),
      ]);
      if (cancelled) return;
      if (!langSet)        navigation?.replace?.('LanguagePicker');
      else if (token)      navigation?.replace?.('Main');
      else if (!onboarded) navigation?.replace?.('Onboarding');
      else                 navigation?.replace?.('Login');
    }, 2600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [navigation]);

  const glowSize = width * 0.85;

  return (
    <View style={[s.root, { backgroundColor: BG }]}>

      {/* ── Radial glow ── */}
      <Animated.View
        style={[
          s.glowWrap,
          { width: glowSize, height: glowSize, borderRadius: glowSize / 2, opacity: glowOp, transform: [{ scale: pulse }] },
        ]}
        pointerEvents="none"
      >
        <View style={[s.glowRing, { width: glowSize,       height: glowSize,       borderRadius: glowSize / 2,       opacity: 0.06 }]} />
        <View style={[s.glowRing, { width: glowSize * 0.7, height: glowSize * 0.7, borderRadius: glowSize * 0.35, opacity: 0.1  }]} />
        <View style={[s.glowRing, { width: glowSize * 0.45,height: glowSize * 0.45,borderRadius: glowSize * 0.225,opacity: 0.16 }]} />
      </Animated.View>

      {/* ── Ghost bus watermark ── */}
      <Image
        source={Icons.bus}
        style={[s.busBg, { tintColor: colors.primary, width: width * 1.1, height: width * 1.1 }]}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      <SafeAreaView style={[s.center, contentStyle]}>

        {/* Logo badge */}
        <Animated.View style={{ opacity: logoOp, transform: [{ scale: logoScale }], marginBottom: spacing.xl }}>
          <View style={s.outerRing}>
            <View style={s.innerRing}>
              <Image source={Icons.logo} style={s.logoIcon} resizeMode="contain" />
            </View>
          </View>
        </Animated.View>

        {/* Brand text */}
        <Animated.View style={[s.textBlock, { opacity: textOp }]}>
          <Text style={[s.brand, isCompact && s.brandCompact]} numberOfLines={1}>EcoBus</Text>
          <View style={s.taglinePill}>
            <Text style={s.tagline}>{t('splash.tagline').toUpperCase()}</Text>
          </View>
          <Text style={s.subtitle}>{t('splash.subtitle')}</Text>
        </Animated.View>

        {/* Progress bar */}
        <Animated.View style={[s.barTrack, { opacity: barOp, width: width * 0.55 }]}>
          <Animated.View
            style={[s.barFill, { width: barWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
          />
        </Animated.View>

        <Animated.Text style={[s.loadingLabel, { opacity: barOp }]}>
          {t('common.loading')}
        </Animated.Text>
      </SafeAreaView>
    </View>
  );
}

const LOGO = 72;

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  /* Glow */
  glowWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  glowRing: { position: 'absolute', backgroundColor: colors.primary },

  /* Watermark */
  busBg: {
    position: 'absolute',
    bottom: -80,
    right: -80,
    opacity: 0.04,
    tintColor: colors.primary,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },

  /* Logo rings */
  outerRing: {
    width: LOGO + 56,
    height: LOGO + 56,
    borderRadius: (LOGO + 56) / 2,
    borderWidth: 1,
    borderColor: 'rgba(61,191,201,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61,191,201,0.04)',
  },
  innerRing: {
    width: LOGO + 28,
    height: LOGO + 28,
    borderRadius: (LOGO + 28) / 2,
    borderWidth: 1,
    borderColor: 'rgba(61,191,201,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61,191,201,0.07)',
  },
  logoBadge: {
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  logoIcon: {
    width: LOGO + 12,
    height: LOGO + 12,
  },

  /* Text */
  textBlock: { alignItems: 'center', marginBottom: spacing.xxl },
  brand: {
    ...typography.display,
    fontSize: 40,
    color: colors.textInverse,
    marginBottom: spacing.xs,
  },
  brandCompact: {
    fontSize: 34,
  },
  taglinePill: {
    backgroundColor: 'rgba(61,191,201,0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(61,191,201,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryAccent,
    letterSpacing: 2,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.onBrandMuted,
    textAlign: 'center',
    maxWidth: 240,
  },

  /* Progress */
  barTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.onBrandHigh,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  barFill: {
    height: '100%',
    borderRadius: 1,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  loadingLabel: {
    ...typography.overline,
    color: colors.onBrandText,
    opacity: 0.45,
    textTransform: 'uppercase',
  },
});
