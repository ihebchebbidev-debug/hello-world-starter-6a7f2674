import { Platform } from 'react-native';
import { fscale } from './responsive';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const fontFamilyMedium = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

const make = (size, weight = '400', { lh = 1.4, ls = 0 } = {}) => {
  const fs = fscale(size);
  const family = Platform.OS === 'android' && (weight === '500' || weight === '600')
    ? fontFamilyMedium
    : fontFamily;
  return {
    fontFamily: family,
    fontSize: fs,
    lineHeight: Math.round(fs * lh),
    fontWeight: weight,
    letterSpacing: ls,
    includeFontPadding: false,
  };
};

export const typography = {
  fontFamily,
  display:    make(30, '700', { lh: 1.2, ls: -0.4 }),
  title:      make(24, '700', { lh: 1.25, ls: -0.3 }),
  titleSm:    make(20, '700', { lh: 1.3,  ls: -0.2 }),
  subtitle:   make(18, '600', { lh: 1.35 }),
  subtitleSm: make(16, '600', { lh: 1.4 }),
  body:       make(16, '400', { lh: 1.45 }),
  bodyMd:     make(16, '500', { lh: 1.45 }),
  bodySm:     make(14, '400', { lh: 1.45 }),
  bodySmMd:   make(14, '500', { lh: 1.45 }),
  caption:    make(12, '400', { lh: 1.4,  ls: 0.1 }),
  captionMd:  make(12, '500', { lh: 1.4,  ls: 0.2 }),
  overline:   make(11, '600', { lh: 1.4,  ls: 0.8 }),
  button:     make(16, '600', { lh: 1.2,  ls: 0.1 }),
  buttonSm:   make(14, '600', { lh: 1.2,  ls: 0.1 }),
  link:       make(16, '500', { lh: 1.4 }),
};

export default typography;
