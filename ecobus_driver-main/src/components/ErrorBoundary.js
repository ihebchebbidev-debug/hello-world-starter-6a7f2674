import React from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

const BG = colors.secondary;

class ErrorBoundary extends React.Component {
  state = { error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.warn('ErrorBoundary caught:', error, info?.componentStack);
    this.setState({ errorInfo: info });
  }

  reset = () => this.setState({ error: null, errorInfo: null });

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorScreen error={this.state.error} onReset={this.reset} t={this.props.t} />;
  }
}

export default withTranslation()(ErrorBoundary);

class ErrorScreen extends React.Component {
  pulse = new Animated.Value(1);
  opacity = new Animated.Value(0);

  componentDidMount() {
    Animated.timing(this.opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(this.pulse, { toValue: 1.08, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(this.pulse, { toValue: 1,    duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
  }

  render() {
    const { error, onReset, t } = this.props;
    const msg = error?.message || String(error);

    return (
      <View style={s.root}>
        <Animated.View style={[s.glow, { transform: [{ scale: this.pulse }] }]} pointerEvents="none" />
        <View style={s.watermark} pointerEvents="none">
          <MaterialCommunityIcons name="bus" size={300} color={colors.danger} style={{ opacity: 0.04 }} />
        </View>
        <SafeAreaView style={s.safeArea}>
          <Animated.View style={[s.content, { opacity: this.opacity }]}>
            <View style={s.badgeOuter}>
              <View style={s.badgeMid}>
                <View style={s.badgeInner}>
                  <Text style={s.badgeEmoji}>⚠️</Text>
                </View>
              </View>
            </View>
            <Text style={s.title}>{t('errors.boundaryTitle')}</Text>
            <Text style={s.subtitle}>{t('errors.boundaryBody')}</Text>
            <View style={s.detailCard}>
              <Text style={s.detailLabel}>ERROR</Text>
              <Text style={s.detailText} numberOfLines={4}>{msg}</Text>
            </View>
            <Pressable
              onPress={onReset}
              style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
              accessibilityRole="button"
            >
              <Text style={s.primaryBtnText}>{t('common.tryAgain')}</Text>
            </Pressable>
            <Text style={s.hint}>{t('errors.boundaryHint')}</Text>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }
}

const BADGE = 80;
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glow: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: colors.danger, opacity: 0.07 },
  watermark: { position: 'absolute', bottom: -60, right: -60, overflow: 'hidden' },
  safeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  content: { alignItems: 'center', width: '100%' },
  badgeOuter: { width: BADGE + 52, height: BADGE + 52, borderRadius: (BADGE + 52) / 2, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)', backgroundColor: 'rgba(239,68,68,0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  badgeMid: { width: BADGE + 26, height: BADGE + 26, borderRadius: (BADGE + 26) / 2, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.08)', alignItems: 'center', justifyContent: 'center' },
  badgeInner: { width: BADGE, height: BADGE, borderRadius: BADGE / 2, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', shadowColor: colors.danger, shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 14 },
  badgeEmoji: { fontSize: 34 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.4, textAlign: 'center', marginBottom: spacing.sm, fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) },
  subtitle: { ...typography.body, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: spacing.xl, maxWidth: 300, lineHeight: 22 },
  detailCard: { width: '100%', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', padding: spacing.md, marginBottom: spacing.xl },
  detailLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: colors.danger, marginBottom: 6 },
  detailText: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), lineHeight: 18 },
  primaryBtn: { width: '100%', height: 52, backgroundColor: colors.danger, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', shadowColor: colors.danger, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8, marginBottom: spacing.md },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  hint: { ...typography.caption, color: 'rgba(255,255,255,0.25)', textAlign: 'center', maxWidth: 260 },
});
