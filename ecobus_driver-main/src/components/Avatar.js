import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme';

export default function Avatar({ uri, name = '', size = 44 }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
        accessible
        accessibilityLabel={name ? `${name} avatar` : 'Avatar'}
        style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }
  return (
    <View
      style={[
        styles.base,
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
      accessible
      accessibilityLabel={name ? `${name} avatar` : 'Avatar'}
    >
      <Text style={[typography.subtitleSm, { color: colors.primaryDark, fontWeight: '700' }]}>
        {initials || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.primaryLight },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
