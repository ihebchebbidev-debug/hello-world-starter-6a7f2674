import React from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen, Avatar, Icon } from '../components';
import { Auth, AuthAPI } from '../services/api';
import useAsync from '../hooks/useAsync';
import { colors, radius, spacing, shadows } from '../theme';

const LANG_LABELS = { en: 'English', fr: 'Français', ar: 'العربية' };
const ICON_SIZE   = 22;
const WRAP_SIZE   = 42;

export default function ProfileScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const { data: user } = useAsync(() => AuthAPI.me().catch(() => null), []);

  const confirmLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: async () => {
          try { await AuthAPI.logout(); } catch { /* clear locally either way */ }
          await Auth.clear();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Track your child\'s school bus in real-time with EcoBus.',
        title: 'EcoBus – School Bus Tracker',
      });
    } catch { /* user dismissed */ }
  };

  return (
    <Screen scroll padded={false} background={colors.background} statusBarStyle="light-content">

      {/* ── Teal hero header ── */}
      <View style={s.hero}>
        <SafeAreaView edges={['top']} style={s.heroInner}>
          <View style={s.heroGlow} pointerEvents="none" />
          <View style={s.heroGlowBL} pointerEvents="none" />

          <View style={s.heroTopRow}>
            <Text style={s.heroScreenTitle}>{t('tabs.profile')}</Text>
            <Pressable
              style={({ pressed }) => [s.editBtn, pressed && { opacity: 0.75 }]}
              onPress={() => {/* edit profile — coming soon */}}
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
            >
              <MaterialCommunityIcons name="pencil-outline" size={18} color="#fff" allowFontScaling={false} />
            </Pressable>
          </View>

          <View style={s.heroContent}>
            <View style={s.avatarRing}>
              <Avatar uri={user?.photoUrl} name={user?.name ?? t('profile.parentFallback')} size={80} />
            </View>
            <Text style={s.heroName}>{user?.name ?? t('profile.parentFallback')}</Text>
            {user?.email ? <Text style={s.heroMeta}>{user.email}</Text> : null}
            {user?.phone ? <Text style={s.heroMeta}>{user.phone}</Text> : null}
          </View>
        </SafeAreaView>
      </View>

      {/* ── Cards panel ── */}
      <View style={s.panel}>

        {/* Settings */}
        <SectionLabel label={t('profile.settings')} />
        <View style={s.group}>
          <MenuItem
            icon="bell-outline"
            iconBg="#EFF8FF"
            iconColor="#0BA5EC"
            title={t('profile.notificationPrefs')}
            onPress={() => navigation.navigate('NotificationPrefs')}
          />
          <Divider />
          <MenuItem
            icon="account-child-outline"
            iconBg={colors.primarySoft}
            iconColor={colors.primary}
            title={t('profile.childrenSchools')}
            onPress={() => navigation.navigate('ChildrenSchools')}
          />
          <Divider />
          <MenuItem
            icon="translate"
            iconBg="#FFF7ED"
            iconColor={colors.warning}
            title={t('profile.language')}
            subtitle={LANG_LABELS[i18n.language] ?? 'English'}
            onPress={() => navigation.navigate('Language')}
          />
        </View>

        {/* Support */}
        <SectionLabel label="Support" />
        <View style={s.group}>
          <MenuItem
            icon="star-outline"
            iconBg="#FFFBEB"
            iconColor="#F59E0B"
            title="Rate EcoBus"
            subtitle="Enjoying the app? Leave us a review"
            onPress={() => Linking.openURL('https://ecobus.app')}
          />
          <Divider />
          <MenuItem
            icon="share-variant-outline"
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
            title="Share with other parents"
            onPress={handleShare}
          />
          <Divider />
          <MenuItem
            icon="headset"
            iconBg={colors.primarySoft}
            iconColor={colors.primary}
            title={t('profile.contact')}
            subtitle="support@ecobus.app"
            onPress={() => Linking.openURL('mailto:support@ecobus.app')}
          />
        </View>

        {/* Legal */}
        <SectionLabel label={t('profile.legal')} />
        <View style={s.group}>
          <MenuItem
            icon="shield-check-outline"
            iconBg="#F0FDF4"
            iconColor={colors.success}
            title={t('profile.privacy')}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
          <Divider />
          <MenuItem
            icon="file-document-outline"
            iconBg="#F0FDF4"
            iconColor={colors.success}
            title={t('profile.terms')}
            onPress={() => navigation.navigate('Terms')}
          />
        </View>

        {/* Account */}
        <SectionLabel label={t('profile.account')} />
        <View style={s.group}>
          <MenuItem
            icon="account-remove-outline"
            iconBg={colors.dangerLight}
            iconColor={colors.danger}
            title={t('profile.deleteAccount')}
            subtitle={t('profile.deleteAccountSub')}
            onPress={() => navigation.navigate('DeleteAccount')}
            titleColor={colors.danger}
          />
        </View>

        {/* Logout */}
        <View style={[s.group, s.logoutRow]}>
          <MenuItem
            icon="logout"
            iconBg={colors.dangerLight}
            iconColor={colors.danger}
            title={t('profile.logout')}
            titleColor={colors.danger}
            onPress={confirmLogout}
            noChevron
          />
        </View>

        {/* App version */}
        <View style={s.versionRow}>
          <MaterialCommunityIcons name="bus-clock" size={14} color={colors.textDisabled} allowFontScaling={false} />
          <Text style={s.versionText}>EcoBus · v1.0.0</Text>
        </View>

        <View style={{ height: 32 }} />
      </View>
    </Screen>
  );
}

