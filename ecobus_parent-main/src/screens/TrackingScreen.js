import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Icon } from '../components';
import { connectTracking, disconnectTracking } from '../services/socketService';
import { requestLocationPermission } from '../services/permissions';
import { BusesAPI } from '../services/api';
import useSmoothCoordinate from '../hooks/useSmoothCoordinate';
import { colors, radius, spacing, typography, shadows, layout } from '../theme';
import { useContentStyle } from '../theme/responsive';
import { splitRouteAtMarker } from '../utils/polyline';
import { formatEta } from '../utils/format';

// Bus operational status → tone for the trust-card badge. Drives the colored
// pill so a parent can tell "moving" from "stopped" or "out of service" at a
// glance, without reading text.
const BUS_STATUS_TONE = {
  moving:          'success',
  on_route:        'success',
  active:          'success',
  in_service:      'success',
  stopped:         'warning',
  idle:            'warning',
  paused:          'warning',
  offline:         'danger',
  out_of_service:  'danger',
  maintenance:     'danger',
};

// Localized via t('tracking.connecting' | 'live' | 'reconnecting' | 'offline').
const STATUS_META = {
  connecting:   { tone: 'warning', key: 'tracking.connecting' },
  live:         { tone: 'success', key: 'tracking.live' },
  reconnecting: { tone: 'warning', key: 'tracking.reconnecting' },
  offline:      { tone: 'danger',  key: 'tracking.offline' },
};

// Freshness thresholds for the "last GPS" indicator (ms).
const FRESH_OK_MS    = 8000;   // ≤ 8s → strong / live
const FRESH_WEAK_MS  = 25000;  // ≤ 25s → weak
// > 25s → offline

const formatAge = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
};

// Centred on the Ariana/El Menzah simulation route for the mock.
const TUNIS = { latitude: 36.8512, longitude: 10.2080 };
// Only re-render the panel when these rounded fields change (~11m precision).
const round5 = (n) => (n == null ? null : Math.round(n * 1e5) / 1e5);

// Polling cadence for the REST fallback when the realtime socket is not "live".
// The backend caches last GPS in `bus_live_status`, so this is cheap and prevents
// the "bus disappeared" feeling when a socket drops mid-trip.
const FALLBACK_POLL_MS = 12000;

