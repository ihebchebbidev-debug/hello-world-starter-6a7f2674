import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Screen, ScreenHeader, Avatar, Icon, EmptyState,
  Skeleton, AbsenceModal, useToast,
} from '../components';
import { ChildrenAPI, TripsAPI, AbsencesAPI } from '../services/api';
import useAsync from '../hooks/useAsync';
import { colors, radius, spacing, shadows } from '../theme';
import { todayYMD } from '../utils/dates';
import { STATUS_CFG } from '../constants/statusConfig';
import { humanizeError } from '../utils/errors';

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

export default function ChildrenSchoolsScreen({ navigation }) {
  const { t } = useTranslation();
  const toast = useToast();

  const [absenceFor,        setAbsenceFor]        = useState(null);
  const [submittingAbsence, setSubmittingAbsence] = useState(false);

  const childrenQ = useAsync(() => ChildrenAPI.list(), []);
  const tripQ     = useAsync(() => TripsAPI.today().catch(() => null), []);

  const children    = useMemo(() => asArray(childrenQ.data), [childrenQ.data]);
  const trip        = tripQ.data;
  const childIdsKey = useMemo(() => children.map((c) => c.id).sort().join(','), [children]);

  const absencesQ = useAsync(async () => {
    if (children.length === 0) return {};
    const pairs = await Promise.all(
      children.map((c) =>
        AbsencesAPI.listForChild(c.id, { from: todayYMD(), to: todayYMD() })
          .then((rows) => [c.id, rows?.[0] ?? null])
          .catch(() => [c.id, null]),
      ),
    );
    return Object.fromEntries(pairs);
  }, [childIdsKey]);

  const absencesByChild = absencesQ.data ?? {};

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

  const isLoading = childrenQ.loading;

  return (
    <>
      <Screen scroll padded={false} statusBarStyle="dark-content">
        <ScreenHeader title={t('childrenSchools.title')} onBack={() => navigation.goBack()} />

        <View style={s.intro}>
          <Text style={s.introText}>{t('childrenSchools.subtitle')}</Text>
        </View>

        {isLoading ? (
          <View style={s.cards}>
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </View>
        ) : children.length === 0 ? (
          <EmptyState
            icon="emptyChild"
            title={t('childrenSchools.noChildren')}
            message={t('childrenSchools.noChildrenHint')}
          />
        ) : (
          <View style={s.cards}>
            {children.map((child) => {
              const statusCfg   = STATUS_CFG[child.status ?? trip?.status];
              const absence     = absencesByChild[child.id];
              const hasLiveTrip = !!(trip?.busId);
              return (
                <ChildCard
                  key={child.id}
                  child={child}
                  statusCfg={statusCfg}
                  absence={absence}
                  hasLiveTrip={hasLiveTrip}
                  onOpen={() => navigation.navigate('ChildDetails', { childId: child.id, child })}
                  onViewMap={() => navigation.navigate('Tracking', {
                    busId: trip.busId, tripId: trip.id, child,
                  })}
                  onMarkAbsent={() => setAbsenceFor(child)}
                  t={t}
                />
              );
            })}
          </View>
        )}
      </Screen>

      {absenceFor ? (
        <AbsenceModal
          visible
          child={absenceFor}
          onClose={() => setAbsenceFor(null)}
          onConfirm={submitAbsence}
          loading={submittingAbsence}
        />
      ) : null}
    </>
  );
}

/* ── Child card ─────────────────────────────────────────────────── */

