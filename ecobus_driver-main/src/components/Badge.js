import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export default function Badge({ label, tone = 'neutral', icon }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon ? <View style={{ marginEnd: 4 }}>{icon}</View> : null}
      <Text style={[styles.text, { color: t.fg }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{label}</Text>
    </View>
  );
}

const TONES = {
  success: { bg: colors.successLight, fg: colors.successDark },
  warning: { bg: colors.warningLight, fg: colors.warningDark },
  danger:  { bg: colors.dangerLight,  fg: colors.dangerDark },
  info:    { bg: colors.infoLight,    fg: colors.primaryDark },
  neutral: { bg: colors.neutralLight, fg: colors.textPrimary },
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  text: { ...typography.caption, fontWeight: '500' },
});