export default function TrackingScreen({ route, navigation }) {
  const { t } = useTranslation();
  const busId  = route?.params?.busId;
  const tripId = route?.params?.tripId;
  const child  = route?.params?.child;
  const mapRef = useRef(null);

  // Render-state holds only what visually matters; raw stream goes via ref.
  const [bus, setBus]       = useState(null);
  const [busInfo, setBusInfo] = useState(null); // { name, plateNumber }
  const [status, setStatus] = useState('connecting');
  const [eta, setEta]       = useState(null);
  const [showsUserLocation, setShowsUserLocation] = useState(false);
  const [lastUpdateAt, setLastUpdateAt] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

  // Re-render every second so the "Xs ago" label stays accurate.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const lastCamRef   = useRef(0);
  const lastBusRef   = useRef(null);
  const statusRef    = useRef('connecting');
  const etaRef       = useRef(null);

  // Keep refs in sync so the *stable* `applyLocation` callback below can
  // read the latest values without changing identity — which would otherwise
  // tear down and re-open the websocket on every ETA update (reconnection storm).
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { etaRef.current = eta; }, [eta]);

  useEffect(() => {
    let cancelled = false;
    requestLocationPermission().then((granted) => {
      if (!cancelled) setShowsUserLocation(!!granted);
    });
    return () => { cancelled = true; };
  }, []);

  // One-shot bus enrichment (plate number + display name) for the trust card.
  useEffect(() => {
    if (!busId) return undefined;
    let cancelled = false;
    BusesAPI.get(busId)
      .then((b) => { if (!cancelled && b) setBusInfo(b); })
      .catch(() => { /* non-fatal — trust card just hides plate */ });
    return () => { cancelled = true; };
  }, [busId]);

  // Apply a location payload from either the socket or the REST fallback.
  // Stable identity — reads the latest ETA via ref so this callback never
  // changes, which keeps the socket subscription alive across renders.
  const applyLocation = useCallback((payload, { animate = true } = {}) => {
    if (!payload || payload.lat == null || payload.lng == null) return;
    setLastUpdateAt(Date.now());

    if (animate) {
      const now = Date.now();
      if (now - lastCamRef.current > 1000) {
        lastCamRef.current = now;
        mapRef.current?.animateCamera(
          { center: { latitude: payload.lat, longitude: payload.lng } },
          { duration: 600 },
        );
      }
    }

    const prev = lastBusRef.current;
    const sameLoc =
      prev &&
      round5(prev.lat) === round5(payload.lat) &&
      round5(prev.lng) === round5(payload.lng) &&
      prev.status === payload.status &&
      prev.nextStop === payload.nextStop &&
      prev.distanceKm === payload.distanceKm;

    if (!sameLoc) {
      // Merge so REST payloads (which may lack route/driver info) don't clobber
      // the richer socket payload's metadata.
      const merged = { ...(prev || {}), ...payload };
      lastBusRef.current = merged;
      setBus(merged);
    }
    if (payload.eta != null && payload.eta !== etaRef.current) setEta(payload.eta);
  }, []);

  useEffect(() => {
    if (!busId && !tripId) return undefined;

    connectTracking({ busId, tripId }, {
      onConnect:    () => setStatus('live'),
      onDisconnect: () => setStatus('reconnecting'),
      onError:      () => setStatus('offline'),
      onLocation:   (payload) => applyLocation(payload, { animate: true }),
      onTripEnded:  () => setStatus('offline'),
    });

    return () => disconnectTracking();
  }, [busId, tripId, applyLocation]);

  // REST polling fallback. Runs whenever the realtime channel isn't healthy
  // so the parent always sees a recent position instead of a frozen map.
  useEffect(() => {
    if (!busId) return undefined;
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      if (cancelled) return;
      // Only poll while not "live". Socket data is fresher; don't fight it.
      if (statusRef.current !== 'live') {
        try {
          const live = await BusesAPI.live(busId);
          if (!cancelled && live && live.latitude != null && live.longitude != null) {
            applyLocation({
              lat: Number(live.latitude),
              lng: Number(live.longitude),
              speed: live.speed,
              heading: live.heading,
              status: live.gps_status,
            }, { animate: false });
          }
        } catch { /* swallow — the socket may recover next tick */ }
      }
      if (!cancelled) timer = setTimeout(tick, FALLBACK_POLL_MS);
    };

    // Kick off immediately so we don't wait 12s for the first refresh.
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [busId, applyLocation]);

  // Smoothly interpolate the rendered marker between socket fixes so the bus
  // glides along the road instead of teleporting every few seconds. Camera
  // animation above handles the map follow; this drives the marker pin.
  const smoothCoord = useSmoothCoordinate(
    bus?.lat != null && bus?.lng != null ? { lat: bus.lat, lng: bus.lng } : null,
    { durationMs: 2500, maxDurationMs: 4000 },
  );

  const driverPhone = bus?.driverPhone ?? child?.driverPhone;
  const callDriver = useCallback(() => {
    if (driverPhone) {
      Linking.openURL(`tel:${driverPhone}`);
    } else {
      Alert.alert(t('tracking.driver'), t('tracking.driverPhoneMissing'));
    }
  }, [driverPhone, t]);

  const sendSos = useCallback(() => navigation?.navigate?.('Sos'), [navigation]);

  const meta = STATUS_META[status] ?? STATUS_META.connecting;
  const contentStyle = useContentStyle();

  // GPS freshness — derived from the last applied location payload.
  const fresh = useMemo(() => {
    if (!lastUpdateAt) {
      return { tone: 'warning', key: 'tracking.gpsNoData', defaultValue: 'no GPS yet', label: null };
    }
    const age = nowTick - lastUpdateAt;
    const ageLabel = formatAge(age);
    if (age <= FRESH_OK_MS)   return { tone: 'success', key: 'tracking.gpsFresh',   defaultValue: 'live · {{age}} ago', label: ageLabel, age };
    if (age <= FRESH_WEAK_MS) return { tone: 'warning', key: 'tracking.gpsWeak',    defaultValue: 'weak · {{age}} ago', label: ageLabel, age };
    return                          { tone: 'danger',  key: 'tracking.gpsOffline', defaultValue: 'offline · {{age}} ago', label: ageLabel, age };
  }, [lastUpdateAt, nowTick]);
  const freshLabel = fresh.label
    ? t(fresh.key, { defaultValue: fresh.defaultValue, age: fresh.label })
    : t(fresh.key, { defaultValue: fresh.defaultValue });

  const initialRegion = useMemo(() => ({
    latitude:       bus?.lat ?? TUNIS.latitude,
    longitude:      bus?.lng ?? TUNIS.longitude,
    latitudeDelta:  0.04,   // wide enough to show the full Ariana→school route
    longitudeDelta: 0.04,
  // initialRegion only matters on first mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Driver/bus trust info — merged from socket payload, child param, and REST fetch.
  // `busStatus` is the live operational state (moving / stopped / offline / …)
  // surfaced as a colored badge in the trust card so parents can read it without
  // parsing words.
  const driverInfo = useMemo(() => ({
    name:        bus?.driverName  ?? child?.driverName  ?? null,
    photoUrl:    bus?.driverPhoto ?? child?.driverPhoto ?? null,
    phone:       driverPhone ?? null,
    plateNumber: bus?.plateNumber ?? busInfo?.plate_number ?? null,
    busName:     bus?.busName     ?? busInfo?.name         ?? null,
    busStatus:   bus?.status      ?? busInfo?.status       ?? null,
  }), [bus, busInfo, child, driverPhone]);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        initialRegion={initialRegion}
        toolbarEnabled={false}
        loadingEnabled
      >
        {bus && smoothCoord ? (
          <Marker
            coordinate={smoothCoord}
            title={t('tracking.driver')}
            description={bus.status}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
          />
        ) : null}

        <AnimatedRoute route={bus?.route} marker={smoothCoord} />
      </MapView>

      <SafeAreaView edges={['top']} style={[styles.topBar, contentStyle && { alignItems: 'center' }]} pointerEvents="box-none">
        <View style={[styles.topBarInner, contentStyle]}>
        {navigation?.canGoBack?.() ? (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Icon name="chevronRight" size={18} tint={colors.textPrimary} style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
        ) : <View style={styles.backBtn} />}

        <View style={styles.topCenter}>
          {child?.name ? (
            <Text style={styles.topChildName} numberOfLines={1}>{child.name}</Text>
          ) : null}
          <View style={styles.badgeRow}>
            <Badge label={t(meta.key)} tone={meta.tone} />
            <Badge label={freshLabel} tone={fresh.tone} />
          </View>
        </View>

        <View style={styles.backBtn} />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.panelWrap} pointerEvents="box-none">
        <View style={[styles.panelCap, contentStyle]}>
        <Panel
          child={child}
          bus={bus}
          eta={eta}
          driverInfo={driverInfo}
          onCall={callDriver}
          onSos={sendSos}
          t={t}
        />
        </View>
      </SafeAreaView>
    </View>
  );
}

