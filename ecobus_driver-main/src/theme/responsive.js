import { useMemo } from 'react';
import { Dimensions, PixelRatio, useWindowDimensions } from 'react-native';

const BASE_WIDTH = 390;

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
    scale: (size) =>
      PixelRatio.roundToNearestPixel(size * clamp(ratio, 0.88, 1.15)),
    fscale: (size) =>
      Math.round(size * clamp(ratio, 0.92, 1.08) * 2) / 2,
    contentMaxWidth: cls === 'tablet' ? 720 : cls === 'large' ? 640 : undefined,
  };
};

const initial = computeMetrics(Dimensions.get('window').width);

export const deviceClass     = initial.deviceClass;
export const isCompact       = initial.isCompact;
export const isRegular       = initial.isRegular;
export const isLarge         = initial.isLarge;
export const isTablet        = initial.isTablet;
export const scale           = initial.scale;
export const fscale          = initial.fscale;
export const contentMaxWidth = initial.contentMaxWidth;

export function useResponsive() {
  const { width } = useWindowDimensions();
  return useMemo(() => computeMetrics(width), [width]);
}

export function useContentStyle() {
  const { contentMaxWidth } = useResponsive();
  return useMemo(
    () => contentMaxWidth
      ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }
      : undefined,
    [contentMaxWidth],
  );
}
