import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { colors, spacing, typography } from '../theme';

/**
 * Shared screen header with optional back button and trailing slot.
 * Pass inverted=true when used on a dark background (SOS, dark overlays).
 * The chevron flips automatically under RTL (Arabic).
 */
export default function ScreenHeader({ title, onBack, trailing, inverted = false }) {
  const { t, i18n } = useTranslation();
  const isRTL = (typeof i18n.dir === 'function' ? i18n.dir() : i18n.dir) === 'rtl';
  const chevronTransform = isRTL ? [] : [{ rotate: '180deg' }];

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={[styles.back, inverted && styles.backInverted]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Icon
            name="chevronRight"
            size={18}
            tint={inverted ? colors.textInverse : colors.textPrimary}
            style={{ transform: chevronTransform }}
          />
        </Pressable>
      ) : <View style={styles.spacer} />}

      <Text style={[styles.title, inverted && styles.titleInverted]} numberOfLines={1}>{title}</Text>

      <View style={styles.spacer}>{trailing ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  back: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  backInverted: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  spacer: { width: 36, alignItems: 'flex-end' },
  title: { ...typography.subtitle, color: colors.textPrimary, fontWeight: '700', flex: 1, textAlign: 'center' },
  titleInverted: { color: colors.textInverse },
});
