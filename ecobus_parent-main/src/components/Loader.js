import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography } from '../theme';

export default function Loader({ label, size = 'large' }) {
  const { t } = useTranslation();
  // Default the label to the localized "Loading…" rather than hard-coding it,
  // so every loading state respects the active language.
  const text = label === undefined ? t('common.loading') : label;
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size={size} color={colors.primary} />
      {text ? <Text style={styles.label}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  label: { ...typography.bodySm, color: colors.textSecondary, marginTop: spacing.sm },
});
