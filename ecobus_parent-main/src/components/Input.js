import React, { forwardRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, spacing, typography, layout } from '../theme';

/**
 * Input — labeled text field with validation, autofill, and password toggle.
 * Forwards ref so screens can chain focus (Email → Password → submit).
 */
const Input = forwardRef(function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helper,
  secureTextEntry = false,
  keyboardType = 'default',
  autoComplete,
  textContentType,
  multiline = false,
  editable = true,
  maxLength,
  autoCapitalize,
  autoCorrect,
  iconLeft,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  testID,
}, ref) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry);
  const borderColor = !editable
    ? colors.border
    : error
      ? colors.danger
      : focused
        ? colors.primary
        : colors.border;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label} maxFontSizeMultiplier={1.4}>{label}</Text> : null}
      <View style={[
        styles.field,
        { borderColor, minHeight: multiline ? 96 : layout.minTouch + 4 },
        !editable && { backgroundColor: colors.surfaceAlt },
      ]}>
        {iconLeft ? <View style={styles.iconL}>{iconLeft}</View> : null}
        <TextInput
          ref={ref}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDisabled}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          textContentType={textContentType}
          multiline={multiline}
          editable={editable}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={colors.primary}
          underlineColorAndroid="transparent"
          clearButtonMode={Platform.OS === 'ios' && !secureTextEntry && !multiline ? 'while-editing' : 'never'}
          autoCorrect={autoCorrect ?? !secureTextEntry}
          autoCapitalize={autoCapitalize ?? (secureTextEntry || keyboardType === 'email-address' ? 'none' : 'sentences')}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit ?? !multiline}
          maxFontSizeMultiplier={1.4}
          style={[styles.input, multiline && { textAlignVertical: 'top', paddingTop: spacing.sm }]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden(h => !h)}
            hitSlop={12}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t('input.showPassword') : t('input.hidePassword')}
          >
            <Text style={{ color: colors.primary, fontWeight: '500' }}>
              {hidden ? t('input.show') : t('input.hide')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} maxFontSizeMultiplier={1.4}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper} maxFontSizeMultiplier={1.4}>{helper}</Text>
      ) : null}
    </View>
  );
});

export default Input;

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { ...typography.bodySm, color: colors.textPrimary, marginBottom: spacing.xxs, fontWeight: '500' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  input: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: spacing.sm },
  iconL: { marginEnd: spacing.xs },
  toggle: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.xxs },
  helper: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs },
});