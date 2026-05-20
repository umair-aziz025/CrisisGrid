import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, {
  Heatmap,
  MapPressEvent,
  Marker,
  PROVIDER_GOOGLE,
  Polyline,
  Region,
} from "react-native-maps";
import {
  Crosshair,
  ExternalLink,
  Flame,
  Layers,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Users,
} from "lucide-react-native";

import { CRISIS_META, CrisisRequest, STATUS_META } from "@/utils/crisis";
import { getCurrentLocationOnce } from "@/hooks/useVolunteerLocation";
import { radius, spacing, typography, ColorPalette } from "@/theme";
import { useStyles, useTheme } from "@/theme/ThemeProvider";

export type CrisisMapHandle = {
  animateTo: (lat: number, lng: number) => void;
  fitToCoords: (coords: { latitude: number; longitude: number }[]) => void;
};

export type RouteSegment = {
  /** Ordered polyline points. Empty array hides the route. */
  points: { latitude: number; longitude: number }[];
  /** Total distance in meters (for the overlay). */
  distanceM?: number;
  /** Estimated travel time in seconds (for the overlay). */
  durationSec?: number;
  /** Stroke color, defaults to the brand crisisRescue blue. */
  color?: string;
  /** Whether to render this as a primary (solid) or alternative (dashed) route. */
  primary?: boolean;
};

type Props = {
  requests: CrisisRequest[];
  myCoords?: { latitude: number; longitude: number } | null;
  onMapPress?: (lat: number, lng: number) => void;
  onMarkerPress?: (request: CrisisRequest) => void;
  pin?: { lat: number; lng: number; label?: string } | null;
  initialRegion?: Region;
  height?: number | "100%";
  fallback?: boolean;
  /**
   * Live volunteer pins to display. The map shows them as small green
   * dots and animates as updates flow in.
   */
  volunteers?: { id: string | number; lat: number; lng: number; name?: string }[];
  /**
   * Routes to render as Polylines. The first one is treated as the
   * primary route (solid). Additional segments are alternatives (semi-transparent).
   */
  routes?: RouteSegment[];
  /**
   * Toggleable controls overlaid on the top-right of the map. Set
   * `false` to hide all controls.
   */
  controls?: boolean;
  /**
   * Show a heatmap layer derived from the requests array. Only the
   * Google provider supports heatmaps.
   */
  heatmapEnabled?: boolean;
  /**
   * If a destination is supplied, the bottom of the map renders an
   * "Open in Maps" button that deep-links into the device's default
   * navigation app for turn-by-turn directions.
   */
  externalNav?: { lat: number; lng: number; label?: string } | null;
  /**
   * Optional callback invoked when the user fetches their device location
   * via the recenter button. The map automatically animates to it; the
   * parent can sync state (e.g. to remember `myCoords`).
   */
  onMyLocation?: (coords: { latitude: number; longitude: number }) => void;
};

const DEFAULT_REGION: Region = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type MapType = "standard" | "satellite" | "hybrid" | "terrain";

function nextMapType(prev: MapType): MapType {
  if (prev === "standard") return "satellite";
  if (prev === "satellite") return "hybrid";
  if (prev === "hybrid") return "terrain";
  return "standard";
}

function mapTypeLabel(t: MapType): string {
  if (t === "satellite") return "Satellite";
  if (t === "hybrid") return "Hybrid";
  if (t === "terrain") return "Terrain";
  return "Map";
}

/** Simple distance-based clustering for request markers. */
function clusterRequests(
  requests: CrisisRequest[],
  region: Region,
  mapWidth: number,
  mapHeight: number,
  clusterRadiusPx = 48,
): Array<
  | { kind: "cluster"; count: number; lat: number; lng: number; requests: CrisisRequest[] }
  | { kind: "single"; request: CrisisRequest }
