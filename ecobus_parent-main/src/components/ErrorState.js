import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, typography } from '../theme';
import Button from './Button';
import Icon from './Icon';

export default function ErrorState({ title, message, onRetry }) {
  const { t } = useTranslation();
  const heading = title ?? t('common.somethingWrong');
  return (
    <View style={styles.wrap}>
      <Icon name="alert" size={56} tint={colors.danger} style={styles.icon} />
      <Text style={styles.title}>{heading}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onRetry ? (
        <View style={styles.action}>
          <Button title={t('common.tryAgain')} onPress={onRetry} variant="primary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon:    { marginBottom: spacing.sm },
  title:   { ...typography.subtitle, color: colors.textPrimary, textAlign: 'center' },
  message: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  action:  { marginTop: spacing.md, alignSelf: 'stretch' },
});
