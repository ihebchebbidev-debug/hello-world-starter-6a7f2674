import React, { useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Input, Button } from '../components';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useContentStyle } from '../theme/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius, shadows } from '../theme';
import { Icons } from '../assets/icons';
import { AuthAPI } from '../services/api';
import { registerPushNotifications } from '../services/pushNotifications';

const BG = colors.secondary;

const GLOW_BORDER  = 'rgba(34,155,166,0.15)';
const GLOW_BG      = 'rgba(34,155,166,0.04)';
const RING_BORDER  = 'rgba(61,191,201,0.25)';
const RING_BG      = 'rgba(61,191,201,0.06)';
const BADGE_BORDER = 'rgba(61,191,201,0.30)';
const BADGE_BG     = 'rgba(61,191,201,0.10)';

const LOGO = 64;

export default function LoginScreen({ navigation }) {
  const { t } = useTranslation();
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState(null);
  const [sending, setSending]     = useState(false);
  const contentStyle = useContentStyle();
  const insets = useSafeAreaInsets();

  const submit = async () => {
    Keyboard.dismiss();
    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await AuthAPI.login(email.trim().toLowerCase(), password);
      // Register for push as soon as we have a session — fire-and-forget.
      registerPushNotifications().catch(() => {});
      setSending(false);
      navigation?.replace?.('Main');
    } catch (e) {
      setSending(false);
      setError(e?.message || 'Login failed');
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} translucent={false} />

      <View style={s.glowTR} pointerEvents="none" />
      <View style={s.glowTRMid} pointerEvents="none" />
      <View style={s.arcBL} pointerEvents="none" />
      <Image
        source={Icons.bus}
        style={s.busBg}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      <SafeAreaView edges={['top']} style={s.header} pointerEvents="none">
        <View style={s.logoOuter}>
          <View style={s.logoInner}>
            <Image source={Icons.bus} style={s.logoIcon} resizeMode="contain" />
          </View>
        </View>
        <Text style={s.brand}>EcoBus</Text>
        <View style={s.badgeRow}>
          <View style={s.badge}>
            <Text style={s.badgeText}>{t('splash.tagline').toUpperCase()}</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[s.scroll, contentStyle && { alignItems: 'center' }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Pressable onPress={Keyboard.dismiss} accessible={false} style={contentStyle}>
            <View style={[s.card, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}>
              <View style={s.handle} />

              <LanguageSwitcher variant="light" style={s.langSwitcher} />

              <Text style={s.cardTitle}>{t('login.welcome')}</Text>
              <Text style={s.cardSub}>{t('login.subtitle')}</Text>

              <View style={s.divider} />

              <View style={s.form}>
                <Input
                  label="Email"
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(null); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  placeholder="parent@example.com"
                  returnKeyType="next"
                  maxLength={120}
                />
                <Input
                  label="Password"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(null); }}
                  secureTextEntry
                  placeholder="••••••••"
                  error={error}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  maxLength={120}
                />

                <Button
                  title={sending ? 'Signing in…' : 'Sign in'}
                  onPress={submit}
                  loading={sending}
                  disabled={sending}
                />

                <View style={s.dividerRow}>
                  <View style={s.dividerLine} />
                  <Text style={s.dividerLabel}>{t('common.or')}</Text>
                  <View style={s.dividerLine} />
                </View>

                <Pressable
                  onPress={() => navigation?.replace?.('Main')}
                  style={({ pressed }) => [s.demoBtn, pressed && { opacity: 0.75 }]}
                  accessibilityRole="button"
                >
                  <Text style={s.demoBtnText}>{t('login.demoAccess')}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  glowTR: {
    position: 'absolute', top: -160, right: -160,
    width: 380, height: 380, borderRadius: 190,
    backgroundColor: colors.primary, opacity: 0.1,
  },
  glowTRMid: {
    position: 'absolute', top: -100, right: -100,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: colors.primary, opacity: 0.1,
  },
  arcBL: {
    position: 'absolute', bottom: 280, left: -120,
    width: 260, height: 260, borderRadius: 130,
    borderWidth: 1, borderColor: GLOW_BORDER, backgroundColor: GLOW_BG,
  },
  busBg: {
    position: 'absolute', width: 320, height: 320,
    bottom: 200, right: -50, opacity: 0.05, tintColor: colors.primary,
  },

  header: { alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.lg },
  logoOuter: {
    width: LOGO + 28, height: LOGO + 28, borderRadius: (LOGO + 28) / 2,
    borderWidth: 1, borderColor: RING_BORDER, backgroundColor: RING_BG,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  logoInner: {
    width: LOGO, height: LOGO, borderRadius: LOGO / 2,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 }, elevation: 10,
  },
  logoIcon: { width: LOGO * 0.56, height: LOGO * 0.56, tintColor: colors.textInverse },
  brand: { ...typography.display, fontSize: 34, color: colors.textInverse, marginBottom: spacing.xs },
  badgeRow: { alignItems: 'center' },
  badge: {
    borderRadius: radius.pill, borderWidth: 1,
    borderColor: BADGE_BORDER, backgroundColor: BADGE_BG,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: colors.primaryAccent },

  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    paddingTop: spacing.sm, paddingHorizontal: spacing.lg,
    ...shadows.modal,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, marginBottom: spacing.lg, marginTop: spacing.xs,
  },
  langSwitcher: { alignSelf: 'center', marginBottom: spacing.lg, borderColor: colors.border },
  cardTitle: { ...typography.title, fontSize: 26, color: colors.textPrimary, marginBottom: 4 },
  cardSub: { ...typography.body, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.surfaceAlt, marginVertical: spacing.lg },
  form: { gap: spacing.sm },
  hint: {
    fontSize: 12, color: colors.textMuted, textAlign: 'center',
    marginTop: -spacing.xs, marginBottom: spacing.xs,
  },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerLabel: { ...typography.caption, color: colors.textSecondary },
  demoBtn: {
    alignItems: 'center', paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(34,155,166,0.30)', backgroundColor: 'rgba(34,155,166,0.06)',
  },
  demoBtnText: { ...typography.buttonSm, color: colors.primary },
});
