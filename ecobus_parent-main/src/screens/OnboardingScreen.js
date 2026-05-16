import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Icons } from '../assets/icons';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { colors, spacing, radius, typography } from '../theme';
import { useContentStyle } from '../theme/responsive';

export const ONBOARDED_KEY = '@ecobus/onboarded';

const BG = colors.secondary; // deep navy

const SLIDES = [
  {
    key: 'slide1',
    icon: Icons.bus,
    accentColor: colors.primary,       // teal
    glowColor:   'rgba(34,155,166,1)',
  },
  {
    key: 'slide2',
    icon: Icons.tabNotifications,
    accentColor: '#0BA5EC',            // sky blue
    glowColor:   'rgba(11,165,236,1)',
  },
  {
    key: 'slide3',
    icon: Icons.sos,
    accentColor: colors.danger,        // red
    glowColor:   'rgba(217,45,32,1)',
  },
];

/* ─── Individual slide ─────────────────────────────────────────── */
function Slide({ item, index, t, scrollX, width, height }) {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  const opacity   = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' });
  const translateY= scrollX.interpolate({ inputRange, outputRange: [40, 0, 40], extrapolate: 'clamp' });

  const iconSize  = Math.min(width * 0.28, 110);
  const ringOuter = iconSize + 100;
  const ringMid   = iconSize + 60;
  const ringInner = iconSize + 22;

  return (
    <View style={{ width, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      {/* Ghost watermark */}
      <Image
        source={item.icon}
        style={[s.bgWatermark, { width: width * 0.95, height: width * 0.95, tintColor: item.accentColor }]}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no"
      />

      <Animated.View style={{ alignItems: 'center', opacity, transform: [{ translateY }] }}>

        {/* Illustration — concentric rings with glow */}
        <View style={{ marginBottom: height * 0.05, alignItems: 'center', justifyContent: 'center' }}>
          {/* Outer ring */}
          <View style={[s.ring, {
            width: ringOuter, height: ringOuter, borderRadius: ringOuter / 2,
            borderColor: item.accentColor + '1A', // 10% opacity
            backgroundColor: item.accentColor + '08',
          }]} />
          {/* Mid ring */}
          <View style={[s.ring, {
            width: ringMid, height: ringMid, borderRadius: ringMid / 2,
            borderColor: item.accentColor + '33', // 20% opacity
            backgroundColor: item.accentColor + '10',
          }]} />
          {/* Inner ring */}
          <View style={[s.ring, {
            width: ringInner, height: ringInner, borderRadius: ringInner / 2,
            borderColor: item.accentColor + '55',
            backgroundColor: item.accentColor + '18',
          }]} />
          {/* Icon badge */}
          <View style={[s.iconBadge, {
            width: iconSize, height: iconSize, borderRadius: iconSize / 2,
            backgroundColor: item.accentColor,
            shadowColor: item.glowColor,
          }]}>
            <Image
              source={item.icon}
              style={{ width: iconSize * 0.52, height: iconSize * 0.52, tintColor: '#fff' }}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Number tag */}
        <View style={[s.numTag, { borderColor: item.accentColor + '40', backgroundColor: item.accentColor + '15' }]}>
          <Text style={[s.numText, { color: item.accentColor }]}>
            {String(index + 1).padStart(2, '0')}
          </Text>
        </View>

        {/* Title */}
        <Text style={[s.slideTitle, { fontSize: width < 360 ? 26 : 30 }]}>
          {t(`onboarding.${item.key}.title`)}
        </Text>

        {/* Body */}
        <Text style={[s.slideBody, { fontSize: width < 360 ? 14 : 15, maxWidth: Math.min(width - 80, 320) }]}>
          {t(`onboarding.${item.key}.body`)}
        </Text>
      </Animated.View>
    </View>
  );
}

/* ─── Screen ───────────────────────────────────────────────────── */
export default function OnboardingScreen({ navigation }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const contentStyle = useContentStyle();
  const listRef  = useRef(null);
  const scrollX  = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  const finish = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => {});
    navigation.replace('Login');
  }, [navigation]);

  const next = useCallback(() => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      finish();
    }
  }, [index, finish]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setIndex(viewableItems[0].index ?? 0);
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const isLast   = index === SLIDES.length - 1;
  const currentSlide = SLIDES[index];

  /* Animated accent color proxy — we animate the dot width/opacity instead */
  const DotRow = () => (
    <View style={s.dotRow}>
      {SLIDES.map((slide, i) => {
        const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
        const dotW = scrollX.interpolate({ inputRange, outputRange: [6, 20, 6], extrapolate: 'clamp' });
        const dotO = scrollX.interpolate({ inputRange, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={slide.key}
            style={[s.dot, { width: dotW, opacity: dotO, backgroundColor: slide.accentColor }]}
          />
        );
      })}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: BG }]}>

      {/* Top bar: language switcher (left) + skip (right) */}
      <SafeAreaView edges={['top']} style={s.topBar} pointerEvents="box-none">
        <View style={{ flexShrink: 1 }}>
          <LanguageSwitcher variant="dark" />
        </View>
        {!isLast ? (
          <Pressable onPress={finish} hitSlop={16} accessibilityRole="button" style={{ flexShrink: 0 }}>
            <Text style={s.skipText}>{t('onboarding.skip')}</Text>
          </Pressable>
        ) : <View style={{ width: 56, flexShrink: 0 }} />}
      </SafeAreaView>

      {/* Slides */}
      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index: i }) => (
          <View style={contentStyle}>
            <Slide
              item={item}
              index={i}
              t={t}
              scrollX={scrollX}
              width={width}
              height={height}
            />
          </View>
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        bounces={false}
        decelerationRate="fast"
        style={{ flex: 1 }}
      />

      {/* Bottom bar */}
      <SafeAreaView edges={['bottom']} style={s.bottomBar}>
        <DotRow />

        <Pressable
          onPress={next}
          style={({ pressed }) => [
            s.cta,
            { backgroundColor: currentSlide.accentColor },
            pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
          ]}
          accessibilityRole="button"
        >
          <Text style={s.ctaText}>
            {isLast ? t('onboarding.start') : t('onboarding.next')}
          </Text>
          {!isLast && (
            <Image
              source={Icons.chevronRight}
              style={s.ctaArrow}
              resizeMode="contain"
            />
          )}
        </Pressable>

        <Text style={s.progressLabel}>
          {index + 1} / {SLIDES.length}
        </Text>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  /* Top */
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  skipText: {
    ...typography.bodySmMd,
    color: colors.onBrandMuted,
  },

  /* Watermark */
  bgWatermark: {
    position: 'absolute',
    opacity: 0.04,
    top: '10%',
  },

  /* Concentric rings — positioned absolutely around the badge */
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },

  /* Icon badge */
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },

  /* Text */
  numTag: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: spacing.md,
  },
  numText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  slideTitle: {
    ...typography.title,
    color: colors.textInverse,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  slideBody: {
    ...typography.bodySm,
    color: colors.onBrandMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },

  /* Bottom bar */
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'transparent',
  },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    height: 56,
    paddingHorizontal: spacing.xl,
    alignSelf: 'stretch',
    gap: spacing.xs,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  ctaText: {
    ...typography.button,
    color: colors.textInverse,
  },
  ctaArrow: { width: 16, height: 16, tintColor: colors.textInverse },

  progressLabel: {
    ...typography.overline,
    color: colors.onBrandText,
    opacity: 0.4,
    marginTop: -spacing.xs,
  },
});
