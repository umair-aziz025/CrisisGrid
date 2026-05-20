import { useEffect, useRef, useState, useCallback } from "react";
import messaging from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "@/api/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";

// ── Notification handler ────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Deep link handler reference ─────────────────────────────────────────────

let globalNavigationRef: any = null;

export function setNotificationNavigationRef(ref: any) {
  globalNavigationRef = ref;
}

function getNavigationRef() {
  return globalNavigationRef;
}

// ── Types ───────────────────────────────────────────────────────────────────

export type NotificationPayload = {
  type?: string;
  requestId?: string;
  crisisLat?: number;
  crisisLng?: number;
  agentDispatched?: boolean;
  claimedBy?: string;
  responderCount?: number;
  [key: string]: any;
};

// ── Navigation from notification data ───────────────────────────────────────

function navigateFromNotification(data: NotificationPayload) {
  const nav = getNavigationRef();
  if (!nav || !nav.isReady?.()) {
    pendingNavigationData = data;
    return;
  }

  const { type, requestId } = data;
  try {
    switch (type) {
      case "new_crisis":
      case "crisis_claimed":
      case "agent_dispatch":
      case "priority_alert":
        if (requestId) {
          nav.navigate("Tabs", { screen: "Dashboard", params: { highlightRequestId: requestId } });
        }
        break;
      case "crisis_resolved":
      case "task_cancelled":
        nav.navigate("Tabs", { screen: "Requests" });
        break;
      default:
        nav.navigate("Tabs", { screen: "Dashboard" });
    }
  } catch (e) {
    console.error("[FCM] Navigation error:", e);
  }
}

let pendingNavigationData: NotificationPayload | null = null;

export function processPendingNavigation() {
  if (pendingNavigationData) {
    navigateFromNotification(pendingNavigationData);
    pendingNavigationData = null;
  }
}

// ── Badge management ────────────────────────────────────────────────────────

async function incrementBadge() {
  const current = await Notifications.getBadgeCountAsync();
  await Notifications.setBadgeCountAsync(current + 1);
}

async function clearBadge() {
  await Notifications.setBadgeCountAsync(0);
}

// ── Setup Android notification channels ─────────────────────────────────────
// IMPORTANT: On Android, once a notification channel is created its sound/vibration
// settings are locked by the OS. We delete and recreate to ensure settings apply.
// sound: true  → use the device's default notification ringtone
// sound: false → silent

export async function setupAndroidChannels() {
  if (Platform.OS !== "android") return;

  await Notifications.deleteNotificationChannelAsync("crisisgrid-alerts").catch(() => {});
  await Notifications.deleteNotificationChannelAsync("crisisgrid-default").catch(() => {});

  await Notifications.setNotificationChannelAsync("crisisgrid-alerts", {
    name: "CrisisGrid Critical Alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300, 200, 300],
    lightColor: "#2BB3F2",
    sound: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
    bypassDnd: true,
    showBadge: true,
  });

  await Notifications.setNotificationChannelAsync("crisisgrid-default", {
    name: "CrisisGrid Standard",
    importance: Notifications.AndroidImportance.HIGH,
    sound: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
    showBadge: true,
  });

  console.log("[FCM] Android notification channels created");
}

// ── Main hook ───────────────────────────────────────────────────────────────

export function useFCMNotifications() {
  const { user } = useAuth();
  const toast = useToast();
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<NotificationPayload | null>(null);

  // Register FCM token
  const registerToken = useCallback(async () => {
    if (!user) return;

    try {
      // Request permission (Android 13+ requires POST_NOTIFICATIONS)
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log("[FCM] Notification permission not granted");
        toast.error("Push notifications disabled. Check app permissions in Settings.");
        return;
      }

      // Register device for remote messages (required on Android)
      await messaging().registerDeviceForRemoteMessages();

      // Get FCM token
      const token = await messaging().getToken();
      console.log("[FCM] Got FCM token:", token.slice(0, 30) + "...");

      // Register with server
      await api.registerPushToken(token);
      setFcmToken(token);
      console.log("[FCM] Token registered with server");

      // Setup Android channels (recreated so sound settings always apply)
      await setupAndroidChannels();
    } catch (e: any) {
      console.error("[FCM] Registration failed:", e?.message);
      toast.error("Push notification setup failed: " + (e?.message || "Unknown error"));
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user) {
      clearBadge();
      return;
    }

    // Register token on mount
    registerToken();

    // Listen for token refresh
    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (newToken) => {
      console.log("[FCM] Token refreshed:", newToken.slice(0, 30) + "...");
      setFcmToken(newToken);
      try {
        await api.registerPushToken(newToken);
        console.log("[FCM] Refreshed token registered");
      } catch (e) {
        console.error("[FCM] Failed to register refreshed token:", e);
      }
    });

    // Foreground message handler
    // FCM messages received while app is open don't auto-display; we must
    // schedule a local notification manually so they appear in the tray.
    const unsubscribeMessage = messaging().onMessage(async (remoteMessage) => {
      console.log("[FCM] Foreground message:", JSON.stringify(remoteMessage.data));
      const data = remoteMessage.data as NotificationPayload;
      setLastNotification(data);
      incrementBadge();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification?.title || "CrisisGrid Alert",
          body: remoteMessage.notification?.body || "",
          data,
          // sound and vibration are controlled by the channel; setting sound
          // here to true ensures it also works on iOS foreground
          sound: true,
          // @ts-ignore – expo-notifications accepts channelId in content
          channelId: "crisisgrid-alerts",
        },
        trigger: null,
      });

      toast.info(remoteMessage.notification?.title || "New notification");
    });

    // App opened from killed state by tapping a notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log("[FCM] App opened from killed state:", JSON.stringify(remoteMessage.data));
          const data = remoteMessage.data as NotificationPayload;
          setLastNotification(data);
          clearBadge();
          navigateFromNotification(data);
        }
      });

    // App opened from background state by tapping a notification
    const unsubscribeBackground = messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log("[FCM] App opened from background:", JSON.stringify(remoteMessage.data));
      const data = remoteMessage.data as NotificationPayload;
      setLastNotification(data);
      clearBadge();
      navigateFromNotification(data);
    });

    return () => {
      unsubscribeTokenRefresh();
      unsubscribeMessage();
      unsubscribeBackground();
    };
  }, [user, registerToken, toast]);

  // Unregister on sign out
  useEffect(() => {
    if (!user && fcmToken) {
      api.unregisterPushToken(fcmToken).catch(() => {});
      setFcmToken(null);
      clearBadge();
    }
  }, [user, fcmToken]);

  return { fcmToken, lastNotification };
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Clear all delivered notifications from the notification panel.
 */
export async function clearDeliveredNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}
