import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';
import Button from './Button';
import Icon from './Icon';

export default function EmptyState({ icon, title, message, actionLabel, onAction }) {
  return (
    <View style={styles.wrap}>
      {icon ? <Icon name={icon} size={56} tint={colors.textSecondary} style={styles.icon} /> : null}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button title={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon:    { marginBottom: spacing.sm, opacity: 0.85 },
  title:   { ...typography.subtitle, color: colors.textPrimary, textAlign: 'center' },
  message: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  action:  { marginTop: spacing.md, alignSelf: 'stretch' },
});