const Panel = memo(function Panel({ child, bus, eta, driverInfo, onCall, onSos, t }) {
  const hasDriverInfo = !!(driverInfo?.name || driverInfo?.plateNumber || driverInfo?.photoUrl);

  return (
    <View style={[styles.panel, shadows.modal]}>
      {/* Drag handle */}
      <View style={styles.panelHandle} />

      {child ? (
        <View style={styles.childCard}>
          <Avatar uri={child.photoUrl} name={child.name} size={40} />
          <View style={{ flex: 1, marginStart: spacing.sm }}>
            <Text style={styles.childName} numberOfLines={1}>{child.name}</Text>
            <Text style={styles.childStatus} numberOfLines={1}>
              {child.status ?? (t ? t('tracking.onTheWayToSchool') : 'On the way to school')}
            </Text>
          </View>
        </View>
      ) : null}

      {hasDriverInfo ? (
        <DriverTrustCard info={driverInfo} onCall={onCall} t={t} />
      ) : null}

      {bus?.nextStop ? (
        <View style={styles.nextStopRow}>
          <Text style={styles.statLabel}>{t ? t('tracking.nextStop') : 'Next Stop'}</Text>
          <Text style={styles.nextStopName} numberOfLines={1}>{bus.nextStop}</Text>
        </View>
      ) : null}

      <View style={styles.statRow}>
        <Stat label={t ? t('tracking.eta') : 'ETA'}      value={formatEta(eta, t)} />
        <View style={styles.divider} />
        <Stat label={t ? t('tracking.distance') : 'Distance'} value={bus?.distanceKm != null ? `${bus.distanceKm.toFixed(1)} km` : '—'} />
        <View style={styles.divider} />
        <Stat label={t ? t('tracking.status') : 'Status'}   value={bus?.status ? (t ? t(`tracking.busStatus.${bus.status}`, { defaultValue: bus.status }) : bus.status) : '—'} />
      </View>

      <View style={styles.actions}>
        <Button
          title={t ? t('tracking.callDriver') : 'Call driver'}
          onPress={onCall}
          variant="secondary"
          iconLeft={<Icon name="phone" size={18} tint={colors.primary} />}
        />
        <View style={styles.spacer} />
        <Button
          title={t ? t('tracking.emergencySos') : 'Emergency SOS'}
          onPress={onSos}
          variant="danger"
          iconLeft={<Icon name="sos" size={18} tint={colors.textInverse} />}
        />
      </View>
    </View>
  );
});

