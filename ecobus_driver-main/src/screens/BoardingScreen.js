import React, { useCallback, useEffect, useState } from 'react';
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
import { Screen, Card, Badge, Avatar, Loader, EmptyState, useToast } from '../components';
import { colors, spacing, typography, radius, shadows } from '../theme';
import { BoardingAPI, AssignmentAPI, ChildrenAPI, RoutesAPI } from '../services/api';
import { humanizeError } from '../utils/errors';

const STATUS_CONFIG = {
  not_boarded: {
    tone: 'danger',
    icon: 'clock-alert-outline',
    color: colors.danger,
    bgColor: colors.dangerLight,
  },
  boarded: {
    tone: 'success',
    icon: 'check-circle-outline',
    color: colors.success,
    bgColor: colors.successLight,
  },
  dropped: {
    tone: 'info',
    icon: 'map-marker-check-outline',
    color: colors.primaryDark,
    bgColor: colors.infoLight,
  },
};

export default function BoardingScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [children, setChildren] = useState([]);
  const [stops, setStops]       = useState([]);
  const [tripId, setTripId]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingId, setLoadingId] = useState(null);

  const load = useCallback(async () => {
    const a = await AssignmentAPI.today().catch(() => null);
    setTripId(a?.id || null);
    if (a?.routeId) {
      const [kids, st] = await Promise.all([
        ChildrenAPI.byRoute(a.routeId),
        (a.stops && a.stops.length ? Promise.resolve(a.stops) : RoutesAPI.stops(a.routeId)),
      ]);
      setChildren(kids);
      setStops(st || []);
    } else {
      setChildren([]);
      setStops([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const toast = useToast();

  const handleStatusToggle = useCallback(async (child) => {
    if (loadingId) return;
    setLoadingId(child.id);
    try {
      let newStatus;
      if (child.boardingStatus === 'not_boarded') {
        await BoardingAPI.checkIn(child.id, tripId);
        newStatus = 'boarded';
      } else if (child.boardingStatus === 'boarded') {
        await BoardingAPI.checkOut(child.id, tripId);
        newStatus = 'dropped';
      } else {
        return; // dropped → no further action
      }
      // Only update local state when the server confirms the checkin —
      // BoardingAPI now throws on failure (no more silent fakes).
      setChildren((prev) =>
        prev.map((c) => c.id === child.id ? { ...c, boardingStatus: newStatus } : c),
      );
    } catch (err) {
      const reason = humanizeError(err, t);
      toast.show(`${t('errors.boardingFailed')} : ${reason}`, { tone: 'danger' });
    } finally {
      setLoadingId(null);
    }
  }, [loadingId, tripId, t, toast]);

  // Group children by stop
  const grouped = stops.map((stop) => ({
    stop,
    children: children.filter((c) => c.stopId === stop.id),
  })).filter((g) => g.children.length > 0);

  const totalBoarded = children.filter((c) => c.boardingStatus === 'boarded').length;
  const totalDropped = children.filter((c) => c.boardingStatus === 'dropped').length;
  const total = children.length;

  if (loading) return <Screen><Loader /></Screen>;
  if (!children.length) return (
    <Screen>
      <EmptyState icon="account-group" title={t('boarding.title')} message={t('assignment.noAssignmentBody')} />
    </Screen>
  );

  return (
    <Screen padded={false} edges={['top']} scroll={false}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>{t('boarding.title')}</Text>
        <View style={s.stats}>
          <StatChip icon="check-circle" value={totalBoarded} color={colors.success} />
          <StatChip icon="map-marker-check" value={totalDropped} color={colors.primaryDark} />
          <StatChip icon="account-group" value={total} color={colors.textSecondary} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg, gap: spacing.sm, paddingHorizontal: spacing.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {grouped.map(({ stop, children: stopChildren }) => (
          <View key={stop.id}>
            {/* Stop header */}
            <View style={s.stopHeader}>
              <MaterialCommunityIcons
                name={stop.isSchool ? 'school' : 'bus-stop'}
                size={16}
                color={stop.isSchool ? colors.success : colors.primary}
              />
              <Text style={s.stopName}>{stop.shortName}</Text>
              <Text style={s.stopTime}>{stop.scheduledTime}</Text>
              <Text style={s.stopCount}>{stopChildren.length} {t('boarding.children')}</Text>
            </View>

            {/* Children cards */}
            {stopChildren.map((child) => (
              <ChildRow
                key={child.id}
                child={child}
                onToggle={() => handleStatusToggle(child)}
                loading={loadingId === child.id}
                t={t}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function StatChip({ icon, value, color }) {
  return (
    <View style={[s.statChip, { backgroundColor: `${color}18` }]}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text style={[s.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function ChildRow({ child, onToggle, loading, t }) {
  const cfg = STATUS_CONFIG[child.boardingStatus];
  const canToggle = child.boardingStatus !== 'dropped';

  return (
    <Pressable
      onPress={canToggle && !loading ? onToggle : null}
      style={({ pressed }) => [
        s.childRow,
        shadows.sm,
        pressed && canToggle && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      disabled={!canToggle || loading}
    >
      <Avatar name={child.name} size={44} />

      <View style={s.childInfo}>
        <Text style={s.childName}>{child.name}</Text>
        <View style={[s.statusPill, { backgroundColor: cfg.bgColor }]}>
          <MaterialCommunityIcons name={cfg.icon} size={12} color={cfg.color} />
          <Text style={[s.statusText, { color: cfg.color }]}>
            {t(`boarding.${child.boardingStatus === 'not_boarded' ? 'notBoarded' : child.boardingStatus === 'boarded' ? 'boarded' : 'dropped'}`)}
          </Text>
        </View>
      </View>

      {canToggle && (
        <View style={[s.actionBtn, { backgroundColor: cfg.color }, loading && { opacity: 0.6 }]}>
          <MaterialCommunityIcons
            name={child.boardingStatus === 'not_boarded' ? 'check' : 'map-marker-check'}
            size={18}
            color="#fff"
          />
        </View>
      )}
      {!canToggle && (
        <MaterialCommunityIcons name="check-all" size={20} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  title: { ...typography.titleSm, color: colors.textPrimary },
  stats: { flexDirection: 'row', gap: spacing.xs },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.xs, paddingVertical: 4, borderRadius: radius.pill,
  },
  statValue: { ...typography.captionMd, fontWeight: '700' },

  stopHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.xs, marginBottom: 4,
  },
  stopName: { ...typography.bodySmMd, color: colors.textPrimary, flex: 1 },
  stopTime: { ...typography.caption, color: colors.textMuted },
  stopCount: { ...typography.caption, color: colors.textMuted, marginStart: spacing.xs },

  childRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.sm, marginBottom: spacing.xs,
  },
  childInfo: { flex: 1, gap: 4 },
  childName: { ...typography.bodySmMd, color: colors.textPrimary },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: spacing.xs,
    paddingVertical: 2, borderRadius: radius.pill,
  },
  statusText: { ...typography.caption, fontWeight: '600' },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
});
