import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Screen, EmptyState, Loader, useToast } from '../components';
import { colors, spacing, typography, radius, shadows } from '../theme';
import useAsync from '../hooks/useAsync';
import { NotificationsAPI } from '../services/api';
import { humanizeError } from '../utils/errors';

const TYPE_CONFIG = {
  route_change: { icon: 'routes', color: colors.warning },
  admin:        { icon: 'shield-account', color: colors.primary },
  emergency:    { icon: 'alert-octagon', color: colors.danger },
};

function timeAgo(iso, t) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return t('notifications.timeDays', { d });
  if (h > 0) return t('notifications.timeHours', { h });
  if (m > 0) return t('notifications.timeMins', { m });
  return t('notifications.timeNow');
}

export default function NotificationsScreen({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [readIds, setReadIds] = useState(new Set());

  const { data: notifications, loading, refreshing, error, reload } = useAsync(
    () => NotificationsAPI.list(),
    [],
  );

  const markAllRead = useCallback(async () => {
    try {
      await NotificationsAPI.markAllRead();
      if (notifications) setReadIds(new Set(notifications.map((n) => n.id)));
    } catch (err) {
      toast.show(humanizeError(err, t), { tone: 'danger' });
    }
  }, [notifications, toast, t]);

  const isRead = (n) => n.read || readIds.has(n.id);
  const hasUnread = notifications?.some((n) => !isRead(n));

  // Map a driver notification to a screen. Routing logic is intentionally
  // simple — the driver only has 4 screens that can carry context, and
  // most notifications steer them to either the live map or boarding.
  const openNotification = useCallback((n) => {
    setReadIds((prev) => {
      if (prev.has(n.id)) return prev;
      const next = new Set(prev); next.add(n.id); return next;
    });
    if (n.id) NotificationsAPI.markRead?.(n.id).catch(() => {});
    const type = n.type;
    if (type === 'emergency' || type === 'sos') {
      navigation?.navigate?.('Sos');
    } else if (type === 'route_change' || type === 'boarding' || type === 'check_in') {
      navigation?.navigate?.('Main', { screen: 'Boarding' });
    } else {
      navigation?.navigate?.('Main', { screen: 'Map' });
    }
  }, [navigation]);

  return (
    <Screen padded={false} edges={['top']} scroll={false}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>{t('notifications.title')}</Text>
        {hasUnread && (
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={s.markAll}>{t('notifications.markAllRead')}</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <Loader />
      ) : error ? (
        <Pressable style={s.errorWrap} onPress={reload}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color={colors.textMuted} />
          <Text style={s.errorText}>{t('errors.loadFailed')}</Text>
        </Pressable>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: spacing.md,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.primary} />}
        >
          {!notifications || notifications.length === 0 ? (
            <EmptyState
              icon="emptyBell"
              title={t('notifications.empty')}
              message={t('notifications.emptyBody')}
            />
          ) : (
            <View style={s.list}>
              {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} read={isRead(n)} t={t} onPress={openNotification} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function NotificationItem({ notification, read, t, onPress }) {
  const cfg = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.admin;

  return (
    <Pressable
      onPress={onPress ? () => onPress(notification) : undefined}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
      accessibilityRole="button"
      accessibilityLabel={notification.title}
      style={({ pressed }) => [s.item, !read && s.itemUnread, shadows.sm, pressed && { opacity: 0.9 }]}
    >
      <View style={[s.iconWrap, { backgroundColor: `${cfg.color}18` }]}>
        <MaterialCommunityIcons name={cfg.icon} size={20} color={cfg.color} />
      </View>
      <View style={s.itemContent}>
        <View style={s.itemRow}>
          <Text style={[s.itemTitle, !read && s.itemTitleUnread]} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={s.itemTime}>{timeAgo(notification.createdAt, t)}</Text>
        </View>
        <Text style={s.itemBody} numberOfLines={2}>{notification.body}</Text>
      </View>
      {!read && <View style={s.unreadDot} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  title: { ...typography.titleSm, color: colors.textPrimary },
  markAll: { ...typography.bodySm, color: colors.primary, fontWeight: '600' },

  errorWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  errorText: { ...typography.bodySm, color: colors.textMuted, textAlign: 'center' },

  list: { gap: spacing.xs, paddingTop: spacing.xs },

  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.sm,
  },
  itemUnread: { backgroundColor: colors.primarySoft },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  itemContent: { flex: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  itemTitle: { ...typography.bodySmMd, color: colors.textPrimary, flex: 1, marginEnd: spacing.xs },
  itemTitleUnread: { fontWeight: '700' },
  itemTime: { ...typography.caption, color: colors.textMuted },
  itemBody: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary, marginTop: 4,
  },
});
