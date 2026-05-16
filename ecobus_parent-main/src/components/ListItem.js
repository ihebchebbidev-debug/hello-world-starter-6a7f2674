import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography, layout } from '../theme';

/**
 * ListItem — tappable row with optional leading/trailing slots.
 */
export default function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  disabled,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      android_ripple={{ color: colors.surfaceAlt }}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress ? { backgroundColor: colors.surfaceAlt } : null,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {leading ? <View style={styles.lead}>{leading}</View> : null}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.sub} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.trail}>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minTouch + 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lead: { marginEnd: spacing.sm },
  body: { flex: 1 },
  trail: { marginStart: spacing.sm },
  title: { ...typography.body, color: colors.textPrimary, fontWeight: '500' },
  sub: { ...typography.bodySm, color: colors.textSecondary, marginTop: 2 },
});