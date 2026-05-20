import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import App from './App';

// ── Ensure Android notification channels exist in background/headless context ──
// These must match the channels set up in useFCMNotifications.ts
async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('crisisgrid-alerts', {
      name: 'CrisisGrid Critical Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300, 200, 300],
      lightColor: '#2BB3F2',
      sound: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      bypassDnd: true,
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync('crisisgrid-default', {
      name: 'CrisisGrid Standard',
      importance: Notifications.AndroidImportance.HIGH,
      sound: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      showBadge: true,
    });
  } catch (e) {
    console.log('[FCM] Background channel setup error:', e);
  }
}

// ── Background / killed-state message handler ────────────────────────────────
// This runs in a headless JS environment before the app is mounted.
//
// • If the FCM message has a `notification` payload, Android FCM will display
//   it automatically — no extra work needed.
// • If the message is data-only (no `notification` payload), we must schedule
//   a local notification ourselves so it appears in the tray and lock screen.

messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[FCM] Background message received:', remoteMessage.notification?.title ?? '(data-only)');

  // Only manually show a notification for data-only messages.
  // Notification-payload messages are handled automatically by the OS.
  if (!remoteMessage.notification) {
    const data = remoteMessage.data || {};
    const title = String(data.title || 'CrisisGrid Alert');
    const body = String(data.body || data.message || '');

    await ensureChannels();

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        // @ts-ignore
        channelId: 'crisisgrid-alerts',
      },
      trigger: null,
    });
  }
});

// Register the app
registerRootComponent(App);