function ChildCard({ child, statusCfg, absence, hasLiveTrip, onOpen, onViewMap, onMarkAbsent, t }) {
  const absentToday = !!absence;
  const accentColor = absentToday ? colors.danger : colors.primary;

  return (
    <Pressable
      onPress={onOpen}
      android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
      accessibilityRole="button"
      accessibilityLabel={child.name}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.95 }]}
    >
      {/* Coloured top bar */}
      <View style={[s.cardBar, { backgroundColor: accentColor }]} />

      {/* Header: avatar + name + status */}
      <View style={s.cardHeader}>
        <Avatar uri={child.photoUrl} name={child.name} size={52} />
        <View style={s.nameBlock}>
          <Text style={s.childName} numberOfLines={1}>{child.name}</Text>
          {child.grade ? (
            <Text style={s.childGrade}>{t('childrenSchools.grade', { grade: child.grade })}</Text>
          ) : null}
        </View>
        {(statusCfg || absentToday) ? (
          <View style={[
            s.statusPill,
            { backgroundColor: (absentToday ? colors.danger : accentColor) + '1A' },
          ]}>
            <View style={[s.statusDot, { backgroundColor: absentToday ? colors.danger : (statusCfg?.color ?? colors.warning) }]} />
            <Text style={[s.statusText, { color: absentToday ? colors.danger : (statusCfg?.color ?? colors.warning) }]}>
              {absentToday ? t('absence.absentToday') : t(statusCfg?.key ?? 'home.status.waiting')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Info rows */}
      <View style={s.infoBlock}>
        <InfoRow
          icon="tabProfile" iconBg={colors.infoLight} iconTint={colors.info}
          label={t('childrenSchools.school')}
          value={child.schoolName ?? t('childrenSchools.unassigned')}
        />
        <InfoRow
          icon="bus" iconBg={colors.primarySoft} iconTint={colors.primary}
          label={t('childrenSchools.route')}
          value={child.routeName ?? t('childrenSchools.unassigned')}
          badge={child.busNumber ? `#${child.busNumber}` : null}
        />
        {child.driverName ? (
          <InfoRow
            icon="tabProfile" iconBg={colors.surfaceAlt} iconTint={colors.textSecondary}
            label={t('childrenSchools.driver')}
            value={child.driverName}
          />
        ) : null}
        <InfoRow
          icon="statusOnBus" iconBg={colors.successLight} iconTint={colors.success}
          label={t('childrenSchools.pickup')}
          value={child.pickupStop ?? t('childrenSchools.unassigned')}
        />
        <InfoRow
          icon="statusDropped" iconBg={colors.primaryLight} iconTint={colors.primary}
          label={t('childrenSchools.dropoff')}
          value={child.dropoffStop ?? t('childrenSchools.unassigned')}
        />
      </View>

      {/* Action buttons */}
      <View style={s.actions}>
        <Pressable
          style={({ pressed }) => [
            s.actionBtn, s.actionMap,
            !hasLiveTrip && s.actionDisabled,
            pressed && hasLiveTrip && { opacity: 0.8, transform: [{ scale: 0.97 }] },
          ]}
          onPress={hasLiveTrip ? onViewMap : undefined}
          disabled={!hasLiveTrip}
          accessibilityRole="button"
          accessibilityHint={!hasLiveTrip ? t('childrenSchools.noActiveTrip') : undefined}
        >
          <Icon name="bus" size={16} tint={hasLiveTrip ? colors.primary : colors.textDisabled} />
          <Text style={[s.actionText, s.actionTextMap, !hasLiveTrip && s.actionTextDisabled]}>
            {t('childrenSchools.viewMap')}
          </Text>
        </Pressable>

        <View style={s.actionDivider} />

        <Pressable
          style={({ pressed }) => [
            s.actionBtn, s.actionAbsent,
            pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
          ]}
          onPress={onMarkAbsent}
          accessibilityRole="button"
        >
          <Icon name="alert" size={16} tint={colors.danger} />
          <Text style={[s.actionText, s.actionTextAbsent]}>
            {t('childrenSchools.markAbsent')}
          </Text>
        </Pressable>
      </View>

      {!hasLiveTrip ? (
        <View style={s.noTripHint}>
          <Icon name="info" size={11} tint={colors.textMuted} />
          <Text style={s.noTripHintText}>{t('childrenSchools.noActiveTrip')}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function InfoRow({ icon, iconBg, iconTint, label, value, badge }) {
  return (
    <View style={s.infoRow}>
      <View style={[s.infoIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={14} tint={iconTint} />
      </View>
      <Text style={s.infoLabel} numberOfLines={1}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
      {badge ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  intro: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  introText: {
    fontSize: 13, color: colors.textSecondary, lineHeight: 20,
  },
  cards: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },

  /* Card */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardBar: { height: 4 },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  nameBlock: { flex: 1 },
  childName:  { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  childGrade: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  /* Status pill */
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  /* Info block */
  infoBlock: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.xs, minHeight: 32,
  },
  infoIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  infoLabel: {
    fontSize: 12, color: colors.textMuted, fontWeight: '500',
    width: 82, flexShrink: 0,
  },
  infoValue: {
    flex: 1, fontSize: 13, fontWeight: '600', color: colors.textPrimary,
  },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  /* Actions */
  actions: {
    flexDirection: 'row',
  },
  actionDivider: { width: 1, backgroundColor: colors.border },
  actionBtn: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: spacing.sm + 2,
  },
  actionMap:    { backgroundColor: colors.primarySoft },
  actionAbsent: { backgroundColor: colors.dangerLight },
  actionDisabled: { backgroundColor: colors.surfaceAlt },
  actionText:     { fontSize: 13, fontWeight: '700' },
  actionTextMap:  { color: colors.primary },
  actionTextAbsent: { color: colors.danger },
  actionTextDisabled: { color: colors.textDisabled },

  /* No active trip hint */
  noTripHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    backgroundColor: colors.surfaceAlt,
  },
  noTripHintText: {
    fontSize: 11, color: colors.textMuted, fontWeight: '500',
  },
});
