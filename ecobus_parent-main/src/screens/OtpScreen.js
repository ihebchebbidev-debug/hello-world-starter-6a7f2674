import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { ONBOARDED_KEY } from './OnboardingScreen';
import { Auth, AuthAPI } from '../services/api';
// OTP-specific error mapping lives in humanizeOtp() below.
import { registerPushNotifications } from '../services/pushNotifications';
import { colors, spacing, typography, radius, shadows } from '../theme';
import { Icons } from '../assets/icons';
import { Button } from '../components';

const BG           = colors.secondary;
const CODE_LENGTH  = 6;
const RESEND_DELAY = 30;

const RING_BORDER  = 'rgba(61,191,201,0.25)';
const RING_BG      = 'rgba(61,191,201,0.06)';
const GLOW_BORDER  = 'rgba(34,155,166,0.15)';
const GLOW_BG      = 'rgba(34,155,166,0.04)';
const BADGE_BORDER = 'rgba(61,191,201,0.30)';
const BADGE_BG     = 'rgba(61,191,201,0.10)';

const LOGO = 64;

function maskPhone(phone) {
  const clean = (phone || '').replace(/\s/g, '');
  if (clean.length <= 4) return clean;
  return clean.slice(0, -4).replace(/\d/g, '•') + clean.slice(-4);
}

/**
 * Map OTP-specific backend errors to friendly localized messages and extract
 * the cooldown (seconds) from a 429 "Please wait Xs" response so the UI can
 * sync its countdown to the backend.
 */
function humanizeOtp(err, t) {
  const tr = (k, opts) => t(`otp.errors.${k}`, opts);
  if (!err) return { message: tr('generic'), retryAfter: 0 };
  if (err.network) return { message: tr('network'), retryAfter: 0 };
  const raw = String(err.message || '').toLowerCase();
  const status = err.status;

  if (status === 429) {
    const m = raw.match(/(\d+)\s*s/);
    const retryAfter = m ? Math.max(1, parseInt(m[1], 10)) : 30;
    if (raw.includes('too many'))
      return { message: tr('tooMany'), retryAfter: 0, reset: true };
    return { message: tr('retryAfter', { seconds: retryAfter }), retryAfter };
  }
  if (raw.includes('expired'))      return { message: tr('expired'), retryAfter: 0, reset: true };
  if (raw.includes('invalid code')) return { message: tr('invalidCode'), retryAfter: 0 };
  if (raw.includes('no code'))      return { message: tr('noCode'), retryAfter: 0, reset: true };
  if (raw.includes('invalid phone'))return { message: tr('invalidPhone'), retryAfter: 0 };
  if (raw.includes('sms'))          return { message: tr('smsFailed'), retryAfter: 0 };
  if (status === 401 || status === 404)
    return { message: tr('unknownPhone'), retryAfter: 0 };
  if (status >= 500)
    return { message: tr('server'), retryAfter: 0 };
  return { message: err.message || tr('generic'), retryAfter: 0 };
}

