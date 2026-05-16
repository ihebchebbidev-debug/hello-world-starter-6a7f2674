import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import { colors, radius, spacing } from '../theme';

const LANGS = [
  { code: 'fr', label: 'FR', nativeName: 'Français' },
  { code: 'en', label: 'EN', nativeName: 'English' },
  { code: 'ar', label: 'AR', nativeName: 'العربية' },
];

export default function LanguageSwitcher({ variant = 'light', style }) {
  const { i18n } = useTranslation();
  const current = i18n.language?.slice(0, 2) ?? 'fr';

  const onSelect = async (code) => {
    if (code === current) return;
    await changeLanguage(code);
  };

  const isDark = variant === 'dark';

  return (
    <View style={[s.row, style]}>
      {LANGS.map((lang, idx) => {
        const active = current === lang.code;
        return (
          <Pressable
            key={lang.code}
            onPress={() => onSelect(lang.code)}
            style={[
              s.pill,
              idx === 0 && s.pillFirst,
              idx === LANGS.length - 1 && s.pillLast,
              active ? s.pillActive : isDark ? s.pillIdleDark : s.pillIdleLight,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={lang.nativeName}
            hitSlop={8}
          >
            <Text
              style={[
                s.pillText,
                active ? s.pillTextActive : isDark ? s.pillTextDark : s.pillTextLight,
              ]}
              allowFontScaling={false}
            >
              {lang.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignSelf: 'center', borderRadius: radius.pill, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 7, minWidth: 44, alignItems: 'center' },
  pillFirst: { borderTopStartRadius: radius.pill, borderBottomStartRadius: radius.pill },
  pillLast:  { borderTopEndRadius: radius.pill, borderBottomEndRadius: radius.pill },
  pillActive:    { backgroundColor: colors.primary },
  pillIdleLight: { backgroundColor: '#F8FAFC' },
  pillIdleDark:  { backgroundColor: 'rgba(255,255,255,0.07)' },
  pillText:       { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  pillTextActive: { color: '#fff' },
  pillTextLight:  { color: colors.textSecondary },
  pillTextDark:   { color: 'rgba(255,255,255,0.45)' },
});
