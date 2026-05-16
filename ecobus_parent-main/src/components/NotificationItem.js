import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { colors, radius, spacing, typography } from '../theme';

const formatTime = (ts) => {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60)    return 'Just now';
    if (diffSec < 3600)  return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  } catch { return ''; }
};

const TYPE_META = {
  boarded: { icon: 'statusOnBus',   bg: colors.successLight,  tint: colors.success     },
  dropped: { icon: 'statusDropped', bg: colors.primaryLight,  tint: colors.primary     },
  delay:   { icon: 'statusWaiting', bg: colors.warningLight,  tint: colors.warning     },
  alert:   { icon: 'alert',         bg: colors.dangerLight,   tint: colors.danger      },
  sos:     { icon: 'sos',           bg: colors.dangerLight,   tint: colors.danger      },
  payment: { icon: 'alert',         bg: colors.infoLight,     tint: colors.info        },
  info:    { icon: 'bus',           bg: colors.primaryLight,  tint: colors.primary     },
  system:  { icon: 'alert',         bg: colors.surfaceAlt,    tint: colors.textMuted   },
};
const FALLBACK = TYPE_META.info;

function NotificationItem({ item, onPress }) {
  const meta  = TYPE_META[item.type] ?? FALLBACK;
  const unread = !item.read && !item.readAt;

  const Container = onPress ? Pressable : View;
  const containerProps = onPress
    ? {
        onPress: () => onPress(item),
        android_ripple: { color: 'rgba(0,0,0,0.06)' },
        accessibilityRole: 'button',
        accessibilityLabel: item.title,
        style: ({ pressed }) => [s.row, unread && s.rowUnread, pressed && s.rowPressed],
      }
    : { style: [s.row, unread && s.rowUnread] };

  return (
    <Container {...containerProps}>
      <View style={[s.iconWrap, { backgroundColor: meta.bg }]}>
        <Icon name={meta.icon} size={20} tint={meta.tint} />
      </View>

      <View style={s.body}>
        <View style={s.titleRow}>
          <Text style={[s.title, unread && s.titleUnread, { flex: 1 }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={s.time}>{formatTime(item.timestamp ?? item.createdAt ?? item.created_at)}</Text>
        </View>
        <Text style={s.message} numberOfLines={2}>{item.message ?? item.body}</Text>
      </View>

      {unread ? <View style={s.unreadDot} /> : null}
    </Container>
  );
}

export default React.memo(NotificationItem, (a, b) =>
  a.item.id === b.item.id &&
  a.item.read === b.item.read &&
  a.item.readAt === b.item.readAt,
);

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
  },
  rowUnread: { backgroundColor: colors.primarySoft },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  iconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  body:    { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  title:   { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1, marginRight: 8 },
  titleUnread: { fontWeight: '700', color: colors.textPrimary },
  message: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  time:    { fontSize: 11, color: colors.textMuted, fontWeight: '500', flexShrink: 0 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm, flexShrink: 0,
  },
});
