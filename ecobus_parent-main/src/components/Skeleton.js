import React from 'react';
import { Animated, StyleSheet, View, Easing } from 'react-native';
import { colors, radius, spacing } from '../theme';

const Block = ({ style }) => {
  const opacity = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, style, { opacity }]} />;
};

function NotificationRow() {
  return (
    <View style={styles.notifRow}>
      <Block style={styles.notifAvatar} />
      <View style={styles.notifLines}>
        <Block style={styles.notifLine1} />
        <Block style={styles.notifLine2} />
      </View>
      <Block style={styles.notifDot} />
    </View>
  );
}

function TripCardSkeleton() {
  return (
    <View style={styles.tripCard}>
      <Block style={styles.tripAccent} />
      <View style={styles.tripBody}>
        <View style={styles.tripTop}>
          <Block style={styles.tripDate} />
          <Block style={styles.tripBadge} />
        </View>
        <Block style={styles.tripRoute} />
        <View style={styles.tripTimeRow}>
          <Block style={styles.tripTime} />
          <Block style={styles.tripTime} />
        </View>
      </View>
    </View>
  );
}

export default function Skeleton({ variant = 'card' }) {
  if (variant === 'notification') {
    return (
      <View style={{ gap: 0 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i}>
            <NotificationRow />
            {i < 3 ? <View style={styles.separator} /> : null}
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'trip') {
    return (
      <View style={{ gap: spacing.sm }}>
        {[0, 1, 2].map((i) => <TripCardSkeleton key={i} />)}
      </View>
    );
  }

  if (variant === 'list') {
    return (
      <View style={{ gap: spacing.sm }}>
        {[0, 1, 2].map((i) => <Block key={i} style={{ height: 72, borderRadius: radius.lg }} />)}
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Block style={{ height: 24, width: '60%' }} />
      <Block style={{ height: 16, width: '40%' }} />
      <Block style={{ height: 140, borderRadius: radius.xl, marginTop: spacing.sm }} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
  },

  /* Notification row */
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  notifAvatar: { width: 40, height: 40, borderRadius: 20 },
  notifLines:  { flex: 1, gap: 8 },
  notifLine1:  { height: 13, width: '75%', borderRadius: radius.sm },
  notifLine2:  { height: 11, width: '50%', borderRadius: radius.sm },
  notifDot:    { width: 8, height: 8, borderRadius: 4 },
  separator:   { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },

  /* Trip card */
  tripCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripAccent: { width: 4, borderRadius: 0 },
  tripBody:   { flex: 1, padding: spacing.md, gap: 8 },
  tripTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripDate:   { height: 13, width: 90, borderRadius: radius.sm },
  tripBadge:  { height: 22, width: 72, borderRadius: radius.pill },
  tripRoute:  { height: 15, width: '65%', borderRadius: radius.sm },
  tripTimeRow:{ flexDirection: 'row', gap: spacing.md },
  tripTime:   { height: 13, width: 70, borderRadius: radius.sm },
});
