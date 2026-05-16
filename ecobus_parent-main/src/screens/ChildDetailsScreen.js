import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Screen, Avatar, Loader, ErrorState, Icon, Button, AbsenceModal, useToast } from '../components';
import { ChildrenAPI, AbsencesAPI } from '../services/api';
import useAsync from '../hooks/useAsync';
import { colors, radius, spacing, typography, shadows } from '../theme';
import { formatTime as fmtTime } from '../utils/format';
import { formatDateRange } from '../utils/dates';
import { humanizeError } from '../utils/errors';

export default function ChildDetailsScreen({ route, navigation }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const childId = route?.params?.childId;
  const { data: child, loading, error, reload } = useAsync(
    () => (childId ? ChildrenAPI.get(childId) : Promise.resolve(null)),
    [childId],
  );

  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!childId) return;
    setHistoryLoading(true);
    try {
      const rows = await AbsencesAPI.history(childId, { limit: 50 });
      setHistory(Array.isArray(rows) ? rows : []);
    } catch { /* non-blocking */ }
    finally { setHistoryLoading(false); }
  }, [childId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const submitAbsence = useCallback(async (payload) => {
    if (!childId) return;
    setSubmitting(true);
    try {
      await AbsencesAPI.create(childId, payload);
      toast.show(t('absence.successBody'), { tone: 'success' });
      setAbsenceOpen(false);
      reload();
      loadHistory();
    } catch (err) {
      Alert.alert(t('absence.errorTitle'), humanizeError(err, t));
    } finally { setSubmitting(false); }
  }, [childId, toast, t, reload, loadHistory]);

  const confirmCancelAbsence = useCallback((absenceId) => {
    Alert.alert(
      t('absence.cancelTitle'), t('absence.cancelBody'),
      [
        { text: t('absence.keep'), style: 'cancel' },
        {
          text: t('absence.cancelConfirm'), style: 'destructive',
          onPress: async () => {
            setCancellingId(absenceId);
            try {
              await AbsencesAPI.cancel(absenceId);
              reload(); loadHistory();
            } catch (err) {
              Alert.alert(t('absence.errorTitle'), humanizeError(err, t));
            } finally { setCancellingId(null); }
          },
        },
      ],
    );
  }, [t, reload, loadHistory]);

  if (loading) return <Loader label={t('child.loading')} />;
  if (error)   return <ErrorState message={error.message} onRetry={reload} />;
  if (!child)  return <ErrorState message={t('child.notFound')} onRetry={() => navigation.goBack()} />;

  const callDriver = () => {
    if (child.driverPhone) Linking.openURL(`tel:${child.driverPhone}`);
  };

  const childName = child.name || [child.first_name, child.last_name].filter(Boolean).join(' ');
  const absences  = Array.isArray(child.absences) ? child.absences : [];

  return (
    <Screen scroll padded={false} background={colors.background} statusBarStyle="light-content">

      {/* ── Teal hero header ── */}
      <View style={s.hero}>
        <View style={s.heroGlowTR} pointerEvents="none" />
        <View style={s.heroGlowBL} pointerEvents="none" />
        <SafeAreaView edges={['top']} style={s.heroSafe}>
          <View style={s.heroTopRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={s.backBtn} hitSlop={12} accessibilityRole="button"
            >
              <Icon name="chevronRight" size={18} tint={colors.textInverse} style={{ transform: [{ rotate: '180deg' }] }} />
            </Pressable>
            <Text style={s.heroScreenTitle} numberOfLines={1}>{t('child.title', { defaultValue: 'Child' })}</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={s.heroContent}>
            <View style={s.avatarRing}>
              <Avatar uri={child.photoUrl} name={childName} size={72} />
            </View>
            <Text style={s.heroName}>{childName}</Text>
            <Text style={s.heroGrade}>{t('home.grade', { grade: child.grade ?? '—' })}</Text>

            <View style={s.pillRow}>
              {(child.school || child.schoolName) ? (
                <View style={s.pill}>
                  <Icon name="tabHome" size={11} tint={colors.primaryAccent} />
                  <Text style={s.pillText} numberOfLines={1}>{child.school ?? child.schoolName}</Text>
                </View>
              ) : null}
              {child.routeName ? (
                <View style={s.pill}>
                  <Icon name="bus" size={11} tint={colors.primaryAccent} />
                  <Text style={s.pillText} numberOfLines={1}>{child.routeName}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* ── White panel ── */}
      <View style={s.panel}>

        {/* Stop row */}
        <View style={s.stopRow}>
          <StopCard
            label={t('child.pickupStop')} value={child.pickupStop ?? '—'}
            time={fmtTime(child.pickupTime)} icon="statusOnBus" accentColor={colors.success}
          />
          <View style={{ width: spacing.sm }} />
          <StopCard
            label={t('child.dropoffStop')} value={child.dropoffStop ?? '—'}
            time={fmtTime(child.dropoffTime)} icon="statusDropped" accentColor={colors.primary}
          />
        </View>

        {/* Driver card */}
        <View style={s.driverCard}>
          <View style={s.driverIconWrap}>
            <Icon name="tabProfile" size={22} tint={colors.primary} />
          </View>
          <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
            <Text style={s.driverLabel}>{t('tracking.driver')}</Text>
            <Text style={s.driverName}>{child.driverName ?? '—'}</Text>
          </View>
          <Pressable
            onPress={callDriver}
            style={[s.callBtn, !child.driverPhone && s.callBtnOff]}
            disabled={!child.driverPhone}
            accessibilityRole="button"
          >
            <Icon name="phone" size={20} tint={child.driverPhone ? colors.textInverse : colors.textDisabled} />
          </Pressable>
        </View>

        {/* Track bus button */}
        {child.busId ? (
          <Button
            title={t('child.viewOnMap')}
            onPress={() => navigation.navigate('Tracking', { busId: child.busId, tripId: child.tripId ?? null, child })}
          />
        ) : null}

        {/* Active absences */}
        {absences.length > 0 ? (
          <View style={s.absenceList}>
            <View style={s.absenceListHeader}>
              <Icon name="alert" size={14} tint={colors.danger} />
              <Text style={s.absenceSectionTitle}>{t('absence.title')}</Text>
            </View>
            {absences.map((a) => (
              <View key={a.id} style={s.absenceCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.absenceRange}>{formatDateRange(a.start_date, a.end_date, i18n.language)}</Text>
                  <Text style={s.absenceReason}>{t(`absence.reason.${a.reason}`)}{a.note ? ` · ${a.note}` : ''}</Text>
                </View>
                <Pressable
                  onPress={() => confirmCancelAbsence(a.id)}
                  hitSlop={8} disabled={cancellingId === a.id}
                  style={s.absenceCancelBtn} accessibilityRole="button"
                >
                  <Text style={s.absenceCancelText}>
                    {cancellingId === a.id ? '…' : t('absence.cancelConfirm')}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <Button
          title={t('absence.openCta')}
          onPress={() => setAbsenceOpen(true)}
          variant="secondary"
          iconLeft={<Icon name="statusDropped" size={18} tint={colors.primary} />}
        />

        {/* Absence history */}
        <View style={s.historySection}>
          <Text style={s.sectionLabel}>{t('absence.historyTitle')}</Text>
          {historyLoading && history.length === 0 ? (
            <View style={s.historyEmptyWrap}>
              <Text style={s.historyEmpty}>{t('common.loading')}</Text>
            </View>
          ) : history.length === 0 ? (
            <View style={s.historyEmptyWrap}>
              <Icon name="statusOnBus" size={28} tint={colors.textDisabled} />
              <Text style={s.historyEmpty}>{t('absence.historyEmpty')}</Text>
            </View>
          ) : (
            history.map((a) => {
              const cancelled = !!a.cancelled_at;
              return (
                <View key={a.id} style={s.historyCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.historyRange}>{formatDateRange(a.start_date, a.end_date, i18n.language)}</Text>
                    <Text style={s.historyReason}>{t(`absence.reason.${a.reason}`)}{a.note ? ` · ${a.note}` : ''}</Text>
                  </View>
                  <View style={[s.historyBadge, cancelled ? s.badgeCancelled : s.badgePast]}>
                    <Text style={[s.historyBadgeText, cancelled ? s.badgeTextCancelled : s.badgeTextPast]}>
                      {cancelled ? t('absence.statusCancelled') : t('absence.statusPast')}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

      </View>

      <AbsenceModal
        visible={absenceOpen}
        childName={childName}
        submitting={submitting}
        onCancel={() => (submitting ? null : setAbsenceOpen(false))}
        onConfirm={submitAbsence}
      />
    </Screen>
  );
}

function StopCard({ label, value, time, icon, accentColor }) {
  return (
    <View style={[s.stopCard, { borderTopColor: accentColor }]}>
      <View style={[s.stopIconWrap, { backgroundColor: accentColor + '18' }]}>
        <Icon name={icon} size={16} tint={accentColor} />
      </View>
      <Text style={[s.stopLabel, { color: accentColor }]}>{label}</Text>
      <Text style={s.stopValue} numberOfLines={1}>{value}</Text>
      {time ? <Text style={s.stopTime}>{time}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  /* Hero */
  hero: {
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  heroGlowTR: {
    position: 'absolute', top: -80, right: -80,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: colors.surface, opacity: 0.08,
  },
  heroGlowBL: {
    position: 'absolute', bottom: 0, left: -50,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: colors.surface, opacity: 0.05,
  },
  heroSafe: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  heroTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm, marginBottom: spacing.md,
  },
  heroScreenTitle: {
    fontSize: 17, fontWeight: '800', color: colors.textInverse,
    flex: 1, textAlign: 'center',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.onBrandHigh,
    borderWidth: 1, borderColor: colors.onBrandMid,
    alignItems: 'center', justifyContent: 'center',
  },
  heroContent: { alignItems: 'center' },
  avatarRing: {
    padding: 3, borderRadius: 44,
    borderWidth: 3, borderColor: colors.onBrandMid,
    marginBottom: spacing.sm,
  },
  heroName: {
    fontSize: 22, fontWeight: '800', color: colors.textInverse,
    letterSpacing: -0.3, textAlign: 'center',
  },
  heroGrade: {
    fontSize: 13, color: colors.onBrandMuted, marginTop: 3, textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row', gap: spacing.xs,
    marginTop: spacing.sm, flexWrap: 'wrap', justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.onBrandHigh,
    borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  pillText: { fontSize: 12, color: colors.primaryAccent, fontWeight: '600' },

  /* Panel */
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -24,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },

  /* Stop row */
  stopRow: { flexDirection: 'row', alignItems: 'stretch' },
  stopCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    borderTopWidth: 3,
  },
  stopIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  stopLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  stopValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  stopTime:  { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  /* Driver card */
  driverCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    ...shadows.card,
  },
  driverIconWrap: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  driverLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  driverName:  { fontSize: 15, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
  callBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.success,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.raised,
  },
  callBtnOff: { backgroundColor: colors.surfaceAlt, ...shadows.none },

  /* Absences */
  absenceList: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm,
  },
  absenceListHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  absenceSectionTitle: {
    fontSize: 12, color: colors.danger,
    fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6,
  },
  absenceCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm,
  },
  absenceRange:  { fontSize: 13, color: colors.textPrimary, fontWeight: '700' },
  absenceReason: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  absenceCancelBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  absenceCancelText: { fontSize: 11, color: colors.textPrimary, fontWeight: '700' },

  /* History */
  historySection: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12, color: colors.textMuted,
    fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6,
  },
  historyEmptyWrap: { alignItems: 'center', paddingVertical: spacing.sm, gap: 6 },
  historyEmpty: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  historyCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm,
  },
  historyRange:  { fontSize: 13, color: colors.textPrimary, fontWeight: '700' },
  historyReason: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  historyBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.pill, borderWidth: 1,
  },
  badgePast:          { backgroundColor: colors.surface,     borderColor: colors.border },
  badgeCancelled:     { backgroundColor: colors.dangerLight, borderColor: colors.dangerLight },
  historyBadgeText:   { fontSize: 11, fontWeight: '800' },
  badgeTextPast:      { color: colors.textSecondary },
  badgeTextCancelled: { color: colors.danger },
});
