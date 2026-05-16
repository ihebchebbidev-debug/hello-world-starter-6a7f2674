import { colors } from '../theme';

export const STATUS_CFG = {
  on_bus:      { color: colors.success,  key: 'home.status.onTheWay'   },
  active:      { color: colors.success,  key: 'home.status.onTheWay'   },
  waiting:     { color: colors.warning,  key: 'home.status.waiting'    },
  not_boarded: { color: colors.danger,   key: 'home.status.notBoarded' },
  dropped:     { color: colors.primary,  key: 'home.status.droppedOff' },
};

export const DEFAULT_STATUS = { color: colors.warning, key: 'home.status.waiting' };

export function getStatus(child, trip) {
  return STATUS_CFG[child?.status ?? trip?.status] ?? DEFAULT_STATUS;
}
