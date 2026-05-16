import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Loader, ErrorState, EmptyState, useToast, Icon, Skeleton } from '../components';
import NotificationItem from '../components/NotificationItem';
import { NotificationsAPI } from '../services/api';
import { humanizeError } from '../utils/errors';
import { notificationTarget } from '../utils/notificationNav';
import useAsync from '../hooks/useAsync';
import { colors, spacing, typography, shadows } from '../theme';

export default function NotificationsScreen({ navigation }) {
  const { t } = useTranslation();
  const toast = useToast();

  const { data, loading, refreshing, error, reload } = useAsync(
    () => NotificationsAPI.list(),
    [],
  );

  const items = useMemo(() => Array.isArray(data) ? data : [], [data]);

  const unreadCount = useMemo(() => {
    return items.filter((n) => !n.read && !n.readAt).length;
  }, [items]);

  const onMarkAllRead = useCallback(async () => {
    try {
      await NotificationsAPI.markAllRead();
      toast.show(t('notifications.markedToast'), { tone: 'success' });
      reload();
    } catch (err) {
      toast.show(humanizeError(err, t), { tone: 'danger' });
    }
  }, [reload, toast, t]);

  const handlePress = useCallback(async (item) => {
    // Optimistically mark as read so the UI feels responsive; the screen will
    // refetch on next focus to reconcile.
    if (!item.read && !item.readAt && item.id) {
      NotificationsAPI.markRead?.(item.id).catch(() => {});
    }
    const target = notificationTarget(item);
    if (target) navigation.navigate(target.screen, target.params);
  }, [navigation]);

  const renderItem = useCallback(({ item }) => (
    <NotificationItem item={item} onPress={handlePress} />
  ), [handlePress]);
  const keyExtractor = useCallback((item) => String(item.id), []);

  return (
    <View style={s.root}>
      {/* ── White header ── */}
      <SafeAreaView edges={['top']} style={s.header}>
        <View style={s.headerRow}>
          {navigation?.canGoBack?.() ? (
            <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={12} accessibilityRole="button">
              <Icon name="chevronRight" size={18} tint={colors.textPrimary} style={{ transform: [{ rotate: '180deg' }] }} />
            </Pressable>
          ) : <View style={{ width: 36 }} />}

          <Text style={s.headerTitle}>{t('notifications.title')}</Text>

          <Pressable
            onPress={onMarkAllRead}
            style={s.iconBtn}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Icon name="check" size={18} tint={colors.primary} />
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={s.listWrap}>
        {loading ? (
          <View style={s.skeletonWrap}>
            <Skeleton variant="notification" />
          </View>
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="emptyBell"
            title={t('notifications.emptyTitle')}
            message={t('notifications.emptyMessage')}
          />
        ) : (
          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={s.list}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            refreshControl={
              <RefreshControl refreshing={!!refreshing} onRefresh={reload} tintColor={colors.primary} />
            }
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  /* Header */
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.2,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primarySoft,
    borderWidth: 1, borderColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  /* List */
  listWrap:     { flex: 1, backgroundColor: colors.background },
  skeletonWrap: { paddingTop: spacing.xs, backgroundColor: colors.surface },
  list: { paddingTop: spacing.sm, paddingBottom: spacing.xl },
  separator: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
});
