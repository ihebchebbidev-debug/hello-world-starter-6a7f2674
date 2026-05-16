// Centralised icon registry. Add a new asset here once and reference by key
// everywhere else — no string paths scattered across the codebase.
export const Icons = {
  logo:             require('./logo.png'),
  tabHome:          require('./tab-home.png'),
  tabTracking:      require('./tab-tracking.png'),
  tabNotifications: require('./tab-notifications.png'),
  tabProfile:       require('./tab-profile.png'),

  bus:              require('./bus.png'),
  phone:            require('./phone.png'),
  sos:              require('./sos.png'),
  alert:            require('./alert.png'),

  statusOnBus:      require('./status-onbus.png'),
  statusWaiting:    require('./status-waiting.png'),
  statusNotBoarded: require('./status-notboarded.png'),
  statusDropped:    require('./status-dropped.png'),

  emptyInbox:       require('./empty-inbox.png'),
  emptyBell:        require('./empty-bell.png'),
  emptyChild:       require('./empty-child.png'),

  chevronRight:     require('./chevron-right.png'),
  external:         require('./external.png'),
};