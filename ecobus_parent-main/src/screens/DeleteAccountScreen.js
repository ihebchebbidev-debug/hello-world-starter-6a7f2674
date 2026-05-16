import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, Icon, Button, Input, useToast, ScreenHeader } from '../components';
import { AuthAPI } from '../services/api';
import { colors, radius, spacing, typography } from '../theme';

const REQUIRED_PHRASE = 'DELETE';

/**
 * In-app account deletion — REQUIRED by Apple guideline 5.1.1(v).
 * Deletion is processed by `DELETE /auth/me` on the backend.
 */
export default function DeleteAccountScreen({ navigation }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (confirm.trim().toUpperCase() !== REQUIRED_PHRASE) {
      Alert.alert(t('delete.confirmTitle'), t('delete.confirmBody', { phrase: REQUIRED_PHRASE }));
      return;
    }
    Alert.alert(
      t('delete.askAgain'),
      t('delete.askAgainBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('delete.deleteCta'),
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await AuthAPI.deleteMe();
              toast.show(t('delete.deleted'), { tone: 'success' });
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            } catch (err) {
              toast.show(err?.message ?? t('delete.failed'), { tone: 'danger' });
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen scroll padded={false}>
      <ScreenHeader title={t('delete.title')} onBack={() => navigation.goBack()} />

      <View style={s.body}>
        <View style={s.warningBox}>
          <Text style={s.warningTitle}>{t('delete.warningTitle')}</Text>
          <Text style={s.warningBody}>{t('delete.warningBody')}</Text>
        </View>

        <Text style={s.label}>
          {t('delete.typeToConfirm', { phrase: REQUIRED_PHRASE })}
        </Text>
        <Input
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={REQUIRED_PHRASE}
        />

        <View style={{ height: spacing.md }} />
        <Button title={t('delete.deleteCta')} onPress={submit} variant="danger" loading={submitting} />
        <View style={{ height: spacing.xs }} />
        <Button title={t('common.cancel')} onPress={() => navigation.goBack()} variant="ghost" />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: spacing.md },
  warningBox: {
    backgroundColor: colors.dangerLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warningTitle: { ...typography.subtitleSm, color: colors.danger, fontWeight: '700', marginBottom: spacing.xs },
  warningBody:  { ...typography.bodySm, color: colors.dangerDark, lineHeight: 20 },

  label:    { ...typography.bodySm, color: colors.textSecondary, marginBottom: spacing.xs },
});
