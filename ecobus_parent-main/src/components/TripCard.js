import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from './Card';
import Icon from './Icon';
import { colors, spacing, typography, layout } from '../theme';

export default function TripCard({ trip }) {
  const { t } = useTranslation();
  if (!trip) return null;

  const callDriver = () => {
    if (trip.driverPhone) Linking.openURL(`tel:${trip.driverPhone}`);
  };

  return (
    <Card>
      <Text style={styles.heading}>{t('trips.todayTrip')}</Text>
      <View style={styles.row}>
        <Slot label={t('trips.pickup')}  value={trip.pickupTime} />
        <View style={styles.divider} />
        <Slot label={t('trips.dropoff')} value={trip.dropTime} />
      </View>

      <View style={styles.driver}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{t('tracking.driver')}</Text>
          <Text style={styles.driverName} numberOfLines={1}>
            {trip.driverName ?? '—'}
          </Text>
        </View>
        {trip.driverPhone ? (
          <Pressable
            onPress={callDriver}
            hitSlop={12}
            style={styles.callButton}
            accessibilityRole="button"
            accessibilityLabel={t('tracking.callDriver')}
          >
            <Icon name="phone" size={16} tint={colors.primaryDark} />
            <Text style={styles.callText}>{t('trips.callShort')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function Slot({ label, value }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading:    { ...typography.subtitleSm, color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.sm },
  row:        { flexDirection: 'row', alignItems: 'center' },
  divider:    { width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginHorizontal: spacing.md },
  label:      { ...typography.caption, color: colors.textSecondary },
  value:      { ...typography.subtitle, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
  driver: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverName: { ...typography.body, color: colors.textPrimary, fontWeight: '500', marginTop: 2 },
  callButton: {
    minHeight: layout.minTouch,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  callText:   { ...typography.button, color: colors.primaryDark },
});
