import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Card from './Card';
import Avatar from './Avatar';
import Badge from './Badge';
import Icon from './Icon';
import { colors, spacing, typography } from '../theme';

// Status meta is keyed by backend value; the human label is resolved via i18n
// (`home.status.*`) at render time so it follows the active language.
const STATUS = {
  on_bus:      { tone: 'success', key: 'home.status.onTheWay',    icon: 'statusOnBus',      tint: colors.secondary },
  waiting:     { tone: 'warning', key: 'home.status.waiting',     icon: 'statusWaiting',    tint: colors.warningDark },
  not_boarded: { tone: 'danger',  key: 'home.status.notBoarded',  icon: 'statusNotBoarded', tint: colors.danger },
  dropped:     { tone: 'info',    key: 'home.status.droppedOff',  icon: 'statusDropped',    tint: colors.primary },
};

function ChildCardImpl({ child }) {
  const { t } = useTranslation();
  const status = STATUS[child.status] ?? STATUS.not_boarded;
  return (
    <Card>
      <View style={styles.row}>
        <Avatar uri={child.photoUrl} name={child.name} size={56} />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>{child.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {child.school} · {child.busNumber}
          </Text>
        </View>
        <Badge
          label={t(status.key)}
          tone={status.tone}
          icon={<Icon name={status.icon} size={14} tint={status.tint} />}
        />
      </View>
    </Card>
  );
}

const ChildCard = React.memo(ChildCardImpl, (a, b) => (
  a.child?.id === b.child?.id &&
  a.child?.status === b.child?.status &&
  a.child?.name === b.child?.name &&
  a.child?.photoUrl === b.child?.photoUrl &&
  a.child?.busNumber === b.child?.busNumber
));
export default ChildCard;

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, marginHorizontal: spacing.sm },
  name: { ...typography.subtitleSm, color: colors.textPrimary, fontWeight: '700' },
  meta: { ...typography.bodySm,    color: colors.textSecondary, marginTop: 2 },
});