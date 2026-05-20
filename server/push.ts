import { Expo } from "expo-server-sdk";
import { db } from "./firebase.js";
import { getMessaging } from "firebase-admin/messaging";

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

// ── Firestore-backed push token persistence ─────────────────────────────────

const TOKENS_COLLECTION = "pushTokens";
const NOTIFICATION_LOG_COLLECTION = "notificationLogs";

interface PushTokenDoc {
  email: string;
  tokens: string[];
  role?: string;
  updatedAt: string;
}

async function getTokenDocRef(email: string) {
  return db().collection(TOKENS_COLLECTION).doc(email.toLowerCase().trim());
}

async function getTokenDoc(email: string): Promise<PushTokenDoc | null> {
  const ref = await getTokenDocRef(email);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return snap.data() as PushTokenDoc;
}

/**
 * Register a push token for a user. Persists to Firestore.
 * Also stores the user's role for targeted notifications.
 */
export async function registerPushToken(
  email: string,
  token: string,
  role?: string
): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const ref = db().collection(TOKENS_COLLECTION).doc(normalizedEmail);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing: PushTokenDoc = snap.exists
      ? (snap.data() as PushTokenDoc)
      : { email: normalizedEmail, tokens: [], updatedAt: new Date().toISOString() };

    if (!existing.tokens.includes(token)) {
      existing.tokens.push(token);
    }
    existing.updatedAt = new Date().toISOString();
    if (role) existing.role = role;

    tx.set(ref, existing);
  });

  console.log(`[Push] Registered token for ${normalizedEmail} (${role || "unknown role"})`);
  return true;
}

/**
 * Unregister a specific push token for a user.
 */
export async function unregisterPushToken(email: string, token: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const ref = db().collection(TOKENS_COLLECTION).doc(normalizedEmail);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const existing = snap.data() as PushTokenDoc;
    const filtered = existing.tokens.filter((t) => t !== token);
    if (filtered.length === 0) {
      tx.delete(ref);
    } else {
      tx.set(ref, { ...existing, tokens: filtered, updatedAt: new Date().toISOString() });
    }
  });

  console.log(`[Push] Unregistered token for ${normalizedEmail}`);
  return true;
}

/**
 * Remove ALL push tokens for a user (e.g., on logout).
 */
export async function unregisterAllPushTokens(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const ref = db().collection(TOKENS_COLLECTION).doc(normalizedEmail);
  await ref.delete();
  console.log(`[Push] Cleared all tokens for ${normalizedEmail}`);
  return true;
}

/**
 * Get all push tokens for a specific user.
 */
export async function getPushTokens(email: string): Promise<string[]> {
  const doc = await getTokenDoc(email);
  return doc?.tokens ?? [];
}

/**
 * Get push tokens for multiple users at once.
 */
export async function getPushTokensForUsers(emails: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const normalizedEmails = emails.map((e) => e.toLowerCase().trim());

  const chunkSize = 10;
  for (let i = 0; i < normalizedEmails.length; i += chunkSize) {
    const chunk = normalizedEmails.slice(i, i + chunkSize);
    const snap = await db()
      .collection(TOKENS_COLLECTION)
      .where("email", "in", chunk)
      .get();
    for (const doc of snap.docs) {
      const data = doc.data() as PushTokenDoc;
      result.set(data.email, data.tokens);
    }
  }

  return result;
}

/**
 * Get all registered push tokens.
 */
export async function getAllPushTokens(): Promise<Map<string, string[]>> {
  const snap = await db().collection(TOKENS_COLLECTION).get();
  const result = new Map<string, string[]>();
  for (const doc of snap.docs) {
    const data = doc.data() as PushTokenDoc;
    result.set(data.email, data.tokens);
  }
  return result;
}

/**
 * Get tokens filtered by user roles.
 */
