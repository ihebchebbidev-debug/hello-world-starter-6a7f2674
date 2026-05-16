import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, ScreenHeader } from '../components';
import { changeLanguage, SUPPORTED_LANGUAGES } from '../i18n';
import { colors, radius, shadows, spacing, typography } from '../theme';

const LANG_DATA = {
  fr: { flag: '🇫🇷', nativeName: 'Français',  hint: 'French'  },
  en: { flag: '🇬🇧', nativeName: 'English',   hint: 'Anglais' },
  ar: { flag: '🇸🇦', nativeName: 'العربية',   hint: 'Arabic', rtl: true },
};

const ACCENT = { fr: '#3BBFCC', en: colors.primary, ar: '#4ADE80' };

export default function LanguageScreen({ navigation }) {
  const { t, i18n } = useTranslation();
  const [current, setCurrent] = useState(i18n.language?.slice(0, 2) ?? 'fr');
  const [saving,  setSaving]  = useState(null);

  const select = async (code) => {
    if (code === current || saving) return;
    setSaving(code);
    setCurrent(code);
    await changeLanguage(code);
    setSaving(null);
  };

  return (
    <Screen padded={false} scroll>
      <ScreenHeader
        title={t('language.title')}
        onBack={() => navigation.goBack()}
      />

      <View style={s.cards}>
        {SUPPORTED_LANGUAGES.map((code) => {
          const lang    = LANG_DATA[code];
          const active  = current === code;
          const accent  = ACCENT[code];
          const isSaving = saving === code;
          if (!lang) return null;

          return (
            <Pressable
              key={code}
              onPress={() => select(code)}
              style={({ pressed }) => [
                s.card,
                active && { borderColor: accent, backgroundColor: accent + '0D' },
                pressed && !active && { backgroundColor: colors.surfaceAlt },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={lang.nativeName}
            >
              {/* Active side bar — flips to the correct edge with direction:rtl */}
              {active ? (
                <View style={[s.activeBar, { backgroundColor: accent }]} />
              ) : null}

              {/* Flag */}
              <View style={[
                s.flagWrap,
                active
                  ? { backgroundColor: accent + '18', borderColor: accent + '40' }
                  : { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}>
                <Text style={s.flag}>{lang.flag}</Text>
              </View>

              {/* Labels — native name always in its own script */}
              <View style={s.labelBlock}>
                <Text
                  style={[s.nativeName, active && { color: accent }]}
                  // Arabic text always renders RTL regardless of layout direction
                  writingDirection={lang.rtl ? 'rtl' : 'ltr'}
                >
                  {lang.nativeName}
                </Text>
                <Text style={s.hint}>{lang.hint}</Text>
              </View>

              {/* Check / spinner */}
              <View style={[
                s.checkWrap,
                active
                  ? { backgroundColor: accent, borderColor: accent }
                  : { backgroundColor: 'transparent', borderColor: colors.border },
              ]}>
                <Text style={s.checkText}>
                  {isSaving ? '…' : active ? '✓' : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  cards: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
    gap: spacing.sm,
    ...shadows.card,
  },

  // Positioned at `start` so it automatically appears on the left in LTR
  // and on the right in RTL (the direction: rtl wrapper flips left/right).
  activeBar: {
    position: 'absolute', start: 0, top: 0, bottom: 0,
    width: 4,
  },

  flagWrap: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  flag: { fontSize: 26 },

  labelBlock: { flex: 1 },
  nativeName: {
    ...typography.subtitle,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: 3 },

  checkWrap: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkText: { color: colors.textInverse, fontSize: 13, fontWeight: '700' },
});