function SectionLabel({ label }) {
  return (
    <View style={s.groupLabel}>
      <Text style={s.groupLabelText}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={s.divider} />;
}

function MenuItem({ icon, iconBg, iconColor, title, subtitle, onPress, titleColor, noChevron }) {
  const content = (
    <>
      <View style={[s.menuIconWrap, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons
          name={icon}
          size={ICON_SIZE}
          color={iconColor}
          allowFontScaling={false}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.menuTitle, titleColor && { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={s.menuSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {onPress && !noChevron ? (
        <Icon name="chevronRight" size={16} tint={colors.textMuted} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [s.menuItem, pressed && s.menuItemPressed]}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }
  return <View style={s.menuItem}>{content}</View>;
}

const s = StyleSheet.create({
  /* Hero */
  hero: { backgroundColor: colors.primary, overflow: 'hidden' },
  heroInner: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  heroGlow: {
    position: 'absolute', top: -80, right: -80,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: colors.surface, opacity: 0.08,
  },
  heroGlowBL: {
    position: 'absolute', bottom: 0, left: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: colors.surface, opacity: 0.05,
  },
  heroTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm, marginBottom: spacing.lg,
  },
  heroScreenTitle: { fontSize: 18, fontWeight: '800', color: colors.textInverse },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.onBrandHigh,
    alignItems: 'center', justifyContent: 'center',
  },
  heroContent: { alignItems: 'center' },
  avatarRing: {
    padding: 4, borderRadius: 48,
    borderWidth: 3, borderColor: colors.onBrandMid,
    marginBottom: spacing.sm,
  },
  heroName: { fontSize: 22, fontWeight: '800', color: colors.textInverse, letterSpacing: -0.3 },
  heroMeta: { fontSize: 13, color: colors.onBrandMuted, marginTop: 3 },

  /* Panel */
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },

  groupLabel: { paddingHorizontal: 4, marginBottom: 8, marginTop: spacing.lg },
  groupLabelText: {
    fontSize: 11, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  logoutRow: { marginTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginStart: WRAP_SIZE + spacing.md + spacing.sm },

  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 60,
    gap: spacing.sm,
  },
  menuItemPressed: { backgroundColor: colors.surfaceAlt },
  menuIconWrap: {
    width: WRAP_SIZE, height: WRAP_SIZE,
    borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  menuTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  menuSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  versionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, marginTop: spacing.xl,
  },
  versionText: { fontSize: 12, color: colors.textDisabled },
});