export default function OtpScreen({ navigation, route }) {
  const { t } = useTranslation();
  const phone  = route?.params?.phone ?? '';
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Dynamically compute box size so 6 boxes always fit inside the card
  const BOX_GAP = spacing.sm;
  const CARD_H_PAD = spacing.lg;
  const BOX_W = Math.floor((width - 2 * CARD_H_PAD - 5 * BOX_GAP) / 6);
  const BOX_H = Math.min(60, BOX_W + 12);

  const [digits, setDigits]       = useState(Array(CODE_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resend, setResend]       = useState(RESEND_DELAY);
  const [shake, setShake]         = useState(false);
  const [errorMsg, setErrorMsg]   = useState('');
  const [devCode, setDevCode]     = useState(null);   // dev/stub code from backend
  const [showDevModal, setShowDevModal] = useState(false);
  const inputRefs = useRef(Array(CODE_LENGTH).fill(null));
  const tickRef   = useRef(null);

  // Centralized countdown — any code path that needs to (re)start the
  // resend cooldown calls startCooldown(seconds). The single interval below
  // ticks it down to 0.
  const startCooldown = (seconds) => {
    setResend(Math.max(0, Math.floor(seconds)));
  };
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setResend((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  // On mount, request an OTP for this phone. While SMS isn't wired the backend
  // returns the code in `devCode`; we surface it in a modal so the user can
  // copy/auto-fill it. Once SMS is integrated the modal simply doesn't open.
  // `silent` skips the cooldown error toast on the initial mount call —
  // a 429 here just means the previous screen already requested a code.
  const requestCode = async ({ silent = false } = {}) => {
    if (!phone) return false;
    try {
      const r = await AuthAPI.requestPhoneOtp(phone);
      if (r?.devMode && r?.devCode) {
        setDevCode(String(r.devCode));
        setShowDevModal(true);
      } else {
        setDevCode(null);
        setShowDevModal(false);
      }
      startCooldown(RESEND_DELAY);
      setErrorMsg('');
      return true;
    } catch (err) {
      const { message, retryAfter } = humanizeOtp(err, t);
      if (retryAfter > 0) startCooldown(retryAfter);
      if (!silent) setErrorMsg(message);
      return false;
    }
  };
  useEffect(() => { requestCode({ silent: true }); /* eslint-disable-next-line */ }, [phone]);

  const handleDigit = (value, index) => {
    // Only take last character (handles paste: take first CODE_LENGTH chars)
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
      const next = [...digits];
      for (let i = 0; i < CODE_LENGTH; i++) {
        next[i] = pasted[i] ?? '';
      }
      setDigits(next);
      const lastFilled = Math.min(pasted.length, CODE_LENGTH - 1);
      inputRefs.current[lastFilled]?.focus();
      return;
    }
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const filled = digits.every((d) => d !== '');

  const autofillFromDev = () => {
    if (!devCode) return;
    const next = String(devCode).slice(0, CODE_LENGTH).split('');
    setDigits(Array.from({ length: CODE_LENGTH }, (_, i) => next[i] ?? ''));
    setShowDevModal(false);
    Keyboard.dismiss();
    inputRefs.current[CODE_LENGTH - 1]?.focus();
  };

  const verify = async () => {
    if (!filled || verifying) return;
    Keyboard.dismiss();
    setErrorMsg('');
    setVerifying(true);
    try {
      const code = digits.join('');

      // If we already have a session (e.g. user came from email/password login
      // and is just confirming phone ownership), just verify the code.
      // Otherwise, exchange the code for a real session via phone-OTP login.
      const existingToken = await Auth.getAccessToken();
      if (existingToken) {
        await AuthAPI.verifyPhoneOtp(phone, code);
      } else {
        await AuthAPI.loginWithPhone(phone, code);
      }

      await AsyncStorage.setItem(ONBOARDED_KEY, '1');
      registerPushNotifications().catch(() => {});
      navigation?.replace?.('Main');
    } catch (err) {
      setVerifying(false);
      setShake(true); setTimeout(() => setShake(false), 400);
      const { message, reset } = humanizeOtp(err, t);
      setErrorMsg(message);
      if (reset) {
        // Code expired / too many attempts / no code on server — clear inputs
        // and let the user request a new one immediately.
        setDigits(Array(CODE_LENGTH).fill(''));
        startCooldown(0);
        inputRefs.current[0]?.focus();
      }
    }
  };

  const handleResend = async () => {
    if (resend > 0) return;
    setDigits(Array(CODE_LENGTH).fill(''));
    setErrorMsg('');
    inputRefs.current[0]?.focus();
    // Optimistically lock the button; requestCode() will sync the real
    // cooldown (success → RESEND_DELAY; 429 → server-reported retryAfter).
    startCooldown(RESEND_DELAY);
    await requestCode();
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
            <Text style={s.badgeText}>{t('otp.verification')}</Text>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[s.card, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md }]}>
            <View style={s.handle} />

            {/* Back link */}
            <Pressable
              onPress={() => navigation?.goBack?.()}
              style={({ pressed }) => [s.backRow, pressed && { opacity: 0.6 }]}
              hitSlop={12}
            >
              <Text style={s.backText}>{t('otp.changeNumber')}</Text>
            </Pressable>

            <Text style={s.cardTitle}>{t('otp.title')}</Text>
            <Text style={s.cardSub}>
              {t('otp.subtitle')}{'\n'}
              <Text style={s.phoneHighlight}>{maskPhone(phone)}</Text>
            </Text>

            <View style={s.divider} />

            {/* Digit boxes — dynamically sized to always fit the screen */}
            <View style={s.boxRow}>
              {digits.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { inputRefs.current[i] = ref; }}
                  style={[
                    s.box,
                    { width: BOX_W, height: BOX_H, fontSize: Math.min(24, BOX_W * 0.5), borderRadius: Math.min(14, BOX_W * 0.3) },
                    digit ? s.boxFilled : null,
                    i === digits.findIndex((d) => d === '') ? s.boxActive : null,
                  ]}
                  value={digit}
                  onChangeText={(v) => handleDigit(v, i)}
                  onKeyPress={(e) => handleKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={CODE_LENGTH}
                  selectTextOnFocus
                  autoFocus={i === 0}
                  caretHidden
                  textAlign="center"
                  allowFontScaling={false}
                  accessibilityLabel={`Digit ${i + 1}`}
                />
              ))}
            </View>

            {!!errorMsg && <Text style={s.errorText}>{errorMsg}</Text>}

            <View style={s.spacer} />

            <Button
              title={verifying ? t('otp.verifying') : t('otp.verify')}
              onPress={verify}
              loading={verifying}
              disabled={!filled || verifying}
            />

            <View style={s.spacer} />

            {/* Resend */}
            <View style={s.resendRow}>
              <Text style={s.resendLabel}>{t('otp.resendPrompt')} </Text>
              <Pressable
                onPress={handleResend}
                disabled={resend > 0}
                hitSlop={8}
              >
                <Text style={[s.resendBtn, resend > 0 && s.resendDisabled]}>
                  {resend > 0 ? t('otp.resendIn', { seconds: resend }) : t('otp.resend')}
                </Text>
              </Pressable>
            </View>

            {!!devCode && (
              <Pressable onPress={() => setShowDevModal(true)} hitSlop={8}>
                <Text style={s.demoHint}>
                  {t('otp.demoHint')}
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dev/stub OTP modal — shows the generated code so users can copy/paste
          it until the SMS provider is integrated. */}
      <Modal
        visible={showDevModal && !!devCode}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDevModal(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setShowDevModal(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalBadge}>{t('otp.devBadge')}</Text>
            <Text style={s.modalTitle}>{t('otp.devTitle')}</Text>
            <Text style={s.modalSub}>
              {t('otp.devSub')}
            </Text>
            <Text style={s.modalCode} selectable>{devCode}</Text>
            <View style={s.modalActions}>
              <Pressable style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setShowDevModal(false)}>
                <Text style={s.modalBtnGhostText}>{t('otp.close')}</Text>
              </Pressable>
              <Pressable style={[s.modalBtn, s.modalBtnPrimary]} onPress={autofillFromDev}>
                <Text style={s.modalBtnPrimaryText}>{t('otp.devAutofill')}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  backRow: { marginBottom: spacing.sm },
  backText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  cardTitle: { ...typography.title, fontSize: 26, color: colors.textPrimary, marginBottom: 4 },
  cardSub: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  phoneHighlight: { color: colors.textPrimary, fontWeight: '700' },

  divider: { height: 1, backgroundColor: colors.surfaceAlt, marginVertical: spacing.lg },

  /* OTP boxes */
  boxRow: {
    flexDirection: 'row', gap: spacing.sm,
    justifyContent: 'center', marginBottom: spacing.md,
  },
  box: {
    width: 46, height: 56,
    borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    fontSize: 24, fontWeight: '700', color: colors.textPrimary,
    textAlign: 'center',
  },
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  boxActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },

  spacer: { height: spacing.sm },

  resendRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: spacing.md,
  },
  resendLabel: { fontSize: 13, color: colors.textMuted },
  resendBtn: { fontSize: 13, fontWeight: '700', color: colors.primary },
  resendDisabled: { color: colors.textDisabled },

  demoHint: {
    textAlign: 'center', fontSize: 11,
    color: colors.primary, marginTop: spacing.md,
    fontStyle: 'italic', textDecorationLine: 'underline',
  },

  errorText: {
    color: colors.danger || '#D14343',
    fontSize: 13, fontWeight: '600',
    textAlign: 'center', marginTop: spacing.sm,
  },

  /* Dev/stub OTP modal */
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 380,
    backgroundColor: colors.surface, borderRadius: 24,
    padding: spacing.lg, ...shadows.modal,
  },
  modalBadge: {
    alignSelf: 'flex-start',
    fontSize: 10, fontWeight: '800', letterSpacing: 2,
    color: colors.primary,
    backgroundColor: 'rgba(61,191,201,0.12)',
    borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  modalTitle: { ...typography.title, fontSize: 20, color: colors.textPrimary },
  modalSub:   { ...typography.body, fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  modalCode: {
    textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.md,
    fontSize: 36, letterSpacing: 8, fontWeight: '800',
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt, borderRadius: 14,
    paddingVertical: spacing.md,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  modalBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBtnGhost:   { backgroundColor: colors.surfaceAlt },
  modalBtnPrimary: { backgroundColor: colors.primary },
  modalBtnGhostText:   { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  modalBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: colors.textInverse },
});
