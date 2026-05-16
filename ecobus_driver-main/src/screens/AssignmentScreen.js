import React, { useState, useCallback } from 'react';
import {
  Alert,
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
import { Screen, Card, Button, Badge, Loader, EmptyState, useToast } from '../components';
import { colors, spacing, typography, radius } from '../theme';
import useAsync from '../hooks/useAsync';
import { MeAPI, AssignmentAPI, RoutesAPI } from '../services/api';
import { humanizeError } from '../utils/errors';

const STATUS_CONFIG = {
  not_started: { tone: 'neutral',  label: 'assignment.statusNotStarted', icon: 'clock-outline' },
  in_progress: { tone: 'success',  label: 'assignment.statusInProgress', icon: 'play-circle' },
  completed:   { tone: 'info',     label: 'assignment.statusCompleted',  icon: 'check-circle' },
  no_assignment: { tone: 'warning', label: 'assignment.noAssignment',    icon: 'calendar-remove' },
};

export default function AssignmentScreen({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [serviceStatus, setServiceStatus] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const toast = useToast();

  const { data, loading, refreshing, error, reload } = useAsync(
    async () => {
      const profile = await MeAPI.profile();
      let stops = profile.assignment?.stops || [];
      if ((!stops || stops.length === 0) && profile.assignment?.routeId) {
        stops = await RoutesAPI.stops(profile.assignment.routeId).catch(() => []);
      }
      return { ...profile, stops };
    },
    [],
  );
  const assignment = data?.assignment;
  const driver = data?.driver;
  const bus = data?.bus;
  const stops = data?.stops || [];

  const status = serviceStatus ?? assignment?.status ?? 'not_started';
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;

  const handleStartService = useCallback(() => {
    Alert.alert(
      t('assignment.startService'),
      t('assignment.serviceStarted') + '. ' + t('common.confirm') + '?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('assignment.startService'),
          onPress: async () => {
            setActionLoading(true);
            try {
              await AssignmentAPI.startService();
              setServiceStatus('in_progress');
              toast.show(t('assignment.serviceStarted'), { tone: 'success' });
            } catch (err) {
              const reason = humanizeError(err, t);
              toast.show(`${t('errors.tripStartFailed')} : ${reason}`, { tone: 'danger' });
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [t]);

  const handleEndService = useCallback(() => {
    Alert.alert(
      t('assignment.confirmEnd'),
      t('assignment.confirmEndBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('assignment.endService'),
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await AssignmentAPI.endService();
              setServiceStatus('completed');
              toast.show(t('assignment.serviceEnded'), { tone: 'success' });
            } catch (err) {
              const reason = humanizeError(err, t);
              toast.show(`${t('errors.tripEndFailed')} : ${reason}`, { tone: 'danger' });
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [t]);

  if (loading) return <Screen><Loader /></Screen>;
  if (error) return <Screen><EmptyState icon="alert" title={t('errors.loadFailed')} actionLabel={t('common.tryAgain')} onAction={reload} /></Screen>;

  const hasAssignment = assignment && assignment.status !== 'no_assignment';

  return (
    <Screen padded={false} edges={['top']} scroll={false}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{t('assignment.title')}</Text>
            <Text style={s.driverName}>{driver?.name || '—'}</Text>
          </View>
          <Badge
            label={t(cfg.label)}
            tone={cfg.tone}
            icon={<MaterialCommunityIcons name={cfg.icon} size={12} color={TONES_COLOR[cfg.tone]} />}
          />
        </View>

        <View style={s.content}>
          {!hasAssignment ? (
            <Card style={s.noAssignmentCard}>
              <MaterialCommunityIcons name="calendar-remove" size={48} color={colors.textMuted} style={s.noAssignmentIcon} />
              <Text style={s.noAssignmentTitle}>{t('assignment.noAssignment')}</Text>
              <Text style={s.noAssignmentBody}>{t('assignment.noAssignmentBody')}</Text>
            </Card>
          ) : (
            <>
              {/* Route info card */}
              <Card style={s.card}>
                <Text style={s.cardSectionTitle}>{t('assignment.routeLabel')}</Text>
                <InfoRow icon="routes" label={t('assignment.routeLabel')} value={assignment.routeName} />
                <InfoRow icon="clock-outline" label={t('assignment.hoursLabel')} value={`${assignment.workStart} – ${assignment.workEnd}`} />
                <InfoRow icon="account-group" label={t('assignment.childrenLabel')} value={`${assignment.childrenCount}`} accent />
              </Card>

              {/* Bus info card */}
              <Card style={s.card}>
                <Text style={s.cardSectionTitle}>{t('assignment.busLabel')}</Text>
                <InfoRow icon="bus" label={t('assignment.busLabel')} value={`${bus?.name || '—'} · ${bus?.plate || '—'}`} />
                <InfoRow icon="car-seat" label={t('assignment.capacity')} value={`${bus?.capacity ?? 0} ${t('profile.seats')}`} />
              </Card>

              {/* Stops summary */}
              <Card style={s.card}>
                <Text style={s.cardSectionTitle}>{t('assignment.stops')}</Text>
                {stops.map((stop, idx) => (
                  <Pressable
                    key={stop.id}
                    onPress={() => navigation?.navigate?.('Main', { screen: 'Boarding', params: { stopId: stop.id } })}
                    android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                    accessibilityRole="button"
                    accessibilityLabel={stop.shortName}
                    style={({ pressed }) => [s.stopRow, pressed && { opacity: 0.85 }]}
                  >
                    <View style={[s.stopDot, stop.isSchool && s.stopDotSchool]} />
                    {idx < stops.length - 1 && <View style={s.stopLine} />}
                    <View style={s.stopInfo}>
                      <Text style={s.stopName} numberOfLines={1}>{stop.shortName}</Text>
                      <Text style={s.stopTime}>{stop.scheduledTime}</Text>
                    </View>
                  </Pressable>
                ))}
              </Card>

              {/* SOS button */}
              <View style={s.sosWrap}>
                <Button
                  title={`🆘  ${t('sos.title')}`}
                  variant="danger"
                  size="sm"
                  fullWidth={false}
                  onPress={() => navigation?.navigate?.('Sos')}
                  style={s.sosBtn}
                />
              </View>

              {/* Action button */}
              <View style={s.actionWrap}>
                {status === 'not_started' && (
                  <Button
                    title={t('assignment.startService')}
                    onPress={handleStartService}
                    loading={actionLoading}
                    size="lg"
                    iconLeft={<MaterialCommunityIcons name="play-circle" size={20} color="#fff" />}
                  />
                )}
                {status === 'in_progress' && (
                  <Button
                    title={t('assignment.endService')}
                    onPress={handleEndService}
                    loading={actionLoading}
                    variant="danger"
                    size="lg"
                    iconLeft={<MaterialCommunityIcons name="stop-circle" size={20} color="#fff" />}
                  />
                )}
                {status === 'completed' && (
                  <View style={s.completedBanner}>
                    <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
                    <Text style={s.completedText}>{t('assignment.serviceEnded')}</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ icon, label, value, accent }) {
  return (
    <View style={s.infoRow}>
      <MaterialCommunityIcons name={icon} size={18} color={accent ? colors.primary : colors.textMuted} style={s.infoIcon} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, accent && { color: colors.primary, fontWeight: '700' }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const TONES_COLOR = { success: colors.successDark, neutral: colors.textPrimary, info: colors.primaryDark, warning: colors.warningDark };

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  greeting: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  driverName: { ...typography.titleSm, color: colors.textPrimary, marginTop: 2 },
  content: { paddingHorizontal: spacing.md, gap: spacing.sm },

  noAssignmentCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  noAssignmentIcon: { marginBottom: spacing.md, opacity: 0.5 },
  noAssignmentTitle: { ...typography.subtitle, color: colors.textPrimary, textAlign: 'center' },
  noAssignmentBody: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },

  card: { marginBottom: 0 },
  cardSectionTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: colors.textMuted,
    textTransform: 'uppercase', marginBottom: spacing.sm,
  },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  infoIcon: { marginEnd: spacing.sm },
  infoLabel: { ...typography.bodySm, color: colors.textSecondary, flex: 1 },
  infoValue: { ...typography.bodySmMd, color: colors.textPrimary, maxWidth: '55%', textAlign: 'right' },

  stopRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4, position: 'relative' },
  stopDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.primary, marginTop: 4, marginEnd: spacing.sm,
  },
  stopDotSchool: { backgroundColor: colors.success, width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  stopLine: {
    position: 'absolute', left: 4.5, top: 18,
    width: 1, height: 24, backgroundColor: colors.border,
  },
  stopInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stopName: { ...typography.bodySmMd, color: colors.textPrimary, flex: 1 },
  stopTime: { ...typography.caption, color: colors.textMuted },

  sosWrap: { alignItems: 'flex-end' },
  sosBtn: { borderRadius: radius.pill, paddingHorizontal: spacing.md },

  actionWrap: { marginTop: spacing.xs, marginBottom: spacing.md },
  completedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, padding: spacing.md,
    backgroundColor: colors.successLight, borderRadius: radius.lg,
  },
  completedText: { ...typography.bodyMd, color: colors.successDark, fontWeight: '700' },
});
