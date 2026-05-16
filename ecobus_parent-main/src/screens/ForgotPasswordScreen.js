import React, { useEffect, useRef, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Input, Button, useToast, Icon } from '../components';
import { AuthAPI } from '../services/api';
import { colors, spacing, typography, radius, shadows } from '../theme';
import { useContentStyle } from '../theme/responsive';
import { Icons } from '../assets/icons';

// Default cooldown if the server doesn't send Retry-After (seconds).
const DEFAULT_COOLDOWN = 60;
const BG = colors.secondary;

// Decorative teal overlays on dark navy
const GLOW_BORDER  = 'rgba(34,155,166,0.15)';
const GLOW_BG      = 'rgba(34,155,166,0.04)';
const RING_BORDER  = 'rgba(61,191,201,0.25)';
const RING_BG      = 'rgba(61,191,201,0.06)';
const BADGE_BORDER = 'rgba(61,191,201,0.30)';
const BADGE_BG     = 'rgba(61,191,201,0.10)';

function formatCooldown(seconds) {
  if (seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `${s}s`;
}

export default function ForgotPasswordScreen({ navigation }) {
  const { t } = useTranslation();
  const contentStyle = useContentStyle();
  const insets = useSafeAreaInsets();
  const [email, setEmail]           = useState('');
  const [error, setError]           = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent]             = useState(false);
  const [cooldown, setCooldown]     = useState(0);
  const tickRef = useRef(null);
  const toast = useToast();

  // Tick down the cooldown each second.
  useEffect(() => {
    if (cooldown <= 0) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    if (tickRef.current) return;
    tickRef.current = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    };
  }, [cooldown]);

  const startCooldown = (seconds) => {
    const safe = Math.min(Math.max(Math.floor(seconds || DEFAULT_COOLDOWN), 1), 15 * 60);
    setCooldown(safe);
  };

  const submit = async () => {
    if (cooldown > 0 || submitting) return;
    if (!email.includes('@')) {
      setError(t('forgot.invalidEmail'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await AuthAPI.forgot(email);
      setSent(true);
      startCooldown(DEFAULT_COOLDOWN);
      toast.show(t('forgot.sentToast'), { tone: 'success' });
    } catch (e) {
      if (e?.status === 429) {
        const wait = e?.retryAfter ?? DEFAULT_COOLDOWN;
        startCooldown(wait);
        setSent(true); // keep the success card visible for security
        toast.show(t('forgot.rateLimited', { time: formatCooldown(wait) }), { tone: 'warning' });
      } else if (e?.status >= 500) {
        toast.show(t('forgot.serverError'), { tone: 'danger' });
      } else if (!e?.status) {
        toast.show(t('forgot.noNetwork'), { tone: 'danger' });
      } else {
        // For security, still show success on 4xx (e.g. unknown email).
        setSent(true);
        startCooldown(DEFAULT_COOLDOWN);
        toast.show(t('forgot.ifExists'), { tone: 'info' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const cooldownLabel = cooldown > 0 ? formatCooldown(cooldown) : null;
  const resendDisabled = cooldown > 0 || submitting;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} translucent={false} />

      <View style={styles.glowTR} pointerEvents="none" />
      <View style={styles.glowTRMid} pointerEvents="none" />
      <View style={styles.arcBL} pointerEvents="none" />
      <Image
        source={Icons.bus}
        style={styles.busBg}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      <SafeAreaView edges={['top']} style={styles.header} pointerEvents="none">
        <View style={styles.logoOuter}>
          <View style={styles.logoInner}>
            <Image source={Icons.bus} style={styles.logoIcon} resizeMode="contain" />
          </View>
        </View>

        <Text style={styles.brand}>EcoBus</Text>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('splash.tagline').toUpperCase()}</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, contentStyle && { alignItems: 'center' }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Pressable onPress={Keyboard.dismiss} accessible={false} style={contentStyle}>
            <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}>
              <View style={styles.handle} />
              <Text style={styles.cardTitle}>{t('forgot.title')}</Text>
              <Text style={styles.cardSub}>{t('forgot.subtitle')}</Text>
              <View style={styles.divider} />

              {sent ? (
                <View style={styles.successCard}>
                  <Icon name="check" size={32} tint={colors.success ?? colors.primary} />
                  <Text style={styles.successTitle}>{t('forgot.checkInbox')}</Text>
                  <Text style={styles.successBody}>{t('forgot.successBody', { email })}</Text>

                  {cooldownLabel ? (
                    <View style={styles.cooldownRow}>
                      <Icon name="clock" size={14} tint={colors.textSecondary} />
                      <Text style={styles.cooldownText}>
                        {t('forgot.cooldown', { time: cooldownLabel })}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.spacer} />
                  <Button title={t('forgot.backToLogin')} onPress={() => navigation?.replace?.('Login')} />
                  <View style={styles.spacer} />
                  <Button
                    title={resendDisabled && cooldownLabel ? t('forgot.resendIn', { time: cooldownLabel }) : t('forgot.resend')}
                    variant="ghost"
                    loading={submitting}
                    disabled={resendDisabled}
                    onPress={submit}
                  />
                </View>
              ) : (
                <View style={styles.form}>
                  <Input
                    label={t('forgot.emailLabel')}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    placeholder={t('forgot.emailPlaceholder')}
                    error={error}
                    editable={!submitting}
                  />
                  <Button
                    title={cooldownLabel ? t('forgot.tryAgainIn', { time: cooldownLabel }) : t('forgot.send')}
                    onPress={submit}
                    loading={submitting}
                    disabled={resendDisabled}
                  />
                  <View style={styles.spacer} />
                  <Button
                    title={t('forgot.backToLogin')}
                    variant="ghost"
                    onPress={() => navigation?.goBack?.()}
                  />
                </View>
              )}
            </View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  glowTR: {
    position: 'absolute',
    top: -160,
    right: -160,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: colors.primary,
    opacity: 0.1,
  },
  glowTRMid: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.primary,
    opacity: 0.1,
  },
  arcBL: {
    position: 'absolute',
    bottom: 280,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: GLOW_BORDER,
    backgroundColor: GLOW_BG,
  },
  busBg: {
    position: 'absolute',
    width: 320,
    height: 320,
    bottom: 200,
    right: -50,
    opacity: 0.05,
    tintColor: colors.primary,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  logoOuter: {
    width: 64 + 28,
    height: 64 + 28,
    borderRadius: (64 + 28) / 2,
    borderWidth: 1,
    borderColor: RING_BORDER,
    backgroundColor: RING_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  logoIcon: {
    width: 64 * 0.56,
    height: 64 * 0.56,
    tintColor: colors.textInverse,
  },
  brand: {
    ...typography.display,
    fontSize: 34,
    color: colors.textInverse,
    marginBottom: spacing.xs,
  },
  badgeRow: { alignItems: 'center' },
  badge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: BADGE_BORDER,
    backgroundColor: BADGE_BG,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    ...typography.overline,
    color: colors.primaryAccent,
  },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...shadows.modal,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  cardTitle: {
    ...typography.title,
    fontSize: 26,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardSub: {
    ...typography.body, color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surfaceAlt,
    marginVertical: spacing.lg,
  },
  form: { gap: 0 },
  spacer:    { height: spacing.xs },
  successCard: {
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    alignItems: 'center',
  },
  successTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  successBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  cooldownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  cooldownText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginStart: spacing.xxs,
  },
});
