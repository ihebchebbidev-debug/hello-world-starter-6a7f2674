import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing, shadows } from '../theme';

export default function Card({ children, style, elevated = true, padded = true }) {
  return (
    <View
      style={[
        styles.card,
        padded && { padding: spacing.md },
        elevated ? shadows.card : { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
});