/**
 * DriverTrustCard — surfaces who is driving the bus and which vehicle it is.
 * Builds parent confidence ("I know who has my kid") and gives a one-tap
 * call shortcut. Hidden entirely when no info is available so we never
 * render an empty placeholder.
 */
const DriverTrustCard = memo(function DriverTrustCard({ info, onCall, t }) {
  const statusKey  = info.busStatus ? String(info.busStatus).toLowerCase() : null;
  const statusTone = statusKey ? (BUS_STATUS_TONE[statusKey] ?? 'neutral') : null;
  const statusLabel = statusKey
    ? (t ? t(`tracking.busStatus.${statusKey}`, { defaultValue: statusKey.replace(/_/g, ' ') }) : statusKey.replace(/_/g, ' '))
    : null;

  return (
    <View style={styles.driverCard}>
      <Avatar uri={info.photoUrl} name={info.name || (t ? t('tracking.driver') : 'Driver')} size={44} />
      <View style={{ flex: 1, marginStart: spacing.sm }}>
        <Text style={styles.driverLabel}>{t ? t('tracking.driver') : 'Driver'}</Text>
        <Text style={styles.driverName} numberOfLines={1}>
          {info.name || (t ? t('tracking.assignedDriver') : 'Assigned driver')}
        </Text>
        {(info.plateNumber || info.busName || statusLabel) ? (
          <View style={styles.plateRow}>
            {info.plateNumber ? (
              <View style={styles.plateChip}>
                <Text style={styles.plateText} numberOfLines={1}>{info.plateNumber}</Text>
              </View>
            ) : null}
            {info.busName ? (
              <Text style={styles.busName} numberOfLines={1}>{info.busName}</Text>
            ) : null}
            {statusLabel ? (
              <Badge label={statusLabel} tone={statusTone} />
            ) : null}
          </View>
        ) : null}
      </View>
      {info.phone ? (
        <Pressable
          onPress={onCall}
          hitSlop={8}
          style={styles.callPill}
          accessibilityRole="button"
          accessibilityLabel={info.name ? (t ? t('tracking.callDriverNamed', { name: info.name }) : `Call driver ${info.name}`) : (t ? t('tracking.callDriver') : 'Call driver')}
        >
          <Icon name="phone" size={16} tint={colors.textInverse} />
        </Pressable>
      ) : null}
    </View>
  );
});

