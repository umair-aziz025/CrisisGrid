import Constants from "expo-constants";
import { haversineMeters } from "@/components/CrisisMap";

export type LatLng = { latitude: number; longitude: number };
export type DirectionsRoute = {
  points: LatLng[];
  distanceM: number;
  durationSec: number;
  /** "google" if returned by the Directions API, "straight" if a fallback polyline. */
  source: "google" | "straight";
};

const GOOGLE_DIRECTIONS_KEY: string | undefined =
  process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY ||
  (Constants.expoConfig?.extra as { googleDirectionsKey?: string } | undefined)?.googleDirectionsKey;

/**
 * Decode a Google encoded-polyline string into a list of lat/lng coords.
 * Reference: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

/**
 * Resolve a route between two coords. If a Google Directions key is
 * configured, returns the actual driving polyline plus alternatives;
 * otherwise falls back to a straight line + Haversine distance and a
 * 40 km/h average-speed ETA so the map remains usable in development.
 */
export async function getDirections(
  origin: LatLng,
  destination: LatLng,
  opts: { mode?: "driving" | "walking"; alternatives?: boolean } = {},
): Promise<DirectionsRoute[]> {
  const mode = opts.mode || "driving";

  if (!GOOGLE_DIRECTIONS_KEY) {
    return [straightLineRoute(origin, destination, mode)];
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${origin.latitude},${origin.longitude}` +
      `&destination=${destination.latitude},${destination.longitude}` +
      `&mode=${mode}` +
      (opts.alternatives ? `&alternatives=true` : "") +
      `&key=${GOOGLE_DIRECTIONS_KEY}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Directions HTTP ${res.status}`);
    const json = await res.json();
    if (json.status !== "OK" || !json.routes?.length) {
      throw new Error(`Directions ${json.status}`);
    }

    return json.routes.map((r: any) => ({
      points: decodePolyline(r.overview_polyline.points),
      distanceM: r.legs?.[0]?.distance?.value ?? 0,
      durationSec: r.legs?.[0]?.duration?.value ?? 0,
      source: "google" as const,
    }));
  } catch {
    return [straightLineRoute(origin, destination, mode)];
  }
}

function straightLineRoute(origin: LatLng, destination: LatLng, mode: "driving" | "walking"): DirectionsRoute {
  const distanceM = haversineMeters(origin, destination);
  // Reasonable travel speeds when we don't have a directions API answer.
  const metersPerSec = mode === "walking" ? 1.4 : 11.1; // ~5 km/h vs ~40 km/h
  return {
    points: [origin, destination],
    distanceM,
    durationSec: distanceM / metersPerSec,
    source: "straight",
  };
}
