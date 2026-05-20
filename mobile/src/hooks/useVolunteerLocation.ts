import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { api } from "@/api/client";
import { startBackgroundLocation, stopBackgroundLocation } from "@/tasks/backgroundLocation";

type Options = {
  enabled: boolean;
  intervalMs?: number;
};

export type LocationCoords = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export type LocationStatus = "idle" | "permission_denied" | "unavailable" | "tracking" | "error";

/**
 * Foreground + background volunteer location tracker.
 * While `enabled` is true:
 *  - Foreground: watches position for UI updates
 *  - Background: starts expo-task-manager location updates so tracking
 *    continues even when the app is minimized.
 *
 * Pushes updates to `/api/volunteer/location` at most once per `intervalMs`.
 */
export function useVolunteerLocation({ enabled, intervalMs = 30_000 }: Options) {
  const [coords, setCoords] = useState<LocationCoords | null>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const lastPushRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        setError(null);
        const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (permStatus !== "granted") {
          setStatus("permission_denied");
          return;
        }

        const services = await Location.hasServicesEnabledAsync();
        if (!services) {
          setStatus("unavailable");
          return;
        }

        // Start background location (continues when app is minimized)
        const bgStarted = await startBackgroundLocation();
        if (!bgStarted) {
          console.log("[Location] Background location not started — continuing with foreground only");
        }

        watcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: intervalMs,
            distanceInterval: 10,
          },
          (pos) => {
            if (cancelled) return;
            const next: LocationCoords = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp,
            };
            setCoords(next);

            const now = Date.now();
            if (now - lastPushRef.current >= intervalMs) {
              lastPushRef.current = now;
              api
                .updateVolunteerLocation(next.latitude, next.longitude)
                .catch((e) => setError(e instanceof Error ? e.message : "Failed to push location"));
            }
          },
        );
        setStatus("tracking");
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setError(e instanceof Error ? e.message : "Location error");
        }
      }
    }

    async function stop() {
      watcherRef.current?.remove();
      watcherRef.current = null;
      await stopBackgroundLocation();
    }

    if (enabled) {
      start();
    } else {
      stop();
      setStatus("idle");
    }

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, intervalMs]);

  return { coords, status, error };
}

/**
 * One-shot helper: request permission, return current location once.
 * Useful for "drop pin at my location" flows.
 */
export async function getCurrentLocationOnce(): Promise<LocationCoords | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    timestamp: pos.timestamp,
  };
}
