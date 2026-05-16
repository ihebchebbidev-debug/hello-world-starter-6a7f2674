import React, { memo, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from './Icon';
import useSmoothCoordinate from '../hooks/useSmoothCoordinate';
import { colors, radius, spacing, typography } from '../theme';

// Centred on the Ariana/El Menzah simulation route.
const DEFAULT_REGION = {
  latitude: 36.8512,
  longitude: 10.2080,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

// Quantize to ~110m so tiny GPS jitter doesn't force re-renders.
const Q = 1e3;
const q = (n) => (n == null ? null : Math.round(n * Q) / Q);

/**
 * Memoized polyline — only re-renders when the quantized path actually changes.
 */
const RoutePolyline = memo(
  function RoutePolyline({ coordinates }) {
    if (!coordinates || coordinates.length < 2) return null;
    return (
      <Polyline
        coordinates={coordinates}
        strokeColor={colors.primary}
        strokeWidth={3}
      />
    );
  },
  (prev, next) => {
    const a = prev.coordinates, b = next.coordinates;
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    if (a.length === 0) return true;
    const a0 = a[0], b0 = b[0];
    const aN = a[a.length - 1], bN = b[b.length - 1];
    return (
      q(a0.latitude)  === q(b0.latitude)  &&
      q(a0.longitude) === q(b0.longitude) &&
      q(aN.latitude)  === q(bN.latitude)  &&
      q(aN.longitude) === q(bN.longitude)
    );
  },
);

/**
 * MiniMap — non-interactive snapshot for the Home screen.
 * Tapping it routes to the full Tracking screen.
 */
function MiniMap({ bus, onPress }) {
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const mapHeight = Math.round(Math.min(220, Math.max(140, screenWidth * 0.38)));
  const qLat = q(bus?.lat);
  const qLng = q(bus?.lng);

  const region = useMemo(() => {
    if (qLat == null || qLng == null) return DEFAULT_REGION;
    return { latitude: qLat, longitude: qLng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  }, [qLat, qLng]);

  const smoothCoord = useSmoothCoordinate(
    bus?.lat != null && bus?.lng != null ? { lat: bus.lat, lng: bus.lng } : null,
    { durationMs: 2500, maxDurationMs: 4000 },
  );

  return (
    <Pressable
      onPress={onPress}
      style={[styles.wrap, { height: mapHeight }]}
      accessibilityRole="button"
      accessibilityLabel={t('map.openTracking')}
    >
      <MapView
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFillObject}
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        pointerEvents="none"
      >
        {smoothCoord ? (
          <Marker coordinate={smoothCoord} title={t('tracking.driver')} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }} flat />
        ) : null}
        <RoutePolyline coordinates={bus?.route} />
      </MapView>

      <View style={styles.cta}>
        <Text style={styles.ctaText}>{t('map.trackLive')}</Text>
        <Icon name="chevronRight" size={14} tint={colors.textInverse} />
      </View>
    </Pressable>
  );
}

export default memo(MiniMap, (prev, next) => {
  if (prev.onPress !== next.onPress) return false;
  const a = prev.bus, b = next.bus;
  if (a === b) return true;
  if (!a || !b) return a === b;
  const ar = a.route, br = b.route;
  let sameRoute = ar === br;
  if (!sameRoute) {
    const aLen = ar?.length || 0;
    const bLen = br?.length || 0;
    if (aLen === bLen) {
      if (aLen === 0) sameRoute = true;
      else {
        const a0 = ar[0], aN = ar[aLen - 1];
        const b0 = br[0], bN = br[bLen - 1];
        sameRoute =
          q(a0?.latitude)  === q(b0?.latitude)  &&
          q(a0?.longitude) === q(b0?.longitude) &&
          q(aN?.latitude)  === q(bN?.latitude)  &&
          q(aN?.longitude) === q(bN?.longitude);
      }
    }
  }
  return q(a.lat) === q(b.lat) && q(a.lng) === q(b.lng) && sameRoute;
});

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  cta: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaText: { ...typography.bodySm, color: colors.textInverse, fontWeight: '600' },
});
