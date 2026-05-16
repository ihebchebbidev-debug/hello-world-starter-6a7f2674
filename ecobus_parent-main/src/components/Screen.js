import React from 'react';
import { Platform, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout } from '../theme';
import { useResponsive } from '../theme/responsive';

/**
 * Screen — every screen MUST be wrapped in this. Handles:
 *  - SafeAreaView (notch + home indicator)
 *  - StatusBar style (light / dark)
 *  - Standard horizontal padding
 *  - Optional scroll
 *  - Live tablet / large-phone content clamp (centered, max ~720pt) so cards
 *    don't stretch ear-to-ear on iPad or unfolded foldables.
 */
export default function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top'],
  background = colors.background,
  statusBarStyle = 'dark-content',
  refreshControl,
  contentContainerStyle,
}) {
  const { contentMaxWidth } = useResponsive();
  const inner = padded ? { paddingHorizontal: layout.screenPadding } : null;
  const clamp = contentMaxWidth
    ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }
    : null;

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: background }]}>
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={Platform.OS === 'android' ? background : undefined}
        translucent={false}
      />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            { paddingBottom: layout.bottomSafe },
            inner,
            clamp,
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          overScrollMode={Platform.OS === 'android' ? 'always' : undefined}
          bounces={Platform.OS === 'ios'}
          // Lets the scroll view stretch to fill on tablets so the clamp
          // can center its child, while still scrolling when content overflows.
          alwaysBounceVertical={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner, clamp]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
