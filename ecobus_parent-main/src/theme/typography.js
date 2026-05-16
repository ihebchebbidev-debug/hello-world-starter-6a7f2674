import { Platform } from 'react-native';
import { fscale } from './responsive';

/**
 * Typography system.
 *
 * Font family:
 * - iOS uses San Francisco (the system default) for native feel and
 *   automatic Dynamic Type support.
 * - Android uses Roboto for the same reason.
 *
 * Scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 — a tightened modular scale
 * roughly based on a 1.2 ratio. Sizes auto-scale via `fscale` so text
 * stays legible from a 320pt iPhone SE up to a 13" iPad.
 *
 * Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold).
 * On iOS these map to SF weights; on Android to Roboto weights.
 *
 * Line height: ~1.4 for body, ~1.25 for display headings (denser).
 * Letter spacing: tightened slightly on large headings (-0.2 to -0.4)
 * for a more refined, modern look — the iOS HIG / Material 3 standard.
 */

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
  // Use the medium-specific family on Android for crisper rendering at 500/600.
  const family = Platform.OS === 'android' && (weight === '500' || weight === '600')
    ? fontFamilyMedium
    : fontFamily;
  return {
    fontFamily: family,
    fontSize: fs,
    lineHeight: Math.round(fs * lh),
    fontWeight: weight,
    letterSpacing: ls,
    includeFontPadding: false, // Android only, removes extra vertical space
  };
};

export const typography = {
  fontFamily,

  // Display — hero numbers, splash, big stats
  display:    make(30, '700', { lh: 1.2, ls: -0.4 }),

  // Titles — screen headers, section titles
  title:      make(24, '700', { lh: 1.25, ls: -0.3 }),
  titleSm:    make(20, '700', { lh: 1.3,  ls: -0.2 }),

  // Subtitles — card headers, list group labels
  subtitle:   make(18, '600', { lh: 1.35 }),
  subtitleSm: make(16, '600', { lh: 1.4 }),

  // Body
  body:       make(16, '400', { lh: 1.45 }),
  bodyMd:     make(16, '500', { lh: 1.45 }),
  bodySm:     make(14, '400', { lh: 1.45 }),
  bodySmMd:   make(14, '500', { lh: 1.45 }),

  // Caption / meta
  caption:    make(12, '400', { lh: 1.4,  ls: 0.1 }),
  captionMd:  make(12, '500', { lh: 1.4,  ls: 0.2 }),
  overline:   make(11, '600', { lh: 1.4,  ls: 0.8 }), // ALL-CAPS labels

  // Interactive
  button:     make(16, '600', { lh: 1.2,  ls: 0.1 }),
  buttonSm:   make(14, '600', { lh: 1.2,  ls: 0.1 }),
  link:       make(16, '500', { lh: 1.4 }),
};

export default typography;
