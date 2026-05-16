import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Image, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Screen, ErrorState, EmptyState, Avatar, Icon,
  Skeleton, AbsenceModal, useToast,
} from '../components';
import MiniMap from '../components/MiniMap';
import NotificationItem from '../components/NotificationItem';
import {
  ChildrenAPI, TripsAPI, EtaAPI, AuthAPI,
  AbsencesAPI, NotificationsAPI, BusesAPI,
} from '../services/api';
import { notificationTarget } from '../utils/notificationNav';
import useAsync from '../hooks/useAsync';
import { colors, radius, spacing, typography, shadows, layout } from '../theme';
import { useResponsive } from '../theme/responsive';
import { todayYMD } from '../utils/dates';
import { formatEta } from '../utils/format';
import { Icons } from '../assets/icons';
import { STATUS_CFG, DEFAULT_STATUS } from '../constants/statusConfig';
import { humanizeError } from '../utils/errors';

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function getStatus(child, trip) {
  return STATUS_CFG[child?.status ?? trip?.status] ?? DEFAULT_STATUS;
}

/* ─── Screen ─────────────────────────────────────────────────── */
export default function HomeScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { isTablet } = useResponsive();

  const [absenceFor, setAbsenceFor] = useState(null);
  const [submittingAbsence, setSubmittingAbsence] = useState(false);

  const childrenQ = useAsync(() => ChildrenAPI.list(), []);
  const tripQ     = useAsync(() => TripsAPI.today(),   []);
  const meQ       = useAsync(() => AuthAPI.me().catch(() => null), []);

  const children     = useMemo(() => asArray(childrenQ.data), [childrenQ.data]);
  const firstChildId = children[0]?.id;

  const trip  = tripQ.data;
  const busId = trip?.busId;

  const busLiveQ = useAsync(
    () => (busId ? BusesAPI.live(busId).catch(() => null) : Promise.resolve(null)),
    [busId],
  );

  // Local ETA — derived from the (already fetched) bus live position and the
  // first child's pickup stop. Avoids an extra /eta network hit on every
  // refresh. Falls back to the API only when coords aren't cached yet.
  const firstChild = children[0];
  const stopCoords = useMemo(() => {
    const lat = firstChild?.pickupLat ?? firstChild?.pickup_stop_lat ?? firstChild?.stopLat;
    const lng = firstChild?.pickupLng ?? firstChild?.pickup_stop_lng ?? firstChild?.stopLng;
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? { lat: Number(lat), lng: Number(lng) }
      : null;
  }, [firstChild]);

  const busLiveCoords = useMemo(() => {
    const live = busLiveQ.data;
    if (!live) return null;
    const lat = Number(live.latitude); const lng = Number(live.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, speed: Number(live.speed) || 30 } : null;
  }, [busLiveQ.data]);

  const etaQ = useAsync(
    () => {
      if (busLiveCoords && stopCoords) {
        // Pure client-side haversine — zero API calls.
        return Promise.resolve(EtaAPI.localFromCoords(busLiveCoords, stopCoords, busLiveCoords.speed));
      }
      return firstChildId ? EtaAPI.forChild(firstChildId).catch(() => null) : Promise.resolve(null);
    },
    [firstChildId, busLiveCoords, stopCoords],
  );

  const notifQ = useAsync(() => NotificationsAPI.list().catch(() => []), []);
  const recentNotifs = useMemo(() => {
    const list = Array.isArray(notifQ.data) ? notifQ.data : [];
    return list.slice(0, 3);
  }, [notifQ.data]);

  const childIdsKey = useMemo(
    () => children.map((c) => c.id).sort().join(','),
    [children],
  );
  const absencesQ = useAsync(async () => {
    if (children.length === 0) return {};
    const today = todayYMD();
    const pairs = await Promise.all(
      children.map((c) =>
        AbsencesAPI.list(c.id, { from: today, to: today })
          .then((rows) => [c.id, rows?.[0] ?? null])
          .catch(() => [c.id, null]),
      ),
    );
    return Object.fromEntries(pairs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childIdsKey]);
  const absencesByChild = absencesQ.data || {};

  const refreshing = !!(
    childrenQ.refreshing || tripQ.refreshing ||
    etaQ.refreshing || absencesQ.refreshing ||
    busLiveQ.refreshing || notifQ.refreshing
  );
  const onRefresh = useCallback(() => {
    childrenQ.reload(); tripQ.reload(); etaQ.reload();
    absencesQ.reload(); busLiveQ.reload(); notifQ.reload();
  }, [childrenQ, tripQ, etaQ, absencesQ, busLiveQ, notifQ]);

  const submitAbsence = useCallback(async (payload) => {
    if (!absenceFor) return;
    setSubmittingAbsence(true);
    try {
      await AbsencesAPI.create(absenceFor.id, payload);
      toast.show(t('absence.successBody'), { tone: 'success' });
      setAbsenceFor(null);
      absencesQ.reload();
    } catch (err) {
      Alert.alert(t('absence.errorTitle'), humanizeError(err, t));
    } finally {
      setSubmittingAbsence(false);
    }
  }, [absenceFor, toast, t, absencesQ]);

  const me         = meQ.data;
  const parentName = me?.firstName || me?.name || t('profile.parentFallback');

  const eta     = etaQ.data;
  const arrival = eta?.etaMinutes != null
    ? formatEta(eta.etaMinutes, t)
    : eta?.arrivalAt
      ? new Date(eta.arrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';

  const tripStatus = STATUS_CFG[trip?.status] ?? DEFAULT_STATUS;

  const busForMap = useMemo(() => {
    const live = busLiveQ.data;
    if (!live) return null;
    return {
      lat: live.latitude  != null ? Number(live.latitude)  : null,
      lng: live.longitude != null ? Number(live.longitude) : null,
    };
  }, [busLiveQ.data]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t('home.greetingMorning');
    if (h < 18) return t('home.greetingAfternoon');
    return t('home.greetingEvening');
  }, [t]);

  const todayLabel = useMemo(() =>
    new Date().toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }),
  [i18n.language]);

  const unreadCount = useMemo(() => {
    const list = Array.isArray(notifQ.data) ? notifQ.data : [];
    return list.filter((n) => !n.read && !n.readAt).length;
  }, [notifQ.data]);

  if (childrenQ.error) return <ErrorState message={childrenQ.error.message} onRetry={childrenQ.reload} />;

  const isLoading  = childrenQ.loading || tripQ.loading;
  const openChild  = (childId) => navigation.navigate('ChildDetails', { childId });
  const openTracking = () => trip
    ? navigation.navigate('Tracking', { busId: trip.busId, tripId: trip.id, child: children[0] })
    : null;

  return (
    <Screen
      scroll
      padded={false}
      background={colors.background}
      statusBarStyle="dark-content"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* ── Top bar ── */}
      <SafeAreaView edges={['top']} style={s.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={s.greetSmall}>{greeting},</Text>
          <Text style={s.greetName} numberOfLines={1}>
            {parentName} <Text style={s.wave}>👋</Text>
          </Text>
        </View>
        <View style={s.topBarActions}>
          <Pressable
            style={s.iconBtn}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityRole="button"
          >
            <Icon name="alert" size={22} tint={colors.textPrimary} />
            {unreadCount > 0 ? (
              <View style={s.badge}>
                <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
          >
            <Avatar uri={me?.photoUrl} name={parentName} size={38} />
          </Pressable>
        </View>
      </SafeAreaView>

      <View style={s.content}>

        {/* ── My Children ── */}
        <SectionRow
          title={t('home.myChildren')}
          actionLabel={t('home.viewAll')}
          onAction={() => navigation.navigate('ChildDetails', { childId: children[0]?.id })}
        />
        {isLoading ? (
          <Skeleton variant="list" />
        ) : children.length === 0 ? (
          <EmptyState icon="emptyChild" title={t('home.noChildren')} message={t('home.noChildrenHint')} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.childScroll}>
            {children.map((c) => {
              const status  = getStatus(c, trip);
              const absence = absencesByChild[c.id];
              const dotColor = absence ? colors.danger : status.color;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => openChild(c.id)}
                  style={({ pressed }) => [s.childCard, pressed && s.childCardPressed]}
                  accessibilityRole="button"
                >
                  <View style={s.childAvatarWrap}>
                    <Avatar uri={c.photoUrl} name={c.name} size={58} />
                    <View style={[s.statusDot, { backgroundColor: dotColor }]} />
                  </View>
                  <Text style={s.childName} numberOfLines={1}>{c.name}</Text>
                  <View style={[s.childStatusPill, { backgroundColor: dotColor + '18' }]}>
                    <View style={[s.childStatusDot, { backgroundColor: dotColor }]} />
                    <Text style={[s.childStatusText, { color: dotColor }]} numberOfLines={1}>
                      {absence ? t('absence.absentToday') : t(status.key)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setAbsenceFor({ id: children[0].id, name: children[0].name })}
              style={({ pressed }) => [s.childCard, s.childCardAdd, pressed && s.childCardPressed]}
              accessibilityRole="button"
            >
              <View style={s.addCircle}>
                <Icon name="statusDropped" size={24} tint={colors.primary} />
              </View>
              <Text style={[s.childName, { color: colors.primary }]} numberOfLines={2}>
                {t('absence.openCta')}
              </Text>
            </Pressable>
          </ScrollView>
        )}

        {/* ── Trip hero card ── */}
        {!isLoading && trip ? (
          <>
            <Pressable
              onPress={openTracking}
              style={({ pressed }) => [s.tripCard, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}
              accessibilityRole="button"
            >
              {/* Background bus watermark */}
              <Image
                source={Icons.bus}
                style={s.tripBusWatermark}
                resizeMode="contain"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />

              {/* Top row: bus name + live badge */}
              <View style={s.tripTopRow}>
                <Text style={s.tripBusName}>
                  {trip.busName ?? (trip.busNumber ? `Bus ${trip.busNumber}` : t('tracking.driver'))}
                </Text>
                <View style={s.liveBadge}>
                  <View style={s.liveDot} />
                  <Text style={s.liveText}>{t('home.live')}</Text>
                </View>
              </View>

              {/* ETA block */}
              <Text style={s.tripArrivingLabel}>{t('home.arrivingIn')}</Text>
              <Text style={s.tripEta}>{arrival}</Text>

              {/* Status + driver */}
              <View style={s.tripMeta}>
                <View style={[s.tripStatusPill, { backgroundColor: colors.onBrandHigh }]}>
                  <View style={[s.tripStatusDot, { backgroundColor: tripStatus.color === colors.success ? '#4ADE80' : '#FCD34D' }]} />
                  <Text style={s.tripStatusText}>{t(tripStatus.key)}</Text>
                </View>
                {trip.driverName ? (
                  <Text style={s.tripDriver} numberOfLines={1}>
                    {trip.driverName}
                  </Text>
                ) : null}
              </View>

              {/* CTA button */}
              <View style={s.tripCta}>
                <Text style={s.tripCtaText}>{t('home.liveTracking')}</Text>
                <View style={s.tripCtaArrow}>
                  <Icon name="chevronRight" size={14} tint={colors.primary} />
                </View>
              </View>
            </Pressable>

            {busId ? <MiniMap bus={busForMap} onPress={openTracking} /> : null}
          </>
        ) : !isLoading ? (
          <View style={s.noTrip}>
            <View style={s.noTripIcon}>
              <Icon name="bus" size={28} tint={colors.textMuted} />
            </View>
            <Text style={s.noTripTitle}>{t('home.noTripToday')}</Text>
          </View>
        ) : null}

        {/* ── Quick Actions ── */}
        <SectionRow title={t('home.quickAccess')} />
        <View style={[s.qaRow, isTablet && s.qaRowTablet]}>
          <QuickAction icon="bus"          label={t('home.liveTracking')} onPress={openTracking} disabled={!trip} accent={colors.primary}  />
          <QuickAction icon="alert"        label={t('home.notifications')} onPress={() => navigation.navigate('Notifications')} accent={colors.info} />
          <QuickAction icon="tabHistory"   label={t('home.tripHistory')} onPress={() => navigation.navigate('HistoryTab')} accent={colors.warning} />
          <QuickAction icon="sos"          label={t('home.sos')} onPress={() => navigation.navigate('Sos')} accent={colors.danger} isDanger />
        </View>

        {/* ── Recent Activity ── */}
        {recentNotifs.length > 0 ? (
          <>
            <SectionRow
              title={t('home.recentActivity')}
              actionLabel={t('home.viewAll')}
              onAction={() => navigation.navigate('Notifications')}
            />
            <View style={s.activityCard}>
              {recentNotifs.map((item, idx) => (
                <View key={String(item.id)}>
                  {idx > 0 ? <View style={s.activityDivider} /> : null}
                  <NotificationItem
                    item={item}
                    onPress={(it) => {
                      const target = notificationTarget(it);
                      if (target) navigation.navigate(target.screen, target.params);
                      else navigation.navigate('Notifications');
                    }}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={{ height: layout.bottomSafe }} />
      </View>

      <AbsenceModal
        visible={!!absenceFor}
        childName={absenceFor?.name}
        submitting={submittingAbsence}
        onCancel={() => (submittingAbsence ? null : setAbsenceFor(null))}
        onConfirm={submitAbsence}
      />
    </Screen>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */
function SectionRow({ title, actionLabel, onAction }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={s.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function QuickAction({ icon, label, onPress, disabled, accent, isDanger }) {
  return (
    <Pressable
      onPress={disabled ? null : onPress}
      style={({ pressed }) => [
        s.qa,
        isDanger && s.qaDanger,
        disabled && s.qaDisabled,
        pressed && !disabled && { opacity: 0.8, transform: [{ scale: 0.95 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[s.qaIcon, { backgroundColor: disabled ? colors.surfaceAlt : accent + '15' }]}>
        <Icon name={icon} size={24} tint={disabled ? colors.textDisabled : accent} />
      </View>
      <Text style={[s.qaLabel, disabled && { color: colors.textDisabled }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  /* Top bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  greetSmall: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  greetName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  wave: { fontSize: 22 },
  topBarActions: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.card,
  },
  badge: {
    position: 'absolute', top: 6, right: 6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: colors.background,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: colors.textInverse },

  /* Content */
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },

  /* Section row */
  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.2,
  },
  sectionAction: {
    fontSize: 13, fontWeight: '600', color: colors.primary,
  },

  /* Children */
  childScroll: { gap: spacing.sm, paddingBottom: 4 },
  childCard: {
    width: 100,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 1.5, borderColor: colors.border,
    ...shadows.card,
  },
  childCardPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  childCardAdd: {
    borderColor: colors.primary,
    borderStyle: 'dashed',
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  childAvatarWrap: { position: 'relative', marginBottom: 8 },
  statusDot: {
    position: 'absolute', bottom: 1, right: -1,
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2.5, borderColor: colors.surface,
  },
  addCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  childName: {
    fontSize: 12, fontWeight: '700', color: colors.textPrimary,
    textAlign: 'center', paddingHorizontal: 4,
  },
  childStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 6, borderRadius: radius.pill,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  childStatusDot: { width: 5, height: 5, borderRadius: 3 },
  childStatusText: { fontSize: 9, fontWeight: '800' },

  /* Trip card */
  tripCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.raised,
  },
  tripBusWatermark: {
    position: 'absolute',
    width: 160, height: 160,
    right: -20, bottom: -20,
    opacity: 0.12, tintColor: colors.textInverse,
  },
  tripTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  tripBusName: {
    fontSize: 14, fontWeight: '700', color: colors.onBrandText,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.onBrandHigh,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveText: { fontSize: 11, fontWeight: '800', color: colors.textInverse, letterSpacing: 0.4 },
  tripArrivingLabel: {
    fontSize: 12, color: colors.onBrandMuted, marginTop: 8,
  },
  tripEta: {
    fontSize: 38, fontWeight: '900', color: colors.textInverse,
    letterSpacing: -1, marginBottom: 8,
  },
  tripMeta: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, marginBottom: spacing.md,
  },
  tripStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5,
  },
  tripStatusDot: { width: 6, height: 6, borderRadius: 3 },
  tripStatusText: { fontSize: 12, color: colors.textInverse, fontWeight: '700' },
  tripDriver: { fontSize: 12, color: colors.onBrandMuted, flex: 1 },
  tripCta: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    height: 44, borderRadius: radius.md,
    justifyContent: 'center', gap: 8,
    shadowColor: colors.textPrimary, shadowOpacity: 0.1,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tripCtaText: {
    fontSize: 14, fontWeight: '700', color: colors.primary,
  },
  tripCtaArrow: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  /* No trip */
  noTrip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  noTripIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  noTripTitle: { ...typography.body, color: colors.textMuted, fontWeight: '600' },

  /* Quick actions — 4-column horizontal row */
  qaRow: {
    flexDirection: 'row', gap: spacing.sm,
  },
  qaRowTablet: { gap: spacing.md },
  qa: {
    flex: 1, alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.card,
  },
  qaDanger: {
    backgroundColor: colors.dangerLight, borderColor: 'rgba(217,45,32,0.12)',
  },
  qaDisabled: { opacity: 0.45 },
  qaIcon: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  qaLabel: {
    fontSize: 11, fontWeight: '600', textAlign: 'center',
    color: colors.textSecondary, lineHeight: 14,
  },

  /* Activity */
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  activityDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
});
