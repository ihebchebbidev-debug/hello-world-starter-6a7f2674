import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader } from '../components';
import { colors, spacing, typography } from '../theme';

/**
 * Terms of Service — must be reachable in-app for store compliance.
 */
export default function TermsScreen({ navigation }) {
  const { t } = useTranslation();
  const sections = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];

  return (
    <Screen scroll padded={false}>
      <ScreenHeader title={t('terms.title')} onBack={() => navigation.goBack()} />

      <Text style={s.updated}>{t('terms.lastUpdated')}</Text>

      {sections.map((key) => (
        <React.Fragment key={key}>
          <Text style={s.h2}>{t(`terms.${key}.h`)}</Text>
          <Text style={s.body}>{t(`terms.${key}.p`)}</Text>
        </React.Fragment>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  updated: { ...typography.caption, color: colors.textSecondary, marginHorizontal: spacing.md, marginBottom: spacing.md },
  h2:      { ...typography.subtitleSm, color: colors.textPrimary, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.xs, marginHorizontal: spacing.md },
  body:    { ...typography.body, color: colors.textSecondary, lineHeight: 22, marginHorizontal: spacing.md },
});
