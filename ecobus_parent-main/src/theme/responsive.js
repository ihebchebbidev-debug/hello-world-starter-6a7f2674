import { useMemo } from 'react';
import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

/**
 * Responsive helpers tuned for phones from 320pt (iPhone SE 1st gen) up to
 * 13" tablets and foldables. Two flavours are exposed:
 *
 * 1. Static helpers (`scale`, `fscale`, `deviceClass`, `isTablet`, …) —
 *    sampled once at import time. Use these inside `StyleSheet.create`
 *    and other module-level constants. Cheap and good enough for the
 *    overwhelming majority of styles.
 *
 * 2. The `useResponsive()` hook — re-evaluates on every dimension change
 *    (rotation, split-screen, foldable unfold). Use this whenever a
 *    component must adapt its layout live (grid columns, side-by-side
 *    panels, modal sizing).
 *
 * We never go below 12pt for body text and we cap content width at 720pt
 * on tablets so cards don't become awkward letterbox stripes.
 */
const BASE_WIDTH = 390; // iPhone 14

const classify = (w) =>
  w < 360 ? 'compact' :
  w < 600 ? 'regular' :
  w < 900 ? 'large'   :
  'tablet';

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

const computeMetrics = (width) => {
  const ratio = width / BASE_WIDTH;
  const cls = classify(width);
  return {
    width,
    deviceClass: cls,
    isCompact: cls === 'compact',
    isRegular: cls === 'regular',
    isLarge:   cls === 'large' || cls === 'tablet',
    isTablet:  cls === 'tablet',
    // Layout scale — slightly more aggressive than fontScale.
    scale: (size) =>
      PixelRatio.roundToNearestPixel(size * clamp(ratio, 0.88, 1.15)),
    // Font scale — conservative so text never becomes huge on tablets.
    fscale: (size) =>
      Math.round(size * clamp(ratio, 0.92, 1.08) * 2) / 2,
    // Cap content width on big screens so cards don't stretch ear-to-ear.
    contentMaxWidth: cls === 'tablet' ? 720 : cls === 'large' ? 640 : undefined,
  };
};

// ---- Static, import-time snapshot (used by StyleSheet.create) -------------
const initial = computeMetrics(Dimensions.get('window').width);

export const deviceClass     = initial.deviceClass;
export const isCompact       = initial.isCompact;
export const isRegular       = initial.isRegular;
export const isLarge         = initial.isLarge;
export const isTablet        = initial.isTablet;
export const scale           = initial.scale;
export const fscale          = initial.fscale;
export const contentMaxWidth = initial.contentMaxWidth;

// ---- Live hook — re-renders on rotation / split-screen / foldable ---------
/**
 * Subscribe to live dimension changes. Returns the same metrics shape as
 * the static export, recomputed on every window resize.
 *
 *   const { isTablet, isLarge, contentMaxWidth, scale } = useResponsive();
 */
export function useResponsive() {
  const { width } = useWindowDimensions();
  return useMemo(() => computeMetrics(width), [width]);
}

/**
 * Returns a style object that centers + caps content on tablets.
 * Apply to the innermost full-width container in screens that use
 * raw <View> roots instead of the <Screen> wrapper.
 */
export function useContentStyle() {
  const { contentMaxWidth } = useResponsive();
  return useMemo(
    () => contentMaxWidth
      ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }
      : undefined,
    [contentMaxWidth],
  );
}