> {
  if (requests.length < 2) return requests.map((r) => ({ kind: "single" as const, request: r }));

  const pxPerLat = mapHeight / region.latitudeDelta;
  const pxPerLng = mapWidth / region.longitudeDelta;

  const clusters: Array<{ count: number; latSum: number; lngSum: number; requests: CrisisRequest[] }> = [];

  for (const req of requests) {
    let added = false;
    for (const c of clusters) {
      const centerLat = c.latSum / c.count;
      const centerLng = c.lngSum / c.count;
      const dy = Math.abs(req.lat - centerLat) * pxPerLat;
      const dx = Math.abs(req.lng - centerLng) * pxPerLng;
      if (Math.sqrt(dx * dx + dy * dy) < clusterRadiusPx) {
        c.count++;
        c.latSum += req.lat;
        c.lngSum += req.lng;
        c.requests.push(req);
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push({ count: 1, latSum: req.lat, lngSum: req.lng, requests: [req] });
    }
  }

  return clusters.map((c) =>
    c.count === 1
      ? { kind: "single" as const, request: c.requests[0] }
      : {
          kind: "cluster" as const,
          count: c.count,
          lat: c.latSum / c.count,
          lng: c.lngSum / c.count,
          requests: c.requests,
        },
  );
}

export const CrisisMap = forwardRef<CrisisMapHandle, Props>(function CrisisMap(
  {
    requests,
    myCoords,
    onMapPress,
    onMarkerPress,
    pin,
    initialRegion,
    height = 320,
    fallback = false,
    volunteers,
    routes,
    controls = true,
    heatmapEnabled = false,
    externalNav = null,
    onMyLocation,
  },
  ref,
) {
  const { palette } = useTheme();
  const styles = useStyles((c) => makeStyles(c));
  const mapRef = useRef<MapView | null>(null);
  const [mapType, setMapType] = useState<MapType>("standard");

  const [showHeatmap, setShowHeatmap] = useState(heatmapEnabled);
  const [clusterEnabled, setClusterEnabled] = useState(false);
  const [locating, setLocating] = useState(false);
  const [region, setRegion] = useState<Region>(initialRegion || DEFAULT_REGION);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  const regionMemo = useMemo<Region>(() => {
    if (initialRegion) return initialRegion;
    if (myCoords) {
      return {
        latitude: myCoords.latitude,
        longitude: myCoords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    if (requests.length > 0) {
      const r = requests[0];
      return {
        latitude: r.lat,
        longitude: r.lng,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }
    return DEFAULT_REGION;
  }, [initialRegion, myCoords, requests]);

  useImperativeHandle(ref, () => ({
    animateTo: (lat: number, lng: number) => {
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        500,
      );
    },
    fitToCoords: (coords) => {
      if (!coords.length) return;
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
        animated: true,
      });
    },
  }));

  if (fallback) {
    return (
      <View style={[styles.fallback, { height }]}>
        <Crosshair size={26} color={palette.crisisRescue} />
        <Text style={styles.fallbackTitle}>Map unavailable</Text>
        <Text style={styles.fallbackBody}>
          Configure Google Maps API keys in app.json (ios.config.googleMapsApiKey,
          android.config.googleMaps.apiKey) to enable the live map.
        </Text>
      </View>
    );
  }

  const handlePress = (e: MapPressEvent) => {
    const c = e.nativeEvent.coordinate;
    onMapPress?.(c.latitude, c.longitude);
  };

  const cycleMapType = () => setMapType((prev) => nextMapType(prev));

  const zoomBy = useCallback(
    (factor: number) => {
      const nextLatDelta = Math.max(0.0005, Math.min(170, region.latitudeDelta * factor));
      const nextLngDelta = Math.max(0.0005, Math.min(170, region.longitudeDelta * factor));
      mapRef.current?.animateToRegion(
        {
          latitude: region.latitude,
          longitude: region.longitude,
          latitudeDelta: nextLatDelta,
          longitudeDelta: nextLngDelta,
        },
        250,
      );
    },
    [region],
  );

  const resetBearing = useCallback(async () => {
    try {
      const cam: any = await mapRef.current?.getCamera();
      if (!cam) return;
      mapRef.current?.animateCamera({ ...cam, heading: 0, pitch: 0 }, { duration: 250 });
    } catch {
      /* best-effort */
    }
  }, []);

  const recenterToMe = useCallback(async () => {
    setLocating(true);
    try {
      const c = await getCurrentLocationOnce();
      if (!c) return;
      mapRef.current?.animateToRegion(
        {
          latitude: c.latitude,
          longitude: c.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500,
      );
      onMyLocation?.({ latitude: c.latitude, longitude: c.longitude });
    } finally {
      setLocating(false);
    }
  }, [onMyLocation]);

  const openExternalNav = () => {
    if (!externalNav) return;
    const { lat, lng, label } = externalNav;
    const dest = `${lat},${lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      const fallbackUrl = `geo:${lat},${lng}?q=${dest}(${encodeURIComponent(label || "Destination")})`;
      Linking.openURL(fallbackUrl).catch(() => undefined);
    });
  };

  const heatmapPoints =
    showHeatmap && Platform.OS === "android"
      ? requests
          .filter((r) => r.status === "QUEUED")
          .map((r) => ({
            latitude: r.lat,
            longitude: r.lng,
            weight: 2,
          }))
      : [];

  const primaryRoute = routes?.find((r) => r.primary !== false);

  const clustered = useMemo(() => {
    if (!clusterEnabled || mapSize.width === 0 || mapSize.height === 0) {
      return requests.map((r) => ({ kind: "single" as const, request: r }));
    }
    return clusterRequests(requests, region, mapSize.width, mapSize.height);
  }, [clusterEnabled, requests, region, mapSize.width, mapSize.height]);

  return (
    <View
      style={[styles.wrapper, { height }]}
      collapsable={false}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setMapSize({ width, height });
      }}
    >
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        mapType={mapType}
        initialRegion={regionMemo}
        onPress={handlePress}
        showsUserLocation={!!myCoords}
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled
        pitchEnabled
        onRegionChangeComplete={(r) => setRegion(r)}
      >
        {showHeatmap && Platform.OS === "android" && heatmapPoints.length > 0 ? (
          <Heatmap
            points={heatmapPoints}
            radius={50}
            opacity={0.7}
            gradient={{
              colors: ["#2BB3F2", "#F2A325", "#F23B3B"],
              startPoints: [0.1, 0.4, 0.8],
              colorMapSize: 256,
            }}
          />
        ) : null}

        {(routes || []).map((seg, idx) => {
          if (!seg.points.length) return null;
          const isPrimary = seg.primary !== false;
          return (
            <Polyline
              key={`route-${idx}`}
              coordinates={seg.points}
              strokeColor={seg.color || palette.crisisRescue}
              strokeWidth={isPrimary ? 6 : 4}
              lineCap="round"
              lineJoin="round"
              geodesic
              {...(isPrimary ? {} : { lineDashPattern: [10, 8] })}
            />
          );
        })}

        {clustered.map((item, idx) => {
          if (item.kind === "cluster") {
            const topStatus = item.requests.some((r) => r.status === "QUEUED")
              ? "QUEUED"
              : item.requests.some((r) => r.status === "ACTIVE")
              ? "ACTIVE"
              : item.requests[0]?.status || "ACTIVE";
            const statusMeta = STATUS_META[topStatus] || STATUS_META.ACTIVE;
            return (
              <Marker
                key={`cluster-${idx}`}
                coordinate={{ latitude: item.lat, longitude: item.lng }}
                onPress={() => {
                  // Zoom in to expand cluster
                  mapRef.current?.animateToRegion(
                    {
                      latitude: item.lat,
                      longitude: item.lng,
                      latitudeDelta: Math.max(0.005, region.latitudeDelta / 2),
                      longitudeDelta: Math.max(0.005, region.longitudeDelta / 2),
                    },
                    350,
                  );
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={[styles.clusterWrap, { borderColor: statusMeta.color }]}>
                  <Text style={styles.clusterCount}>{item.count}</Text>
                  <Users size={12} color={statusMeta.color} />
                </View>
              </Marker>
            );
          }

          const r = item.request;
          const meta = CRISIS_META[r.type] || CRISIS_META.rescue;
          const statusMeta = STATUS_META[r.status] || STATUS_META.ACTIVE;
          const Icon = meta.icon;
          const isUnclaimed = r.status === "QUEUED" || r.status === "ACTIVE";
          return (
            <Marker
              key={r.id}
              coordinate={{ latitude: r.lat, longitude: r.lng }}
              onPress={() => onMarkerPress?.(r)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              title={isUnclaimed ? `⚡ ${meta.label} (Tap to claim)` : meta.label}
              description={r.description}
            >
              <View style={[styles.markerWrap, { borderColor: meta.color, opacity: isUnclaimed ? 1 : 0.6 }]}>
                <Icon size={16} color={meta.color} />
                <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
              </View>
            </Marker>
          );
        })}

        {(volunteers || []).map((v) => (
          <Marker
            key={`v-${v.id}`}
            coordinate={{ latitude: v.lat, longitude: v.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            title={v.name || "Volunteer"}
          >
            <View style={styles.volunteerWrap}>
              <View style={styles.volunteerDot} />
              <View style={styles.volunteerPulse} />
            </View>
          </Marker>
        ))}

        {pin ? (
          <Marker
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <View style={styles.pinDrop}>
              <View style={styles.pinHead} />
              <View style={styles.pinTail} />
            </View>
          </Marker>
        ) : null}
      </MapView>

      {controls ? (
        <View style={styles.controls} pointerEvents="box-none">
          <Pressable onPress={cycleMapType} style={styles.controlBtn} hitSlop={6}>
            <Layers size={16} color={palette.foreground} />
            <Text style={styles.controlText}>{mapTypeLabel(mapType)}</Text>
          </Pressable>

          {Platform.OS === "android" ? (
            <Pressable
              onPress={() => setShowHeatmap((v) => !v)}
              style={[styles.controlBtn, showHeatmap && styles.controlBtnActive]}
              hitSlop={6}
            >
              <Flame
                size={16}
                color={showHeatmap ? palette.crisisFoodWater : palette.foreground}
              />
              <Text
                style={[
                  styles.controlText,
                  showHeatmap && { color: palette.crisisFoodWater, fontWeight: "700" },
                ]}
              >
                Heat
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setClusterEnabled((v) => !v)}
            style={[styles.controlBtn, clusterEnabled && styles.controlBtnActive]}
            hitSlop={6}
          >
            <Users
              size={16}
              color={clusterEnabled ? palette.crisisRescue : palette.foreground}
            />
            <Text
              style={[
                styles.controlText,
                clusterEnabled && { color: palette.crisisRescue, fontWeight: "700" },
              ]}
            >
              Cluster
            </Text>
          </Pressable>

          <Pressable
            onPress={recenterToMe}
            disabled={locating}
            style={[styles.controlBtn, locating && { opacity: 0.6 }]}
            hitSlop={6}
            accessibilityLabel="Center map on my location"
          >
            <LocateFixed size={16} color={palette.crisisRescue} />
          </Pressable>

        </View>
      ) : null}

      {controls ? (
        <View style={styles.zoomControls} pointerEvents="box-none">
          <Pressable
            onPress={() => zoomBy(0.6)}
            style={[styles.zoomBtn, { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md }]}
            hitSlop={6}
            accessibilityLabel="Zoom in"
          >
            <Plus size={18} color={palette.foreground} />
          </Pressable>
          <View style={styles.zoomDivider} />
          <Pressable
            onPress={() => zoomBy(1.6)}
            style={[styles.zoomBtn, { borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md }]}
            hitSlop={6}
            accessibilityLabel="Zoom out"
          >
            <Minus size={18} color={palette.foreground} />
          </Pressable>
        </View>
      ) : null}

      {onMapPress ? (
        <View style={styles.tapHint} pointerEvents="none">
          <View style={styles.tapHintInner}>
            <MapPin size={12} color={palette.foreground} />
            <Text style={styles.tapHintText}>Tap the map to drop a pin</Text>
          </View>
        </View>
      ) : null}

      {primaryRoute && (primaryRoute.distanceM != null || primaryRoute.durationSec != null) ? (
        <View style={styles.routeOverlay} pointerEvents="none">
          <Navigation size={14} color={palette.crisisRescue} />
          <Text style={styles.routeText}>
            {primaryRoute.distanceM != null ? formatDistance(primaryRoute.distanceM) : "—"} •{" "}
            {primaryRoute.durationSec != null ? formatDuration(primaryRoute.durationSec) : "—"}
          </Text>
        </View>
      ) : null}

      {externalNav ? (
        <Pressable onPress={openExternalNav} style={styles.externalBtn}>
          <ExternalLink size={14} color="#03121C" />
          <Text style={styles.externalText}>Open in Maps</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function formatDuration(sec: number): string {
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins - hrs * 60}m`;
}

/** Haversine distance in meters between two coords. */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
    wrapper: {
      width: "100%",
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceGlassBorder,
    },
    fallback: {
      width: "100%",
      borderRadius: radius.lg,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceGlassBorder,
      padding: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    fallbackTitle: { ...typography.h3, color: c.foreground },
    fallbackBody: { ...typography.small, color: c.mutedForeground, textAlign: "center" },

    markerWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceElevated,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    statusDot: {
      position: "absolute",
      top: -2,
      right: -2,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: c.surfaceElevated,
    },

    clusterWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surfaceElevated,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 2,
    },
    clusterCount: { ...typography.small, color: c.foreground, fontWeight: "700", fontSize: 13 },

    volunteerWrap: { alignItems: "center", justifyContent: "center", width: 28, height: 28 },
    volunteerDot: {
      position: "absolute",
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: c.statusClaimed,
      borderWidth: 2,
      borderColor: "#fff",
      zIndex: 2,
    },
    volunteerPulse: {
      position: "absolute",
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "rgba(49, 168, 101, 0.25)",
      borderWidth: 1,
      borderColor: "rgba(49, 168, 101, 0.5)",
    },

    pinDrop: { alignItems: "center" },
    pinHead: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: c.crisisRescue,
      borderWidth: 2,
      borderColor: "#fff",
    },
    pinTail: {
      width: 0,
      height: 0,
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderTopWidth: 8,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      borderTopColor: c.crisisRescue,
      marginTop: -2,
    },

    controls: {
      position: "absolute",
      top: spacing.sm,
      right: spacing.sm,
      gap: spacing.xs,
    },
    controlBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.borderStrong,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    controlBtnActive: {
      borderColor: c.crisisFoodWater,
    },
    controlText: { ...typography.caption, color: c.foreground, textTransform: "none", fontWeight: "600" },

    zoomControls: {
      position: "absolute",
      bottom: spacing.xl,
      left: spacing.sm,
      backgroundColor: c.surfaceElevated,
      borderColor: c.borderStrong,
      borderWidth: 1,
      borderRadius: radius.md,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    zoomBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    zoomDivider: {
      height: 1,
      backgroundColor: c.border,
    },

    tapHint: {
      position: "absolute",
      top: spacing.sm,
      left: 0,
      right: 0,
      alignItems: "center",
    },
    tapHintInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: c.surfaceElevated,
      borderColor: c.borderStrong,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    tapHintText: { ...typography.caption, color: c.foreground, textTransform: "none" },

    routeOverlay: {
      position: "absolute",
      top: spacing.sm,
      left: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: c.crisisRescue,
    },
    routeText: { ...typography.small, color: c.foreground, fontWeight: "700" },

    externalBtn: {
      position: "absolute",
      bottom: spacing.md,
      right: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: c.crisisRescue,
    },
    externalText: { ...typography.small, color: "#03121C", fontWeight: "700" },
  });
