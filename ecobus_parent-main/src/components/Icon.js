import React from 'react';
import { Image, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Icons } from '../assets/icons';

/**
 * Icon — renders an icon by name.
 *
 * Resolution order:
 *  1. Registered PNG asset in `assets/icons/index.js` (the original source
 *     of truth — keeps designed bus/tab/status art pixel-perfect).
 *  2. Fallback to a MaterialCommunityIcons glyph via the mapping below.
 *     This means UI chrome icons (check, clock, history, …) render without
 *     us shipping a new PNG for every new use site.
 *  3. Last-resort empty placeholder of the requested size — keeps layouts
 *     stable instead of collapsing when a name is mistyped.
 *
 * `tint` recolours both PNGs (via tintColor) and vector glyphs (via color).
 */
const VECTOR_FALLBACK = {
  check:        'check',
  clock:        'clock-outline',
  tabHistory:   'history',
  // Aliases used elsewhere — surfaced here so a typo doesn't silently render
  // nothing while we migrate the rest of the codebase to PNGs.
  search:       'magnify',
  filter:       'filter-variant',
  close:        'close',
  warning:      'alert-circle-outline',
  info:         'information-outline',
  back:         'chevron-left',
};

export default function Icon({ name, size = 24, tint, style }) {
  const source = Icons[name];
  if (source) {
    return (
      <Image
        source={source}
        resizeMode="contain"
        style={[
          { width: size, height: size },
          tint ? { tintColor: tint } : null,
          style,
        ]}
      />
    );
  }

  const vectorName = VECTOR_FALLBACK[name];
  if (vectorName) {
    return (
      <MaterialCommunityIcons
        name={vectorName}
        size={size}
        color={tint || undefined}
        style={style}
        allowFontScaling={false}
      />
    );
  }

  // Stable placeholder — preserves layout and signals (in dev) that the
  // icon name is unknown without throwing.
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[Icon] unknown name: "${name}"`);
  }
  return <View style={[{ width: size, height: size }, style]} />;
}
