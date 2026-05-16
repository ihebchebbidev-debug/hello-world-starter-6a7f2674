import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader } from '../components';
import { colors, spacing, typography } from '../theme';

/**
 * In-app Privacy Policy. Apple requires the policy to be reachable
 * from inside the app, not only from the store listing.
 *
 * Mirror the canonical version at https://ecobus.app/privacy.
 */
export default function PrivacyPolicyScreen({ navigation }) {
  const { t } = useTranslation();
  return (
    <Screen scroll padded={false}>
      <ScreenHeader title={t('privacy.title')} onBack={() => navigation.goBack()} />

      <Text style={s.updated}>{t('privacy.lastUpdated')}</Text>

      <Section title={t('privacy.collect.title')}    body={t('privacy.collect.body')} />
      <Section title={t('privacy.noCollect.title')}  body={t('privacy.noCollect.body')} />
      <Section title={t('privacy.use.title')}        body={t('privacy.use.body')} />
      <Section title={t('privacy.sharing.title')}    body={t('privacy.sharing.body')} />
      <Section title={t('privacy.rights.title')}     body={t('privacy.rights.body')} />
      <Section title={t('privacy.retention.title')}  body={t('privacy.retention.body')} />
      <Section title={t('privacy.children.title')}   body={t('privacy.children.body')} />
      <Section title={t('privacy.contact.title')}    body={t('privacy.contact.body')} />
    </Screen>
  );
}

function Section({ title, body }) {
  return (
    <>
      <Text style={s.h2}>{title}</Text>
      <Text style={s.body}>{body}</Text>
    </>
  );
}

const s = StyleSheet.create({
  updated: { ...typography.caption, color: colors.textSecondary, marginHorizontal: spacing.md, marginBottom: spacing.md },
  h2:      { ...typography.subtitleSm, color: colors.textPrimary, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.xs, marginHorizontal: spacing.md },
  body:    { ...typography.body, color: colors.textSecondary, lineHeight: 22, marginHorizontal: spacing.md },
});
