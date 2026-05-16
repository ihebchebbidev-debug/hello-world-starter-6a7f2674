import React, { useRef, useState } from 'react';
import {
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Input, Button } from '../components';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useContentStyle } from '../theme/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, radius, shadows } from '../theme';
import { AuthAPI } from '../services/api';
import { registerPushNotifications } from '../services/pushNotifications';

const BG = colors.secondary;
const RING_BORDER  = 'rgba(61,191,201,0.25)';
const RING_BG      = 'rgba(61,191,201,0.06)';
const BADGE_BORDER = 'rgba(61,191,201,0.30)';
const BADGE_BG     = 'rgba(61,191,201,0.10)';
const LOGO = 64;

export default function LoginScreen({ navigation }) {
  const { t } = useTranslation();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const passwordRef = useRef(null);
  const contentStyle = useContentStyle();
  const insets = useSafeAreaInsets();

  const validate = () => {
    const e = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) e.email = t('login.errors.invalidEmail');
    if (password.length < 6) e.password = t('login.errors.invalidPassword');
    return e;
  };

  const login = async () => {
    Keyboard.dismiss();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setLoading(true);
    try {
      await AuthAPI.login(email.trim().toLowerCase(), password);
      // Fire-and-forget — never block login on push setup.
      registerPushNotifications().catch(() => {});
      navigation?.replace?.('Main');
    } catch {
      setErrors({ password: t('login.errors.invalidCredentials') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} translucent={false} />

      {/* Background glows */}
      <View style={s.glowTR} pointerEvents="none" />
      <View style={s.glowTRMid} pointerEvents="none" />
      <View style={s.arcBL} pointerEvents="none" />
      <View style={s.busBg} pointerEvents="none">
        <MaterialCommunityIcons name="bus" size={280} color={colors.primary} style={{ opacity: 0.05 }} />
      </View>

      {/* Hero header */}
      <SafeAreaView edges={['top']} style={s.header} pointerEvents="none">
        <View style={s.logoOuter}>
          <View style={s.logoInner}>
            <MaterialCommunityIcons name="bus" size={LOGO * 0.56} color={colors.textInverse} />
          </View>
        </View>
        <Text style={s.brand}>EcoBus</Text>
        <View style={s.badgeRow}>
          <View style={s.badge}>
            <Text style={s.badgeText}>{t('splash.tagline').toUpperCase()}</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Login card */}
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
                  label={t('login.emailLabel')}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: null })); }}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  placeholder="driver@ecobus.app"
                  error={errors.email}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />

                <Input
                  ref={passwordRef}
                  label={t('login.passwordLabel')}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: null })); }}
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                  placeholder="••••••••"
                  error={errors.password}
                  returnKeyType="go"
                  onSubmitEditing={login}
                />

                <Button
                  title={t('login.loginBtn')}
                  onPress={login}
                  loading={loading}
                  disabled={loading}
                />

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
    borderWidth: 1, borderColor: 'rgba(34,155,166,0.15)',
    backgroundColor: 'rgba(34,155,166,0.04)',
  },
  busBg: {
    position: 'absolute', bottom: 200, right: -50,
    overflow: 'hidden',
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerLabel: { ...typography.caption, color: colors.textSecondary },
  demoBtn: {
    alignItems: 'center', paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(34,155,166,0.30)', backgroundColor: 'rgba(34,155,166,0.06)',
  },
  demoBtnText: { ...typography.buttonSm, color: colors.primary },
});
