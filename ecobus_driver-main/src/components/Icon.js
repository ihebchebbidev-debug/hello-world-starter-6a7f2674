import React from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Driver app is fully vector — no external PNG assets needed.
const VECTOR_ICONS = {
  // Navigation
  chevronRight:     'chevron-right',
  back:             'chevron-left',
  close:            'close',
  external:         'open-in-new',

  // Core bus/transport
  bus:              'bus',
  phone:            'phone',
  sos:              'alert-octagon',
  alert:            'alert-circle',

  // Child boarding status
  statusOnBus:      'bus',
  statusWaiting:    'clock-outline',
  statusNotBoarded: 'account-clock',
  statusDropped:    'map-marker-check',

  // Empty states
  emptyInbox:       'inbox-outline',
  emptyBell:        'bell-off-outline',
  emptyChild:       'account-off-outline',

  // UI utility
  check:            'check',
  clock:            'clock-outline',
  history:          'history',
  search:           'magnify',
  filter:           'filter-variant',
  warning:          'alert-circle-outline',
  info:             'information-outline',

  // Driver-specific
  mapMarker:        'map-marker',
  mapMarkerCheck:   'map-marker-check',
  navigation:       'navigation',
  play:             'play-circle',
  stop:             'stop-circle',
  gps:              'crosshairs-gps',
  gpsOff:           'crosshairs-off',
  child:            'account-child',
  checkCircle:      'check-circle',
  boardedIcon:      'check-circle-outline',
  droppedIcon:      'map-marker-check-outline',
  notBoardedIcon:   'clock-alert-outline',
  routeIcon:        'routes',
  busIcon:          'bus',
  peopleIcon:       'account-group',
  hourIcon:         'clock-outline',
  sosIcon:          'alert-octagon',
  logoutIcon:       'logout',
  profileIcon:      'account-circle-outline',
  bellIcon:         'bell-outline',
  chevronFwd:       'chevron-right',
};

export default function Icon({ name, size = 24, tint, style }) {
  const iconName = VECTOR_ICONS[name];

  if (iconName) {
    return (
      <MaterialCommunityIcons
        name={iconName}
        size={size}
        color={tint || undefined}
        style={style}
        allowFontScaling={false}
      />
    );
  }

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[Icon] unknown name: "${name}"`);
  }
  return <View style={[{ width: size, height: size }, style]} />;
}
