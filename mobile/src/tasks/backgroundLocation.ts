import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { api } from "@/api/client";

export const LOCATION_TASK_NAME = "crisisgrid-background-location";

/**
 * Define the background location task.
 * This runs even when the app is minimized/killed (OS-dependent).
 */
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error("[BG Location] Task error:", error);
    return;
  }
  if (data) {
    const { locations } = data;
    const loc = locations?.[0];
    if (loc) {
      try {
        await api.updateVolunteerLocation(loc.coords.latitude, loc.coords.longitude);
        console.log("[BG Location] Pushed:", loc.coords.latitude, loc.coords.longitude);
      } catch (e) {
        console.error("[BG Location] Push failed:", e);
      }
    }
  }
});

/**
 * Start background location updates.
 * Requires background location permission to be granted.
 */
export async function startBackgroundLocation(): Promise<boolean> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) return true;

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== "granted") {
    console.log("[BG Location] Background permission denied");
    return false;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30_000,
    distanceInterval: 50,
    foregroundService: {
      notificationTitle: "CrisisGrid On Duty",
      notificationBody: "Sharing live location for emergency dispatch",
      notificationColor: "#2BB3F2",
    },
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
  });
  console.log("[BG Location] Started");
  return true;
}

/**
 * Stop background location updates.
 */
export async function stopBackgroundLocation(): Promise<void> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log("[BG Location] Stopped");
  }
}
