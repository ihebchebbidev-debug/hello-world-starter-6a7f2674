import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography, radius, shadows } from '../theme';
import { AssignmentAPI, RoutesAPI, GpsAPI } from '../services/api';
import { ensureForegroundLocation, locationServicesEnabled } from '../services/permissions';
import { distanceKm, etaMinutes } from '../utils/geo';

const INITIAL_REGION = {
  latitude: 36.8685,
  longitude: 10.1918,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

const GPS_STATUS = {
  active:  { color: colors.success, icon: 'crosshairs-gps', label: 'map.gpsActive' },
  weak:    { color: colors.warning, icon: 'crosshairs',     label: 'map.gpsWeak' },
  offline: { color: colors.danger,  icon: 'crosshairs-off', label: 'map.gpsOff' },
};

// Throttle: backend's GPS_MIN_INTERVAL_MS defaults to 3000ms. We push every
// 3.5s to stay safely above the rate limit.
const PUSH_INTERVAL_MS = 3500;
// Re-load the assignment every 30s so the screen reflects start/end service
// from the Assignment tab without requiring a manual remount.
const ASSIGNMENT_POLL_MS = 30000;

const formatAge = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
};

export default function MapScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);

  const [stops, setStops] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('offline');
  const [lastFixAt, setLastFixAt] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

  const watchSubRef = useRef(null);
  const lastPushRef = useRef(0);
  const lastFixAtRef = useRef(0);

  const serviceActive = assignment?.status === 'in_progress';
  const busId = assignment?.busId || null;
  const routeId = assignment?.routeId || null;
  const tripId = assignment?.id || null;

  /* ── Load assignment + stops, refresh periodically ─────────── */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const a = await AssignmentAPI.today();
        if (!alive) return;
        setAssignment(a || null);
        const rid = a?.routeId;
        if (rid) {
          const arr = await RoutesAPI.stops(rid).catch(() => []);
          if (alive) setStops(arr || []);
        } else if (alive) {
          setStops([]);
        }
      } catch {
        /* silent — keeps the last good state */
      }
    };
    load();
    const id = setInterval(load, ASSIGNMENT_POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => {
      alive = false;
      clearInterval(id);
      sub.remove();
    };
  }, []);

  /* ── Real GPS watcher: starts only when a trip is active ───── */
  useEffect(() => {
    let cancelled = false;

    const stopWatch = () => {
      if (watchSubRef.current) {
        watchSubRef.current.remove?.();
        watchSubRef.current = null;
      }
    };

    const startWatch = async () => {
      const granted = await ensureForegroundLocation();
      if (cancelled) return;
      if (!granted) {
        setGpsStatus('offline');
        return;
      }
      const enabled = await locationServicesEnabled();
      if (cancelled) return;
      if (!enabled) {
        setGpsStatus('offline');
        return;
      }

      try {
        watchSubRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            if (cancelled || !loc?.coords) return;
            const { latitude, longitude, speed, heading, accuracy } = loc.coords;
            const fixAt = Date.now();
            lastFixAtRef.current = fixAt;
            setLastFixAt(fixAt);
            setDriverPos({ latitude, longitude });
            // Status from accuracy (meters): <25 active, <75 weak, else offline
            const acc = Number.isFinite(accuracy) ? accuracy : 9999;
            setGpsStatus(acc < 25 ? 'active' : acc < 75 ? 'weak' : 'offline');

            // Throttled push to the backend (only when service is active and
            // we know the bus). Speed from expo-location is m/s — backend
            // expects km/h.
            const now = Date.now();
            if (
              serviceActive &&
              busId &&
              now - lastPushRef.current >= PUSH_INTERVAL_MS
            ) {
              lastPushRef.current = now;
              GpsAPI.push({
                busId,
                tripId,
                lat: latitude,
                lng: longitude,
                speed: Number.isFinite(speed) && speed >= 0 ? speed * 3.6 : null,
                heading: Number.isFinite(heading) && heading >= 0 ? heading : null,
              });
            }
          },
        );
      } catch {
        if (!cancelled) setGpsStatus('offline');
      }
    };

    startWatch();
    return () => {
      cancelled = true;
      stopWatch();
    };
  }, [serviceActive, busId]);

  /* ── Mark GPS offline if we haven't received a fix recently ── */
  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(Date.now());
      if (!lastFixAtRef.current) return;
      const age = Date.now() - lastFixAtRef.current;
      if (age > 15000) setGpsStatus('offline');
      else if (age > 7000) setGpsStatus((p) => (p === 'active' ? 'weak' : p));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Centre map on driver when position changes ────────────── */
  useEffect(() => {
    if (!driverPos) return;
    mapRef.current?.animateToRegion(
      { ...driverPos, latitudeDelta: 0.025, longitudeDelta: 0.025 },
      800,
    );
  }, [driverPos]);

  /* ── Polyline coords from real route stops ─────────────────── */
  const routeCoords = useMemo(
    () => stops
      .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
      .map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
    [stops],
  );

  /* ── "Next stop" = nearest unvisited stop to the driver ────── */
  const nextStop = useMemo(() => {
    if (!stops.length) return null;
    if (!driverPos) return stops[0];
    let best = null;
    let bestKm = Infinity;
    for (const s of stops) {
      const km = distanceKm(driverPos, { latitude: s.latitude, longitude: s.longitude });
      if (km != null && km < bestKm) { bestKm = km; best = s; }
    }
    return best || stops[0];
  }, [stops, driverPos]);

  const distanceLabel = useMemo(() => {
    const km = distanceKm(driverPos, nextStop);
    return km == null ? '—' : `${km.toFixed(2)} km`;
  }, [driverPos, nextStop]);

  const etaLabel = useMemo(() => {
    const m = etaMinutes(driverPos, nextStop, 30);
    return m == null ? '—' : `${m} min`;
  }, [driverPos, nextStop]);

  const openNavigation = () => {
    if (!nextStop) return;
    const { latitude, longitude, name } = nextStop;
    const label = encodeURIComponent(name || '');
    const url = Platform.OS === 'ios'
      ? `maps://?q=${label}&ll=${latitude},${longitude}`
      : `google.navigation:q=${latitude},${longitude}`;

    Linking.canOpenURL(url)
      .then((can) => {
        if (can) return Linking.openURL(url);
        return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
      })
      .catch(() => Alert.alert(t('map.navigationError'), t('map.navigationErrorBody')));
  };

  const gps = GPS_STATUS[gpsStatus];
  const initialRegion = driverPos
    ? { ...driverPos, latitudeDelta: 0.025, longitudeDelta: 0.025 }
    : (routeCoords[0]
        ? { ...routeCoords[0], latitudeDelta: 0.03, longitudeDelta: 0.03 }
        : INITIAL_REGION);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" translucent={false} />
      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {routeCoords.length >= 2 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={colors.primary}
            strokeWidth={3}
            lineDashPattern={[1]}
          />
        )}

        {stops.map((stop, idx) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={stop.shortName}
            description={stop.scheduledTime}
          >
            <View style={[
              s.stopMarker,
              stop.isSchool && s.stopMarkerSchool,
              nextStop?.id === stop.id && s.stopMarkerNext,
            ]}>
              <MaterialCommunityIcons
                name={stop.isSchool ? 'school' : 'bus-stop'}
                size={14}
                color={stop.isSchool || nextStop?.id === stop.id ? '#fff' : colors.primary}
              />
            </View>
          </Marker>
        ))}

        {driverPos && (
          <Marker coordinate={driverPos} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={s.driverMarker}>
              <MaterialCommunityIcons name="bus" size={18} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Top overlay: GPS status + last fix age */}
      <View style={[s.topBar, { top: insets.top + spacing.sm }]} pointerEvents="none">
        <View style={[s.gpsPill, { backgroundColor: gps.color }]}>
          <MaterialCommunityIcons name={gps.icon} size={14} color="#fff" />
          <Text style={s.gpsPillText}>{t(gps.label)}</Text>
          <View style={s.gpsDot} />
          <Text style={s.gpsPillText}>
            {lastFixAt
              ? t('map.gpsLastFix', {
                  defaultValue: '{{age}} ago',
                  age: formatAge(nowTick - lastFixAt),
                })
              : t('map.gpsNoFix', { defaultValue: 'no fix' })}
          </Text>
        </View>
      </View>

      {/* No-service overlay */}
      {!serviceActive && (
        <View style={s.noServiceOverlay} pointerEvents="none">
          <Text style={s.noServiceText}>{t('map.noService')}</Text>
        </View>
      )}

      {/* Bottom info panel */}
      <View style={[s.panel, { paddingBottom: insets.bottom + spacing.md }, shadows.modal]}>
        <View style={s.panelRow}>
          <View style={s.panelItem}>
            <Text style={s.panelItemLabel}>{t('map.nextStop')}</Text>
            <Text style={s.panelItemValue} numberOfLines={1}>{nextStop?.shortName ?? '—'}</Text>
            <Text style={s.panelItemTime}>{nextStop?.scheduledTime ?? ''}</Text>
          </View>

          <View style={s.panelDivider} />

          <View style={s.panelItem}>
            <Text style={s.panelItemLabel}>{t('map.distance')}</Text>
            <Text style={s.panelItemValue}>{distanceLabel}</Text>
          </View>

          <View style={s.panelDivider} />

          <View style={s.panelItem}>
            <Text style={s.panelItemLabel}>{t('map.eta')}</Text>
            <Text style={s.panelItemValue}>{etaLabel}</Text>
          </View>
        </View>

        <Pressable
          onPress={openNavigation}
          style={({ pressed }) => [s.navigateBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          disabled={!nextStop}
        >
          <MaterialCommunityIcons name="navigation" size={20} color="#fff" />
          <Text style={s.navigateBtnText}>{t('map.navigate')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  map:  { flex: 1 },

  topBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
  },
  gpsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.pill,
  },
  gpsPillText: { ...typography.captionMd, color: '#fff', fontWeight: '700' },
  gpsDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)' },

  noServiceOverlay: {
    position: 'absolute', bottom: 140, left: spacing.md, right: spacing.md,
    backgroundColor: 'rgba(16,24,40,0.75)', borderRadius: radius.md,
    padding: spacing.sm, alignItems: 'center',
  },
  noServiceText: { ...typography.bodySm, color: '#fff', textAlign: 'center' },

  stopMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stopMarkerSchool: { backgroundColor: colors.success, borderColor: colors.successDark },
  stopMarkerNext:   { backgroundColor: colors.primary, borderColor: colors.primaryDark },

  driverMarker: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primary, borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },

  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.md, paddingTop: spacing.md,
    gap: spacing.md,
  },
  panelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  panelItem: { flex: 1, alignItems: 'center', gap: 2 },
  panelItemLabel: { ...typography.overline, color: colors.textMuted, textTransform: 'uppercase' },
  panelItemValue: { ...typography.subtitleSm, color: colors.textPrimary, textAlign: 'center' },
  panelItemTime: { ...typography.caption, color: colors.textMuted },
  panelDivider: { width: 1, height: 40, backgroundColor: colors.border },

  navigateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, backgroundColor: colors.primary, borderRadius: radius.md,
    height: 52,
  },
  navigateBtnText: { ...typography.button, color: '#fff' },
});
