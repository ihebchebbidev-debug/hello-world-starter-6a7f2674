import React, { useCallback, useMemo } from 'react';
import {
  FlatList, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Loader, ErrorState, EmptyState, Badge, Icon, Skeleton } from '../components';
import { TripsAPI } from '../services/api';
import useAsync from '../hooks/useAsync';
import { useResponsive } from '../theme/responsive';
import { colors, radius, spacing, typography, shadows } from '../theme';
import { formatDate, formatTime } from '../utils/format';

const STATUS_TONE = {
  completed: 'success',
  upcoming:  'warning',
  cancelled: 'danger',
  ongoing:   'info',
};

const STATUS_ICON = {
  completed: { name: 'statusDropped', color: colors.success },
  upcoming:  { name: 'statusWaiting', color: colors.warning },
  cancelled: { name: 'alert',         color: colors.danger  },
  ongoing:   { name: 'statusOnBus',   color: colors.info    },
};

export default function TripHistoryScreen({ navigation }) {
  const { t } = useTranslation();
  const { isLarge, isTablet } = useResponsive();

  const { data, loading, refreshing, error, reload } = useAsync(
    () => TripsAPI.history().catch(() => []),
    [],
  );

  const items = useMemo(() => Array.isArray(data) ? data : [], [data]);

  const numColumns = isTablet ? 3 : isLarge ? 2 : 1;

  const handleOpen = useCallback((item) => {
    // Live trip → open the realtime tracking screen so the parent can follow
    // the bus. Past trips don't have a dedicated detail screen yet, so we
    // route them to TripHistory tab (no-op visually but keeps interaction
    // affordance honest — and a future detail screen plugs in here).
    const busId  = item.busId  ?? item.bus_id;
    const tripId = item.id     ?? item.tripId ?? item.trip_id;
    if (item.status === 'ongoing' && (busId || tripId)) {
      navigation.navigate('Tracking', { busId, tripId });
    }
  }, [navigation]);

  const renderItem = useCallback(({ item }) => {
    const statusKey   = item.status || 'completed';
    const statusLabel = t(`trips.status.${statusKey}`, { defaultValue: statusKey });
    const iconCfg     = STATUS_ICON[statusKey] ?? STATUS_ICON.completed;
    const tappable    = statusKey === 'ongoing';
    return (
      <View style={numColumns > 1 ? s.cellMulti : s.cellFull}>
        <Pressable
          onPress={tappable ? () => handleOpen(item) : undefined}
          android_ripple={tappable ? { color: 'rgba(0,0,0,0.06)' } : undefined}
          accessibilityRole={tappable ? 'button' : undefined}
          style={({ pressed }) => [s.tripCard, pressed && tappable && { opacity: 0.85 }]}
        >
          <View style={[s.cardAccent, { backgroundColor: iconCfg.color }]} />
          <View style={s.cardBody}>
            <View style={s.cardTop}>
              <Text style={s.date}>
                {formatDate(item.date ?? item.startedAt ?? item.start_time)}
              </Text>
              <Badge label={statusLabel} tone={STATUS_TONE[item.status] ?? 'success'} />
            </View>

            <Text style={s.routeName} numberOfLines={1}>
              {item.routeName ?? t('home.morningRoute')}
            </Text>

            <View style={s.timeRow}>
              <View style={s.timeChip}>
                <View style={[s.timeDot, { backgroundColor: colors.success }]} />
                <Text style={s.timeText}>{formatTime(item.startedAt ?? item.start_time)}</Text>
                <Text style={s.timeLabel}>{t('trips.pickup')}</Text>
              </View>
              <Icon name="chevronRight" size={14} tint={colors.border} />
              <View style={s.timeChip}>
                <View style={[s.timeDot, { backgroundColor: colors.primary }]} />
                <Text style={s.timeText}>{formatTime(item.endedAt ?? item.end_time)}</Text>
                <Text style={s.timeLabel}>{t('trips.dropoff')}</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </View>
    );
  }, [numColumns, t, handleOpen]);

  const keyExtractor = useCallback((item) => String(item.id), []);

  return (
    <View style={s.root}>
      {/* ── White header ── */}
      <SafeAreaView edges={['top']} style={s.header}>
        <View style={s.headerRow}>
          {navigation?.canGoBack?.() ? (
            <Pressable
              onPress={() => navigation.goBack()}
              style={s.backBtn} hitSlop={12} accessibilityRole="button"
            >
              <Icon name="chevronRight" size={18} tint={colors.textPrimary} style={{ transform: [{ rotate: '180deg' }] }} />
            </Pressable>
          ) : <View style={{ width: 36 }} />}

          <Text style={s.headerTitle}>{t('trips.title')}</Text>

          {!loading && Array.isArray(data) && data.length > 0 ? (
            <View style={s.countBadge}>
              <Text style={s.countText}>{data.length}</Text>
            </View>
          ) : <View style={{ width: 36 }} />}
        </View>
      </SafeAreaView>

      {/* List */}
      <View style={s.listWrap}>
        {loading ? (
          <View style={s.skeletonWrap}>
            <Skeleton variant="trip" />
          </View>
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState icon="bus" title={t('trips.emptyTitle')} message={t('trips.emptyMessage')} />
        ) : (
          <FlatList
            data={items}
            key={`cols-${numColumns}`}
            numColumns={numColumns}
            columnWrapperStyle={numColumns > 1 ? s.colWrap : undefined}
            keyExtractor={keyExtractor}
            contentContainerStyle={s.list}
            refreshControl={
              <RefreshControl refreshing={!!refreshing} onRefresh={reload} tintColor={colors.primary} />
            }
            renderItem={renderItem}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
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
  countBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primarySoft,
    borderWidth: 1, borderColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontSize: 13, fontWeight: '800', color: colors.primary },

  /* List */
  listWrap:     { flex: 1, backgroundColor: colors.background },
  skeletonWrap: { padding: spacing.md, gap: spacing.sm },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  colWrap:   { gap: spacing.sm },
  cellFull:  { width: '100%' },
  cellMulti: { flex: 1 },

  /* Trip card */
  tripCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
    ...shadows.card,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: spacing.md },
  cardTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  date: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  routeName: {
    fontSize: 15, color: colors.textPrimary, fontWeight: '600',
    marginBottom: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeDot:  { width: 8, height: 8, borderRadius: 4 },
  timeText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  timeLabel: { fontSize: 11, color: colors.textMuted },
});