/**
 * AnimatedRoute — splits the route at the (smoothed) marker position and
 * renders two polylines so the traveled portion gradually "fills in" as
 * the bus moves. The split is recomputed whenever the smoothed coordinate
 * advances, which is throttled to ~30fps by useSmoothCoordinate.
 *
 * Off-route handling:
 *   When the marker is farther than the threshold from the planned path
 *   (set in `splitRouteAtMarker`, default 40m), `split.offRoute === true`.
 *   We then skip the split entirely and render the planned route as a
 *   single dimmed + dashed line — the parent still sees the *intended*
 *   path while the bus is on a detour, without the marker dragging the
 *   reveal point sideways across the city.
 *
 * Visual treatment (on-route):
 *   - traveled: muted + dashed, drawn first (under)
 *   - upcoming: primary + full width, drawn second (over) so the seam is hidden
 */
const AnimatedRoute = memo(function AnimatedRoute({ route, marker }) {
  const split = useMemo(() => splitRouteAtMarker(route, marker), [route, marker]);
  if (!route || route.length < 2) return null;

  // No marker yet — render the whole route as upcoming.
  if (!split) {
    return (
      <Polyline coordinates={route} strokeColor={colors.primary} strokeWidth={4} />
    );
  }

  // Off-route: render the planned route once, dimmed + dashed, so it reads
  // as "this is where we expected to be" rather than the live progress bar.
  if (split.offRoute) {
    return (
      <Polyline
        coordinates={route}
        strokeColor={colors.textSecondary}
        strokeWidth={3}
        lineDashPattern={[8, 6]}
      />
    );
  }

  return (
    <>
      {split.traveled.length >= 2 ? (
        <Polyline
          coordinates={split.traveled}
          strokeColor={colors.textSecondary}
          strokeWidth={3}
          lineDashPattern={[6, 6]}
          zIndex={1}
        />
      ) : null}
      {split.upcoming.length >= 2 ? (
        <Polyline
          coordinates={split.upcoming}
          strokeColor={colors.primary}
          strokeWidth={4}
          zIndex={2}
        />
      ) : null}
    </>
  );
});

const Stat = memo(function Stat({ label, value }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
  },
  topBarInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing.sm, paddingHorizontal: spacing.md,
    width: '100%',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.card,
  },
  topCenter: {
    flex: 1, alignItems: 'center', gap: 4,
  },
  topChildName: {
    ...typography.subtitleSm, color: colors.textPrimary, fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
  },

  panelWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center',
  },
  panelCap: {
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingBottom: layout.bottomSafe,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  panelHandle: {
    alignSelf: 'center',
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },

  statRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  divider:   { width: 1, height: 28, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  statLabel: { ...typography.caption,    color: colors.textSecondary },
  statValue: { ...typography.subtitleSm, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },

  actions: { marginTop: spacing.xs },
  spacer:  { height: spacing.xs },

  childCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  childName:   { ...typography.subtitleSm, color: colors.textPrimary, fontWeight: '700' },
  childStatus: { ...typography.bodySm,     color: colors.primary, marginTop: 2, fontWeight: '600' },

  driverCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  driverLabel: { ...typography.caption, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  driverName:  { ...typography.subtitleSm, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
  plateRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: spacing.xs },
  plateChip: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  plateText: { ...typography.caption, color: colors.textPrimary, fontWeight: '700', letterSpacing: 0.4 },
  busName:   { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  callPill: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.sm,
  },

  nextStopRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    marginBottom: spacing.sm,
  },
  nextStopName: { ...typography.subtitleSm, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
});
