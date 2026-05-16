import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Image, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { changeLanguage } from '../i18n';
import { Auth } from '../services/api';
import { ONBOARDED_KEY } from './OnboardingScreen';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { useContentStyle } from '../theme/responsive';
import { Icons } from '../assets/icons';

const BG = colors.secondary;

/* ── Language data (native labels — never translated so always readable) ─── */
const LANGUAGES = [
  {
    code: 'fr',
    flag: '🇫🇷',
    nativeName: 'Français',
    hint: 'French',
    accent: '#3BBFCC',
  },
  {
    code: 'en',
    flag: '🇬🇧',
    nativeName: 'English',
    hint: 'Anglais',
    accent: colors.primary,
  },
  {
    code: 'ar',
    flag: '🇸🇦',
    nativeName: 'العربية',
    hint: 'Arabic · عربي',
    accent: '#4ADE80',
    rtl: true,
  },
];

/* Label for the continue button shown in the selected language */
const CONTINUE_LABELS = { fr: 'Continuer', en: 'Continue', ar: 'متابعة →' };

/* ─────────────────────────────────────────────────────────────── */

export default function LanguagePickerScreen({ navigation }) {
  const [selected, setSelected] = useState('fr');
  const [saving, setSaving]     = useState(false);
  const contentStyle = useContentStyle();

  /* Entry animations */
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(32)).current;
  /* Per-card press scale */
  const cardScales  = useRef(LANGUAGES.map(() => new Animated.Value(1))).current;
  /* Pulsing glow behind selected card */
  const glowPulse   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1.15, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 1,    duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [fadeAnim, slideAnim, glowPulse]);

  const selectLang = (code, idx) => {
    if (code === selected) return;
    setSelected(code);
    Animated.sequence([
      Animated.timing(cardScales[idx], { toValue: 0.96, duration: 70,  useNativeDriver: true }),
      Animated.spring(cardScales[idx],  { toValue: 1,    friction: 6, tension: 200, useNativeDriver: true }),
    ]).start();
  };

  const onContinue = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await changeLanguage(selected);
      const [token, onboarded] = await Promise.all([
        Auth.getAccessToken().catch(() => null),
        AsyncStorage.getItem(ONBOARDED_KEY).catch(() => null),
      ]);
      if (token)         navigation.replace('Main');
      else if (!onboarded) navigation.replace('Onboarding');
      else                 navigation.replace('Login');
    } catch {
      navigation.replace('Onboarding');
    } finally {
      setSaving(false);
    }
  };

  const activeLang = LANGUAGES.find((l) => l.code === selected) ?? LANGUAGES[0];

  return (
    <View style={s.root}>
      {/* Radial glows */}
      <View style={s.glowTR} pointerEvents="none" />
      <View style={s.glowBL} pointerEvents="none" />

      {/* Ghost bus watermark */}
      <Image
        source={Icons.bus}
        style={s.watermark}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      <SafeAreaView style={s.safe}>
        <Animated.View style={[s.inner, contentStyle, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* ── Logo + heading ── */}
          <View style={s.topBlock}>
            <View style={s.logoBadge}>
              <Image source={Icons.bus} style={s.logoIcon} resizeMode="contain" />
            </View>
            <Text style={s.appName}>EcoBus</Text>
            <Text style={s.mainHeading}>{'Choose your language\nChoisissez votre langue\nاختر لغتك'}</Text>
          </View>

          {/* ── Language cards ── */}
          <View style={s.cards}>
            {LANGUAGES.map((lang, idx) => {
              const active = selected === lang.code;
              return (
                <Animated.View key={lang.code} style={{ transform: [{ scale: cardScales[idx] }] }}>
                  <Pressable
                    onPress={() => selectLang(lang.code, idx)}
                    style={[
                      s.card,
                      active && { borderColor: lang.accent, backgroundColor: lang.accent + '14' },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={lang.nativeName}
                  >
                    {/* Active glow bar */}
                    {active ? (
                      <View style={[s.activeBar, { backgroundColor: lang.accent }]} />
                    ) : null}

                    {/* Flag circle */}
                    <View style={[
                      s.flagCircle,
                      active
                        ? { backgroundColor: lang.accent + '22', borderColor: lang.accent + '55' }
                        : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' },
                    ]}>
                      <Text style={s.flagEmoji}>{lang.flag}</Text>
                    </View>

                    {/* Labels */}
                    <View style={[s.cardLabels, lang.rtl && { alignItems: 'flex-end' }]}>
                      <Text style={[s.nativeName, active && { color: '#fff' }, lang.rtl && s.rtlText]}>
                        {lang.nativeName}
                      </Text>
                      <Text style={s.hintText}>{lang.hint}</Text>
                    </View>

                    {/* Check circle */}
                    <View style={[
                      s.checkCircle,
                      active
                        ? { backgroundColor: lang.accent, borderColor: lang.accent }
                        : { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.2)' },
                    ]}>
                      {active ? <Text style={s.checkMark}>✓</Text> : null}
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          {/* ── Continue button ── */}
          <Pressable
            onPress={onContinue}
            disabled={saving}
            style={({ pressed }) => [
              s.cta,
              { backgroundColor: activeLang.accent },
              pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              saving && { opacity: 0.6 },
            ]}
            accessibilityRole="button"
          >
            <Text style={s.ctaText}>
              {saving ? '…' : CONTINUE_LABELS[selected] ?? 'Continue'}
            </Text>
            {!saving ? <Text style={s.ctaArrow}>{activeLang.rtl ? '←' : '→'}</Text> : null}
          </Pressable>

          <Text style={s.footer}>EcoBus · School Bus Tracking</Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */
const LOGO = 58;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, overflow: 'hidden' },

  /* Background decoration */
  glowTR: {
    position: 'absolute', top: -120, right: -120,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: colors.primary, opacity: 0.1,
  },
  glowBL: {
    position: 'absolute', bottom: -80, left: -80,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: colors.primary, opacity: 0.06,
  },
  watermark: {
    position: 'absolute', bottom: -40, right: -50,
    width: 300, height: 300,
    opacity: 0.04, tintColor: colors.primary,
  },

  safe:  { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    justifyContent: 'space-between',
  },

  /* Logo + heading */
  topBlock: { alignItems: 'center', paddingTop: spacing.lg },
  logoBadge: {
    width: LOGO, height: LOGO, borderRadius: LOGO / 2,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.55, shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
    marginBottom: spacing.sm,
  },
  logoIcon: {
    width: LOGO * 0.58, height: LOGO * 0.58,
    tintColor: colors.textInverse,
  },
  appName: {
    ...typography.display,
    fontSize: 30,
    color: colors.textInverse,
    marginBottom: spacing.md,
  },
  mainHeading: {
    ...typography.bodySm,
    color: colors.onBrandMuted,
    textAlign: 'center',
  },

  /* Cards */
  cards: { gap: spacing.sm, flex: 1, justifyContent: 'center', paddingVertical: spacing.md },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
    ...shadows.card,
  },

  activeBar: {
    position: 'absolute', start: 0, top: 0, bottom: 0,
    width: 4,
  },

  flagCircle: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginEnd: spacing.md,
  },
  flagEmoji: { fontSize: 28 },

  cardLabels: { flex: 1 },
  nativeName: {
    ...typography.subtitle,
    color: colors.onBrandText,
  },
  rtlText: { writingDirection: 'rtl' },
  hintText: { ...typography.caption, color: colors.onBrandMuted, marginTop: 3 },

  checkCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    marginStart: spacing.sm,
  },
  checkMark: { ...typography.bodySmMd, color: colors.textInverse },

  /* CTA */
  cta: {
    height: 58, borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 10,
    shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    marginTop: spacing.md,
  },
  ctaText: {
    ...typography.button,
    color: colors.textInverse,
  },
  ctaArrow: { ...typography.subtitleSm, color: colors.onBrandMuted, fontWeight: '700' },

  footer: {
    ...typography.overline,
    textAlign: 'center',
    color: colors.onBrandText,
    opacity: 0.3,
    marginTop: spacing.sm, paddingBottom: spacing.xs,
  },
});
