import { Platform } from 'react-native';

const make = (elevation, opacity, radius, offsetY) =>
  Platform.select({
    ios: {
      shadowColor: '#101828',
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: { elevation },
    default: {},
  });

export const shadows = {
  none:   {},
  sm:     make(1, 0.04, 4,  1),
  card:   make(2, 0.06, 8,  2),
  raised: make(4, 0.10, 12, 4),
  modal:  make(8, 0.16, 20, 8),
  fab:    make(6, 0.18, 12, 4),
};

export default shadows;
