import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen, Avatar, Card, Loader } from '../components';
import { colors, spacing, typography, radius } from '../theme';
import { MeAPI, AuthAPI } from '../services/api';
import { changeLanguage } from '../i18n';

const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

export default function ProfileScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let alive = true;
    MeAPI.profile()
      .then((p) => { if (alive) setProfile(p); })
      .finally(() => { if (alive) setLoadingProfile(false); });
    return () => { alive = false; };
  }, []);

  const currentLang = i18n.language?.slice(0, 2) ?? 'fr';

  const handleLogout = useCallback(() => {
    Alert.alert(
      t('profile.logoutConfirm'),
      t('profile.logoutConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.logout'),
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await AuthAPI.logout();
              navigation?.replace?.('Login');
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  }, [t, navigation]);

  if (loadingProfile) return <Screen><Loader /></Screen>;

  const driver = profile?.driver || {};
  const bus    = profile?.bus    || {};

  return (
    <Screen padded={false} edges={['top']} scroll={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <Avatar name={driver.name || '—'} size={72} />
          <Text style={s.heroName}>{driver.name || '—'}</Text>
          <View style={s.heroBadge}>
            <MaterialCommunityIcons name="steering" size={14} color={colors.primaryAccent} />
            <Text style={s.heroBadgeText}>{t('profile.driver').toUpperCase()}</Text>
          </View>
          <Text style={s.heroEmail}>{driver.email || ''}</Text>
        </View>

        <View style={s.content}>
          {/* Bus info */}
          <Card style={s.card}>
            <Text style={s.sectionTitle}>{t('profile.bus')}</Text>
            <ProfileRow icon="bus" label={t('profile.busNumber')} value={`Bus ${bus.busNumber || '—'}`} />
            <ProfileRow icon="card-text-outline" label={t('profile.plate')} value={bus.plate || '—'} />
            <ProfileRow icon="account-group" label={t('profile.capacity')} value={`${bus.capacity || 0} ${t('profile.seats')}`} />
            <ProfileRow icon="car-info" label={t('profile.model')} value={bus.model || '—'} />
          </Card>

          {/* Driver info */}
          <Card style={s.card}>
            <Text style={s.sectionTitle}>{t('profile.driver')}</Text>
            <ProfileRow icon="phone" label={t('profile.phone')} value={driver.phone || '—'} />
            <ProfileRow icon="card-account-details-outline" label={t('profile.license')} value={driver.licenseNumber || '—'} />
          </Card>

          {/* Language */}
          <Card style={s.card}>
            <Text style={s.sectionTitle}>{t('profile.language')}</Text>
            <View style={s.langRow}>
              {LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => changeLanguage(lang.code)}
                  style={[s.langBtn, currentLang === lang.code && s.langBtnActive]}
                >
                  <Text style={[s.langBtnText, currentLang === lang.code && s.langBtnTextActive]}>
                    {lang.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>

          {/* Logout */}
          <Pressable
            onPress={handleLogout}
            disabled={loggingOut}
            style={({ pressed }) => [s.logoutBtn, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
            <Text style={s.logoutText}>{t('common.logout')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function ProfileRow({ icon, label, value }) {
  return (
    <View style={s.row}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.textMuted} style={s.rowIcon} />
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.secondary,
  },
  heroName: { ...typography.title, color: colors.textInverse, marginTop: spacing.md, marginBottom: spacing.xs },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(61,191,201,0.15)', borderRadius: radius.pill,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(61,191,201,0.25)', marginBottom: spacing.xs,
  },
  heroBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primaryAccent, letterSpacing: 1.5 },
  heroEmail: { ...typography.bodySm, color: colors.onBrandMuted },

  content: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },

  sectionTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: colors.textMuted,
    textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  card: { marginBottom: 0 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowIcon: { marginEnd: spacing.sm },
  rowLabel: { ...typography.bodySm, color: colors.textSecondary, flex: 1 },
  rowValue: { ...typography.bodySmMd, color: colors.textPrimary, maxWidth: '55%', textAlign: 'right' },

  langRow: { flexDirection: 'row', gap: spacing.xs },
  langBtn: {
    flex: 1, paddingVertical: spacing.xs, borderRadius: radius.md,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langBtnText: { ...typography.bodySmMd, color: colors.textSecondary },
  langBtnTextActive: { color: '#fff' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.dangerLight,
    backgroundColor: colors.dangerLight,
  },
  logoutText: { ...typography.button, color: colors.danger },
});