export async function getPushTokensByRoles(roles: string[]): Promise<Map<string, string[]>> {
  const snap = await db().collection(TOKENS_COLLECTION).get();
  const result = new Map<string, string[]>();
  for (const doc of snap.docs) {
    const data = doc.data() as PushTokenDoc;
    if (data.role && roles.includes(data.role.toUpperCase())) {
      result.set(data.email, data.tokens);
    }
  }
  return result;
}

// ── FCM Send Function ───────────────────────────────────────────────────────

interface SendResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  invalidTokens: string[];
  errors: string[];
}

/**
 * Send FCM push notification to tokens.
 * Tries FCM first (for Firebase tokens), falls back to Expo (for Expo tokens).
 */
async function sendToTokens(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<SendResult> {
  const fcmTokens: string[] = [];
  const expoTokens: string[] = [];

  for (const token of tokens) {
    if (token.startsWith("ExponentPushToken")) {
      expoTokens.push(token);
    } else {
      // Assume FCM token (long string, not starting with ExponentPushToken)
      fcmTokens.push(token);
    }
  }

  let sentCount = 0;
  let failedCount = 0;
  const invalidTokens: string[] = [];
  const errors: string[] = [];

  // Send via FCM
  if (fcmTokens.length > 0) {
    try {
      const messaging = getMessaging();
      const response = await messaging.sendEachForMulticast({
        tokens: fcmTokens,
        notification: {
          title,
          body,
        },
        data: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        android: {
          priority: "high",
          notification: {
            channelId: "crisisgrid-alerts",
            sound: "default",
            priority: "max",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      });

      response.responses.forEach((resp, i) => {
        if (resp.success) {
          sentCount++;
        } else {
          failedCount++;
          const err = resp.error;
          console.error(`[Push] FCM error for ${fcmTokens[i].slice(0, 20)}...:`, err?.message);
          const isInvalid =
            err?.code === "messaging/registration-token-not-registered" ||
            err?.code === "messaging/invalid-registration-token" ||
            err?.message?.toLowerCase().includes("not found") ||
            err?.message?.toLowerCase().includes("not registered");
          if (isInvalid) {
            invalidTokens.push(fcmTokens[i]);
          }
          errors.push(err?.message || "FCM error");
        }
      });
    } catch (e: any) {
      console.error("[Push] FCM send failed:", e.message);
      errors.push(`FCM: ${e.message}`);
      failedCount += fcmTokens.length;
    }
  }

  // Fallback: Send via Expo (for old Expo tokens)
  if (expoTokens.length > 0) {
    const messages = expoTokens
      .filter((token) => Expo.isExpoPushToken(token))
      .map((token) => ({
        to: token,
        sound: "default" as const,
        title,
        body,
        data,
        priority: "high" as const,
        channelId: "crisisgrid-alerts",
        badge: 1,
        _displayInForeground: true,
        _contentAvailable: true,
      }));

    if (messages.length > 0) {
      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          tickets.forEach((ticket, i) => {
            if (ticket.status === "ok") {
              sentCount++;
            } else {
              failedCount++;
              const errType = ticket.details?.error;
              console.error(`[Push] Expo error: ${errType}`);
              if (errType === "DeviceNotRegistered" || errType === "InvalidCredentials") {
                invalidTokens.push(expoTokens[i]);
              }
              errors.push(`${errType}: ${ticket.message || "Unknown"}`);
            }
          });
        } catch (err: any) {
          failedCount += chunk.length;
          errors.push(`Expo: ${err.message}`);
        }
      }
    }
  }

  return { success: sentCount > 0, sentCount, failedCount, invalidTokens, errors };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Send push notification to specific tokens.
 */
export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<SendResult> {
  console.log(`[Push] sendPushNotification: "${title}" to ${tokens.length} token(s)`);
  return sendToTokens(tokens, title, body, data);
}

/**
 * Remove a list of invalid tokens from all user documents in Firestore.
 */
async function purgeInvalidTokens(invalidTokens: string[]): Promise<void> {
  if (invalidTokens.length === 0) return;
  try {
    const snap = await db().collection(TOKENS_COLLECTION).get();
    const batch = db().batch();
    let changed = 0;
    for (const doc of snap.docs) {
      const data = doc.data() as PushTokenDoc;
      const filtered = data.tokens.filter((t) => !invalidTokens.includes(t));
      if (filtered.length !== data.tokens.length) {
        if (filtered.length === 0) {
          batch.delete(doc.ref);
        } else {
          batch.update(doc.ref, { tokens: filtered, updatedAt: new Date().toISOString() });
        }
        changed++;
      }
    }
    if (changed > 0) {
      await batch.commit();
      console.log(`[Push] Purged ${invalidTokens.length} invalid token(s) from ${changed} user doc(s)`);
    }
  } catch (e: any) {
    console.error("[Push] Failed to purge invalid tokens:", e.message);
  }
}

/**
 * Send push notification to a specific user by email.
 */
export async function sendPushToUser(
  email: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<SendResult> {
  const tokens = await getPushTokens(email);
  console.log(`[Push] sendPushToUser(${email}): ${tokens.length} token(s)`);
  if (tokens.length === 0) {
    return { success: false, sentCount: 0, failedCount: 0, invalidTokens: [], errors: ["No tokens"] };
  }
  const result = await sendToTokens(tokens, title, body, data);
  purgeInvalidTokens(result.invalidTokens);
  return result;
}

/**
 * Broadcast push notification to ALL registered users.
 */
export async function broadcastPushNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ totalSent: number; totalFailed: number; errors: string[] }> {
  const allTokens = await getAllPushTokens();
  console.log(`[Push] broadcast: "${title}" to ${allTokens.size} user(s)`);
  let totalSent = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  const allInvalidTokens: string[] = [];
  for (const [email, tokens] of Array.from(allTokens.entries())) {
    const result = await sendToTokens(tokens, title, body, data);
    totalSent += result.sentCount;
    totalFailed += result.failedCount;
    allErrors.push(...result.errors);
    allInvalidTokens.push(...result.invalidTokens);
  }

  purgeInvalidTokens(allInvalidTokens);
  console.log(`[Push] Broadcast complete: ${totalSent} sent, ${totalFailed} failed`);
  return { totalSent, totalFailed, errors: allErrors };
}

/**
 * Send push notification to users with specific roles.
 */
export async function sendPushToRoles(
  roles: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ totalSent: number; totalFailed: number; errors: string[] }> {
  const roleTokens = await getPushTokensByRoles(roles);
  let totalSent = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  const roleInvalidTokens: string[] = [];
  for (const [email, tokens] of Array.from(roleTokens.entries())) {
    const result = await sendToTokens(tokens, title, body, data);
    totalSent += result.sentCount;
    totalFailed += result.failedCount;
    allErrors.push(...result.errors);
    roleInvalidTokens.push(...result.invalidTokens);
  }

  purgeInvalidTokens(roleInvalidTokens);
  return { totalSent, totalFailed, errors: allErrors };
}

/**
 * Send push notification to multiple specific users.
 */
export async function sendPushToUsers(
  emails: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ totalSent: number; totalFailed: number; errors: string[] }> {
  const userTokens = await getPushTokensForUsers(emails);
  let totalSent = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  const usersInvalidTokens: string[] = [];
  for (const [email, tokens] of Array.from(userTokens.entries())) {
    const result = await sendToTokens(tokens, title, body, data);
    totalSent += result.sentCount;
    totalFailed += result.failedCount;
    allErrors.push(...result.errors);
    usersInvalidTokens.push(...result.invalidTokens);
  }

  purgeInvalidTokens(usersInvalidTokens);
  return { totalSent, totalFailed, errors: allErrors };
}

// ── Legacy alias ────────────────────────────────────────────────────────────

export async function sendToVolunteers(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ totalSent: number; totalFailed: number; errors: string[] }> {
  return sendPushToRoles(["VOLUNTEER", "STAFF", "ADMIN", "SUPERADMIN"], title, body, data);
}
