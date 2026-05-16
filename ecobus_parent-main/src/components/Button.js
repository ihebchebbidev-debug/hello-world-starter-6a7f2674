import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, typography, layout } from '../theme';

/**
 * Button — primary action component.
 *
 * Variants: primary | secondary | danger | ghost
 * Sizes:    md (default, 48h) | sm (40h) | lg (56h)
 *
 * Always meets the 44pt minimum touch target.
 * Press feedback: opacity (iOS) + ripple (Android via Pressable).
 */
export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  fullWidth = true,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}) {
  const isDisabled = disabled || loading;
  const v = VARIANTS[variant];
  const s = SIZES[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      android_ripple={{ color: v.ripple, borderless: false, foreground: true }}
      style={({ pressed }) => [
        styles.base,
        { height: s.height, paddingHorizontal: s.padX, borderRadius: radius.md },
        { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.borderWidth },
        fullWidth && { alignSelf: 'stretch' },
        pressed && Platform.OS === 'ios' ? { opacity: 0.85 } : null,
        isDisabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <View style={styles.row}>
          {iconLeft ? <View style={styles.iconL}>{iconLeft}</View> : null}
          <Text style={[typography.button, { color: v.text }]} numberOfLines={1}>
            {title}
          </Text>
          {iconRight ? <View style={styles.iconR}>{iconRight}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS = {
  primary: {
    bg: colors.primary,
    text: colors.textInverse,
    border: 'transparent',
    borderWidth: 0,
    ripple: colors.onBrandRipple,
  },
  secondary: {
    bg: colors.surface,
    text: colors.primary,
    border: colors.primary,
    borderWidth: 1,
    ripple: colors.primaryLight,
  },
  danger: {
    bg: colors.danger,
    text: colors.textInverse,
    border: 'transparent',
    borderWidth: 0,
    ripple: colors.onBrandRipple,
  },
  ghost: {
    bg: 'transparent',
    text: colors.primary,
    border: 'transparent',
    borderWidth: 0,
    ripple: colors.primaryLight,
  },
};

const SIZES = {
  sm: { height: layout.minTouch, padX: spacing.md },
  md: { height: 48, padX: spacing.md },
  lg: { height: 56, padX: spacing.lg },
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: layout.minTouch,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconL: { marginEnd: spacing.xs },
  iconR: { marginStart: spacing.xs },
  disabled: { opacity: 0.5 },
});