import { Router } from "express";
import type { Response } from "express";
import type { Server as SocketServer } from "socket.io";
import crypto from "crypto";
import OpenAI from "openai";
import { createCIRORoutes } from "./ciro/routes.js";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const speakeasy = _require("speakeasy") as typeof import("speakeasy");
import QRCode from "qrcode";
import { volunteerPositionStore, volunteerShiftStore, haversineKm, findNearestVolunteer } from "./index.js";
import { registerPushToken, unregisterPushToken, unregisterAllPushTokens, sendPushNotification, broadcastPushNotification, sendPushToUser, getPushTokens } from "./push.js";
import { hashPassword, verifyPassword, generateToken, generate2FAToken, verify2FAToken, requireAuth, optionalAuth, type AuthRequest } from "./auth.js";
import { sendRequesterConfirmation, sendStaffAlert, sendVolunteerAlert, sendClaimedRequesterAlert, sendClaimedVolunteerAlert, sendCrisisResolved } from "./email.js";
import {
  userFindByEmail, userFindById, userFindFirst, userCreate, userUpdate, userFindMany, userCount,
  requestFindById, requestFindMany, requestCreate, requestUpdate, requestCount,
  taskFindFirst, taskFindMany, taskCreate, taskUpdate, claimRequestTransaction,
  activityLogCreate, activityLogFindMany, activityLogCount,
  safeZoneFindMany, safeZoneCreate, safeZoneDelete,
  contactSubmissionCreate, generatePublicId,
} from "./firestoreDb.js";

/**
 * Promote the oldest QUEUED request to ACTIVE for a given user.
 * Called after a request is resolved or cancelled.
 */
async function promoteQueuedRequest(userId: string, io: SocketServer) {
  try {
    const all = await requestFindMany({});
    const queued = all
      .filter((r: any) => r.userId === userId && r.status === "QUEUED")
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (queued.length === 0) return;
    const nextUp = queued[0];
    await requestUpdate(nextUp.id, { status: "ACTIVE" });
    const formatted = {
      id: nextUp.id,
      type: (nextUp.type as string).toLowerCase() as "medical" | "food_water" | "rescue",
      description: nextUp.description,
      lng: nextUp.lng,
      lat: nextUp.lat,
      createdAt: nextUp.createdAt,
      claimed: false,
      claimedBy: null,
      createdBy: nextUp.user?.email ?? null,
      status: "ACTIVE",
    };
    io.emit("new_crisis", formatted);
    io.to("volunteers").emit("volunteer_alert", {
      id: formatted.id,
      type: formatted.type,
      description: formatted.description,
      lat: formatted.lat,
      lng: formatted.lng,
      distanceKm: null,
      timestamp: new Date().toISOString(),
    });
    // Auto-dispatch the promoted request
    setTimeout(() => {
      autoDispatchRequest(nextUp.id, io).catch(() => undefined);
    }, 500);
  } catch (e) {
    console.error("[Queue] Failed to promote queued request:", e);
  }
}

/**
 * Find ALL available responders (volunteers/staff/admin/superadmin) sorted by distance.
 * Only includes responders who:
 *  1. Have reported a GPS location within the last 10 minutes
 *  2. Have their On Duty toggle set to true (isAvailable)
 *  3. Are not in the excludeEmails list
 */
function findAllAvailableResponders(crisisLat: number, crisisLng: number, excludeEmails: string[] = []): Array<VolunteerPositionEntry & { distanceKm: number }> {
  const cutoff = Date.now() - 10 * 60 * 1000; // 10 min freshness window
  const results: Array<VolunteerPositionEntry & { distanceKm: number }> = [];
  for (const entry of volunteerPositionStore.values()) {
    if (excludeEmails.includes(entry.email)) continue;
    if (entry.timestamp < cutoff) continue;
    if (!entry.isAvailable) continue;
    const d = haversineKm(crisisLat, crisisLng, entry.lat, entry.lng);
    results.push({ ...entry, distanceKm: d });
  }
  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Check if a responder already has an active (non-completed) task.
 */
async function hasActiveTask(volunteerId: string): Promise<boolean> {
  const task = await taskFindFirst({ volunteerId, status: { not: "COMPLETED" } });
  return !!task;
}

/**
 * Attempt auto-dispatch for a single request.
 * Checks all on-duty responders sorted by GPS proximity.
 * If an eligible responder is found → assigns task, marks request CLAIMED.
 * If NO responder is available → request stays QUEUED.
 */
async function autoDispatchRequest(requestId: string, io: SocketServer, opts: { maxResponders?: number; excludeVolunteerIds?: string[] } = {}) {
  const { maxResponders = 1, excludeVolunteerIds = [] } = opts;
  try {
    const crisisRequest = await requestFindById(String(requestId));
    if (!crisisRequest) return;
    // Accept QUEUED, ACTIVE, or CLAIMED for dispatch
    if (!["QUEUED", "ACTIVE", "CLAIMED"].includes(crisisRequest.status)) return;

    // Step 1: Find all on-duty responders with fresh GPS, sorted by distance
    const allResponders = findAllAvailableResponders(crisisRequest.lat, crisisRequest.lng);
    console.log(`[AutoDispatch] ${allResponders.length} on-duty responder(s) with GPS for request ${requestId}`);

    // Step 2: Filter out those who already have an active task
    const eligibleResponders = [];
    for (const responder of allResponders) {
      if (excludeVolunteerIds.includes(responder.volunteerId)) continue;
      const busy = await hasActiveTask(responder.volunteerId);
      if (!busy) eligibleResponders.push(responder);
      if (eligibleResponders.length >= maxResponders) break;
    }

    const typeLabels: Record<string, string> = {
      MEDICAL: "Medical Emergency",
      FOOD_WATER: "Food/Water Supply",
      RESCUE: "Rescue Operation",
    };

    if (eligibleResponders.length === 0) {
      // No available responder — ensure request stays/moves to QUEUED
      if (crisisRequest.status !== "QUEUED") {
        await requestUpdate(String(requestId), { status: "QUEUED" });
        io.emit("crisis_status_changed", { requestId: String(requestId), status: "QUEUED" });
      }
      console.log(`[AutoDispatch] No available responders for request ${requestId} — stays QUEUED`);

      // Notify requester that no responders are currently available
      (async () => {
        try {
          const requester = await userFindById(crisisRequest.userId);
          if (requester?.email) {
            await sendPushToUser(
              requester.email,
              "⏳ Request Queued",
              `Your ${typeLabels[crisisRequest.type] || crisisRequest.type} request is queued. No responders are currently on duty nearby. We'll dispatch automatically when someone becomes available.`,
              { type: "request_queued", requestId: String(requestId) }
            );
          }
        } catch (e) {
          console.error("[Push] Queue notification failed:", e);
        }
      })();

      return;
    }

    for (const responder of eligibleResponders) {
      const volunteerUser = await userFindById(responder.volunteerId);
      if (!volunteerUser) continue;

      let aiRoutePlan = `Agent-dispatched route for ${typeLabels[crisisRequest.type] || crisisRequest.type} at [${Number(crisisRequest.lat).toFixed(4)}, ${Number(crisisRequest.lng).toFixed(4)}]. Proceed with standard emergency protocol. Required Gear: First Aid Kit, Flashlight, Radio.`;
      try {
        const openaiModule = await import("./ciro/agents.js").catch(() => null);
        const openai = openaiModule ? (openaiModule as any).getOpenAI?.() : null;
        if (openai) {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are an emergency logistics AI. Provide a 2-sentence highly optimized route and a short list of required gear for an emergency responder heading to a crisis." },
              { role: "user", content: `Crisis Type: ${typeLabels[crisisRequest.type] || crisisRequest.type}. Coordinates: [${Number(crisisRequest.lat).toFixed(4)}, ${Number(crisisRequest.lng).toFixed(4)}]. Description: ${crisisRequest.description}` },
            ],
            max_tokens: 512,
          });
          const aiResponse = completion.choices[0]?.message?.content;
          if (aiResponse) aiRoutePlan = aiResponse;
        }
      } catch {
        // fallback already set
      }

      try {
        const task = await claimRequestTransaction(String(requestId), responder.volunteerId, aiRoutePlan);
        io.emit("crisis_claimed", {
          requestId: String(requestId),
          claimedBy: volunteerUser.email,
          volunteerId: volunteerUser.id,
          taskId: task.id,
          aiRoutePlan: task.aiRoutePlan,
          agentDispatched: true,
          crisisLat: crisisRequest.lat,
          crisisLng: crisisRequest.lng,
        });
        io.to("volunteers").emit("priority_alert", {
          id: `pa-${task.id}-${Date.now()}`,
          targetEmail: volunteerUser.email,
          crisisId: String(requestId),
          crisisType: (crisisRequest.type as string).toLowerCase() as "medical" | "food_water" | "rescue",
          crisisLat: crisisRequest.lat,
          crisisLng: crisisRequest.lng,
          description: crisisRequest.description,
          claimedBy: volunteerUser.email,
          nearestVolunteerEmail: volunteerUser.email,
          nearestVolunteerName: volunteerUser.name,
          distanceKm: Math.round(responder.distanceKm * 100) / 100,
          walkMinutes: Math.round((responder.distanceKm / 5) * 60),
          driveMinutes: Math.round((responder.distanceKm / 40) * 60),
          dispatchMessage: `AGENT DISPATCH: You have been auto-assigned to a ${typeLabels[crisisRequest.type] || crisisRequest.type} (${responder.distanceKm < 1 ? Math.round(responder.distanceKm * 1000) + "m" : responder.distanceKm.toFixed(1) + "km"} away).`,
          timestamp: new Date().toISOString(),
        });
        // Push to volunteer
        await sendPushToUser(
          volunteerUser.email,
          "🤖 Agent Dispatch",
          `You've been auto-assigned to a ${typeLabels[crisisRequest.type] || crisisRequest.type} (${responder.distanceKm < 1 ? Math.round(responder.distanceKm * 1000) + "m" : responder.distanceKm.toFixed(1) + "km"} away).`,
          { type: "agent_dispatch", requestId: String(requestId), crisisLat: crisisRequest.lat, crisisLng: crisisRequest.lng }
        );
        await activityLogCreate({
          action: "AGENT_DISPATCH",
          details: `Agent auto-dispatched ${crisisRequest.type} request ${requestId} to volunteer "${volunteerUser.name}" (${volunteerUser.email}) at ${responder.distanceKm.toFixed(2)}km`,
          performedById: volunteerUser.id,
          targetUserId: responder.volunteerId,
        });
      } catch (e: any) {
        if (e.message === "ALREADY_CLAIMED" || e.message === "NOT_FOUND") {
          console.log(`[AutoDispatch] Request ${requestId} no longer claimable for ${volunteerUser.email}`);
        } else {
          throw e;
        }
      }
    }

    // Push to requester (once per dispatch batch)
    const requesterUser = await userFindById(crisisRequest.userId);
    if (requesterUser?.email) {
      await sendPushToUser(
        requesterUser.email,
        "✅ Help is on the way",
        `${eligibleResponders.length} responder(s) have been automatically dispatched to your ${crisisRequest.type} request.`,
        { type: "crisis_claimed", requestId: String(requestId), agentDispatched: true, responderCount: eligibleResponders.length }
      );
    }
  } catch (e) {
    console.error("[AutoDispatch] Background dispatch failed:", e);
  }
}

async function checkBanned(req: AuthRequest, res: Response, next: Function) {
  if (!req.user) return next();
  const user = await userFindById(req.user.userId);
  if (user?.banned) {
    return res.status(403).json({ error: "Your account has been suspended." });
  }
  next();
}

function requireAdmin(req: AuthRequest, res: Response, next: Function) {
  if (!req.user || !["ADMIN", "SUPERADMIN", "STAFF"].includes(req.user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

const VALID_ROLES = ["VICTIM", "VOLUNTEER", "STAFF", "ADMIN", "SUPERADMIN"] as const;
type DbRole = typeof VALID_ROLES[number];

const ROLE_LEVEL: Record<string, number> = {
  VICTIM: 1, VOLUNTEER: 2, STAFF: 3, ADMIN: 4, SUPERADMIN: 5,
};

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
  });
}

export function createRoutes(io: SocketServer) {
  const router = Router();

  router.use(createCIRORoutes(io));

  // ── AUTH ──────────────────────────────────────────────────────────────────

  router.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name, role, phone, address } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name are required" });
      }

      const existing = await userFindByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const publicRoles: DbRole[] = ["VICTIM", "VOLUNTEER"];
      const dbRole: DbRole = publicRoles.includes(role as DbRole) ? (role as DbRole) : "VICTIM";
      const publicId = await generatePublicId(dbRole);
      const passwordHash = await hashPassword(password);
      const user = await userCreate({
        email, passwordHash, name, role: dbRole,
        phone: phone || null, address: address || null, publicId,
        banned: false, failedLoginAttempts: 0,
        lockedUntil: null, passwordResetToken: null, passwordResetExpiry: null,
      });

      await activityLogCreate({
        action: "USER_REGISTER",
        details: `New ${dbRole.toLowerCase()} registered: ${name} (${publicId})`,
        performedById: user.id,
      });

      const token = generateToken(user.id, user.email, user.role);
      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, publicId: user.publicId },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  router.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const LOCKOUT_THRESHOLD = 10;
      const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
      const PRIVILEGED_ROLES = ["ADMIN", "SUPERADMIN", "STAFF", "VOLUNTEER"];

      const user = await userFindByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isPrivileged = PRIVILEGED_ROLES.includes(user.role);

      if (!isPrivileged && user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        const remaining = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
        return res.status(423).json({
          error: `Account temporarily locked due to too many failed attempts. Try again in ${remaining} minute${remaining !== 1 ? "s" : ""}.`,
        });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        if (!isPrivileged) {
          const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
          const shouldLock = newAttempts >= LOCKOUT_THRESHOLD;
          const lockedUntil = shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString() : null;

          await userUpdate(user.id, {
            failedLoginAttempts: newAttempts,
            ...(shouldLock ? { lockedUntil } : {}),
          });

          const attemptsLeft = LOCKOUT_THRESHOLD - newAttempts;
          const failDetails = shouldLock
            ? `Account locked for "${user.name}" (${user.role}) after ${newAttempts} failed attempts. IP: ${req.ip ?? "unknown"}`
            : `Failed login attempt ${newAttempts}/${LOCKOUT_THRESHOLD} for "${user.name}" (${user.role}). IP: ${req.ip ?? "unknown"}`;

          await activityLogCreate({
            action: shouldLock ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
            details: failDetails,
            performedById: user.id,
          });

          io.emit("security_alert", {
            type: shouldLock ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
            actorName: email,
            actorRole: user.role,
            targetName: user.name,
            targetRole: user.role,
            details: shouldLock
              ? `Account LOCKED for "${user.name}" (${user.role}) after ${newAttempts} failed attempts`
              : `Failed login attempt ${newAttempts}/${LOCKOUT_THRESHOLD} for "${user.name}" (${user.role})`,
            timestamp: new Date().toISOString(),
          });

          if (shouldLock) {
            // Notify user their account is locked
            (async () => {
              try {
                await sendPushToUser(
                  user.email,
                  "🔒 Account Locked",
                  `Your account has been temporarily locked due to ${newAttempts} failed login attempts. Try again in 15 minutes.`,
                  { type: "account_locked", attempts: newAttempts }
                );
              } catch (e) {
                console.error("[Push] Account lock notification failed:", e);
              }
            })();
            return res.status(423).json({ error: "Too many failed attempts. Account locked for 15 minutes." });
          }
          return res.status(401).json({
            error: `Invalid credentials. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining before lockout.`,
          });
        }

        await activityLogCreate({
          action: "LOGIN_FAILED",
          details: `Failed login attempt for "${user.name}" (${user.role}). IP: ${req.ip ?? "unknown"}`,
          performedById: user.id,
        });
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (user.banned) {
        await activityLogCreate({
          action: "LOGIN_FAILED",
          details: `Login attempt on suspended account "${user.name}" (${user.role}). IP: ${req.ip ?? "unknown"}`,
          performedById: user.id,
        });
        // Notify banned user attempting login
        (async () => {
          try {
            await sendPushToUser(
              user.email,
              "⛔ Account Suspended",
              "Your CrisisGrid account has been suspended. Contact support for assistance.",
              { type: "account_banned" }
            );
          } catch (e) {
            console.error("[Push] Ban notification failed:", e);
          }
        })();
        return res.status(403).json({ error: "Your account has been suspended. Contact support." });
      }

      await userUpdate(user.id, { failedLoginAttempts: 0, lockedUntil: null });

      if (user.twoFactorEnabled && user.twoFactorSecret) {
        const twoFactorToken = generate2FAToken(user.id);
        return res.json({ requiresTwoFactor: true, twoFactorToken });
      }

      const token = generateToken(user.id, user.email, user.role);

      await activityLogCreate({
        action: "USER_LOGIN",
        details: `${user.name} (${user.role}) logged in. Public ID: ${user.publicId || "none"}`,
        performedById: user.id,
      });

      // Welcome back notification
      (async () => {
        try {
          await sendPushToUser(
            user.email,
            "👋 Welcome back",
            `Signed in as ${user.name} (${user.role}). CrisisGrid is ready.`,
            { type: "login_success", role: user.role }
          );
        } catch (e) {
          console.error("[Push] Login welcome notification failed:", e);
        }
      })();

      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, publicId: user.publicId },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  router.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await userFindByEmail(email);
      if (!user) {
        return res.json({ message: "If an account exists, reset instructions have been sent." });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 3600000).toISOString();

      await userUpdate(user.id, { passwordResetToken: resetToken, passwordResetExpiry: expiry });

      console.log(`Password reset token for ${email}: ${resetToken}`);
      const isDev = process.env.NODE_ENV !== "production";
      res.json({
        message: "If an account exists, reset instructions have been sent.",
        ...(isDev ? { resetToken } : {}),
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  router.patch("/api/auth/change-password", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }
      if (currentPassword === newPassword) {
        return res.status(400).json({ error: "New password must be different from your current password" });
      }

      const user = await userFindById(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const passwordHash = await hashPassword(newPassword);
      await userUpdate(user.id, { passwordHash });

      await activityLogCreate({
        action: "PASSWORD_CHANGED",
        details: `Password changed for ${user.email}`,
        performedById: user.id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  function generateBackupCodes(count = 8): string[] {
    return Array.from({ length: count }, () => {
      const bytes = crypto.randomBytes(4);
      const hex = bytes.toString("hex").toUpperCase();
      return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
    });
  }

  function hashBackupCode(code: string): string {
    return crypto.createHash("sha256").update(code.toUpperCase().replace(/-/g, "")).digest("hex");
  }

  router.get("/api/auth/2fa/status", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const user = await userFindById(req.user!.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({
        twoFactorEnabled: !!user.twoFactorEnabled,
        backupCodesRemaining: Array.isArray(user.twoFactorBackupCodes) ? user.twoFactorBackupCodes.length : 0,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get 2FA status" });
    }
  });

  router.post("/api/auth/2fa/setup", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const user = await userFindById(req.user!.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.twoFactorEnabled) return res.status(400).json({ error: "2FA is already enabled" });

      const secretObj = speakeasy.generateSecret({ name: `CrisisGrid:${user.email}`, issuer: "CrisisGrid" });
      const secret = secretObj.base32;
      const qrCodeDataUrl = await QRCode.toDataURL(secretObj.otpauth_url!);

      await userUpdate(user.id, { twoFactorSecretPending: secret });

      res.json({ secret, qrCodeDataUrl });
    } catch (error) {
      console.error("2FA setup error:", error);
      res.status(500).json({ error: "Failed to set up 2FA" });
    }
  });

  router.post("/api/auth/2fa/enable", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: "Verification code is required" });

      const user = await userFindById(req.user!.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.twoFactorEnabled) return res.status(400).json({ error: "2FA is already enabled" });
      if (!user.twoFactorSecretPending) return res.status(400).json({ error: "No pending 2FA setup. Start setup first." });

      const isValid = speakeasy.totp.verify({ secret: user.twoFactorSecretPending, encoding: "base32", token: code, window: 1 });
      if (!isValid) return res.status(401).json({ error: "Invalid code. Make sure your authenticator app time is correct." });

      const plainCodes = generateBackupCodes(8);
      const hashedCodes = plainCodes.map(hashBackupCode);

      await userUpdate(user.id, {
        twoFactorSecret: user.twoFactorSecretPending,
        twoFactorEnabled: true,
        twoFactorSecretPending: null,
        twoFactorBackupCodes: hashedCodes,
      });

      await activityLogCreate({
        action: "TWO_FACTOR_ENABLED",
        details: `2FA enabled for ${user.email}`,
        performedById: user.id,
      });

      res.json({ success: true, backupCodes: plainCodes });
    } catch (error) {
      console.error("2FA enable error:", error);
      res.status(500).json({ error: "Failed to enable 2FA" });
    }
  });

  router.post("/api/auth/2fa/disable", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const { password } = req.body;
      if (!password) return res.status(400).json({ error: "Password is required to disable 2FA" });

      const user = await userFindById(req.user!.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (!user.twoFactorEnabled) return res.status(400).json({ error: "2FA is not enabled" });

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: "Incorrect password" });

      await userUpdate(user.id, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorSecretPending: null,
        twoFactorBackupCodes: [],
      });

      await activityLogCreate({
        action: "TWO_FACTOR_DISABLED",
        details: `2FA disabled for ${user.email}`,
        performedById: user.id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("2FA disable error:", error);
      res.status(500).json({ error: "Failed to disable 2FA" });
    }
  });

  router.post("/api/auth/2fa/verify-login", async (req, res) => {
    try {
      const { twoFactorToken, code, backupCode } = req.body;
      if (!twoFactorToken || (!code && !backupCode)) {
        return res.status(400).json({ error: "Token and either a TOTP code or backup code are required" });
      }

      const payload = verify2FAToken(twoFactorToken);
      if (!payload) return res.status(401).json({ error: "2FA session expired. Please sign in again." });

      const user = await userFindById(payload.userId);
      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(401).json({ error: "Invalid 2FA session" });
      }

      let loginAction = "USER_LOGIN";
      let loginDetails = `${user.name} (${user.role}) logged in with 2FA. Public ID: ${user.publicId || "none"}`;

      if (backupCode) {
        const normalized = backupCode.toUpperCase().replace(/-/g, "").replace(/\s/g, "");
        const hash = hashBackupCode(normalized);
        const storedCodes: string[] = Array.isArray(user.twoFactorBackupCodes) ? user.twoFactorBackupCodes : [];
        const idx = storedCodes.indexOf(hash);
        if (idx === -1) return res.status(401).json({ error: "Invalid backup code." });
        const remaining = storedCodes.filter((_, i) => i !== idx);
        await userUpdate(user.id, { twoFactorBackupCodes: remaining });
        loginAction = "BACKUP_CODE_USED";
        loginDetails = `${user.name} used a backup code to sign in. ${remaining.length} code${remaining.length !== 1 ? "s" : ""} remaining.`;
      } else {
        const isValid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: "base32", token: code, window: 1 });
        if (!isValid) return res.status(401).json({ error: "Invalid code. Check your authenticator app and try again." });
      }

      const token = generateToken(user.id, user.email, user.role);
      await activityLogCreate({ action: loginAction, details: loginDetails, performedById: user.id });

      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, publicId: user.publicId },
      });
    } catch (error) {
      console.error("2FA verify-login error:", error);
      res.status(500).json({ error: "2FA verification failed" });
    }
  });

  router.post("/api/auth/2fa/backup-codes/regenerate", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: "TOTP code is required to regenerate backup codes" });

      const user = await userFindById(req.user!.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (!user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ error: "2FA is not enabled" });
      }

      const isValid = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: "base32", token: code, window: 1 });
      if (!isValid) return res.status(401).json({ error: "Invalid TOTP code" });

      const plainCodes = generateBackupCodes(8);
      const hashedCodes = plainCodes.map(hashBackupCode);
      await userUpdate(user.id, { twoFactorBackupCodes: hashedCodes });

      await activityLogCreate({
        action: "BACKUP_CODES_REGENERATED",
        details: `Backup codes regenerated for ${user.email}`,
        performedById: user.id,
      });

      res.json({ backupCodes: plainCodes });
    } catch (error) {
      console.error("Regenerate backup codes error:", error);
      res.status(500).json({ error: "Failed to regenerate backup codes" });
    }
  });

  router.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: "Token and password are required" });
      }

      const user = await userFindFirst({
        passwordResetToken: token,
        passwordResetExpiry: { gte: new Date() },
      });

      if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      const passwordHash = await hashPassword(password);
      await userUpdate(user.id, {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      });

      await activityLogCreate({
        action: "PASSWORD_RESET",
        details: `Password reset for ${user.email}`,
        performedById: user.id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // ── REQUESTS ──────────────────────────────────────────────────────────────

  router.get("/api/requests", async (_req, res) => {
    try {
      const requests = await requestFindMany({
        where: { status: { in: ["QUEUED", "ACTIVE", "CLAIMED"] } },
        includeUser: true,
        includeTasks: true,
      });

      const formatted = requests.map((r) => ({
        id: r.id,
        type: (r.type as string).toLowerCase() as "medical" | "food_water" | "rescue",
        description: r.description,
        lng: r.lng,
        lat: r.lat,
        createdAt: r.createdAt,
        claimed: r.status === "CLAIMED",
        claimedBy: r.tasks?.[0]?.volunteer?.email ?? null,
        createdBy: r.user?.email ?? null,
        status: r.status,
        requester: r.user ? {
          name: (r.user as any).name ?? null,
          email: r.user.email ?? null,
          phone: (r.user as any).phone ?? null,
          address: (r.user as any).address ?? null,
          publicId: (r.user as any).publicId ?? null,
        } : null,
      }));

      res.json(formatted);
    } catch (error) {
      console.error("Fetch requests error:", error);
      res.status(500).json({ error: "Failed to fetch requests" });
    }
  });

  router.get("/api/requests/mine", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      const all = await requestFindMany({});
      const mine = all.filter((r: any) => r.userId === userId);
      const formatted = mine.map((r: any) => ({
        id: r.id,
        type: (r.type as string).toLowerCase() as "medical" | "food_water" | "rescue",
        description: r.description,
        lat: r.lat,
        lng: r.lng,
        createdAt: r.createdAt,
        status: r.status as string,
        claimed: r.status === "CLAIMED",
        resolved: r.status === "RESOLVED",
        cancelled: r.status === "CANCELLED",
      }));
      res.json(formatted);
    } catch (error) {
      console.error("Fetch my requests error:", error);
      res.status(500).json({ error: "Failed to fetch your requests" });
    }
  });

  router.post("/api/requests", optionalAuth as any, checkBanned as any, async (req: AuthRequest, res) => {
    try {
      const { type, description, lat, lng } = req.body;
      if (!type || !description || lat == null || lng == null) {
        return res.status(400).json({ error: "Type, description, lat, and lng are required" });
      }

      const typeMap: Record<string, "MEDICAL" | "FOOD_WATER" | "RESCUE"> = {
        medical: "MEDICAL", food_water: "FOOD_WATER", rescue: "RESCUE",
      };
      const dbType = typeMap[type];
      if (!dbType) {
        return res.status(400).json({ error: "Invalid request type" });
      }

      let userId = req.user?.userId;
      if (userId) {
        const userExists = await userFindById(userId);
        if (!userExists) {
          return res.status(401).json({ error: "Session expired. Please sign out and sign in again." });
        }
      }
      if (!userId) {
        let anonUser = await userFindByEmail("anonymous@crisisgrid.app");
        if (!anonUser) {
          anonUser = await userCreate({
            email: "anonymous@crisisgrid.app",
            passwordHash: "nologin",
            name: "Anonymous",
            role: "VICTIM",
            banned: false,
            failedLoginAttempts: 0,
            lockedUntil: null,
            passwordResetToken: null,
            passwordResetExpiry: null,
          });
        }
        userId = anonUser.id;
      }

      const userRecord = await userFindById(userId);
      // ALL new requests start as QUEUED. Auto-dispatch will promote to CLAIMED
      // if an on-duty volunteer with GPS is found nearby. Otherwise stays QUEUED.
      const request = await requestCreate({
        type: dbType, description, lat, lng, userId, status: "QUEUED",
      });

      const formatted = {
        id: request.id,
        type: type as "medical" | "food_water" | "rescue",
        description: request.description,
        lng: request.lng,
        lat: request.lat,
        createdAt: request.createdAt,
        claimed: false,
        claimedBy: null,
        createdBy: userRecord?.email ?? null,
        status: "QUEUED",
      };

      io.emit("new_crisis", formatted);
      io.to("volunteers").emit("volunteer_alert", {
        id: formatted.id,
        type: formatted.type,
        description: formatted.description,
        lat: formatted.lat,
        lng: formatted.lng,
        createdAt: formatted.createdAt,
      });

      // Push notification to all volunteers
      (async () => {
        try {
          await broadcastPushNotification(
            "🚨 New Crisis Alert",
            `${formatted.type.toUpperCase()}: ${formatted.description.slice(0, 80)}`,
            { type: "new_crisis", requestId: formatted.id, lat: formatted.lat, lng: formatted.lng }
          );
        } catch (e) {
          console.error("[Push] New crisis broadcast failed:", e);
        }
      })();

      const emailData = {
        requestId: request.id,
        type: request.type,
        description: request.description,
        lat: request.lat,
        lng: request.lng,
        createdAt: request.createdAt,
        requesterEmail: userRecord?.email ?? null,
        requesterName: userRecord?.name ?? null,
      };

      (async () => {
        try {
          const [staffUsers, volunteerUsers] = await Promise.all([
            userFindMany({ where: { role: { in: ["STAFF", "ADMIN", "SUPERADMIN"] }, banned: false } }),
            userFindMany({ where: { role: "VOLUNTEER", banned: false } }),
          ]);
          const staffEmails = staffUsers.map((u: any) => u.email).filter(Boolean);
          const volunteerEmails = volunteerUsers.map((u: any) => u.email).filter(Boolean);
          const requesterEmail = userRecord?.email;
          console.log(`[Email] New request #${emailData.requestId} — requester: ${requesterEmail ?? "anon"}, staff: ${staffEmails.length}, volunteers: ${volunteerEmails.length}`);
          await Promise.all([
            requesterEmail && requesterEmail !== "anonymous@crisisgrid.app"
              ? sendRequesterConfirmation(requesterEmail, emailData)
              : Promise.resolve(),
            staffEmails.length > 0 ? sendStaffAlert(staffEmails, emailData) : Promise.resolve(),
            volunteerEmails.length > 0 ? sendVolunteerAlert(volunteerEmails, emailData) : Promise.resolve(),
          ]);
          console.log(`[Email] Alerts dispatched for request #${emailData.requestId}`);
        } catch (err) {
          console.error("[Email] Background email error:", err);
        }
      })();

      await activityLogCreate({
        action: "HELP_REQUEST_SUBMITTED",
        details: `${type.toUpperCase()} help request submitted at [${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}]. Description: "${description?.slice(0, 120) ?? ""}"`,
        performedById: userId,
        targetUserId: userId,
      });

      // Auto-dispatch: try to find nearest on-duty volunteer immediately
      // If found → promotes QUEUED → CLAIMED. If not → stays QUEUED.
      setTimeout(() => {
        autoDispatchRequest(request.id, io, { maxResponders: 1 }).catch((e: any) => {
          console.error("[AutoDispatch] Post-creation dispatch failed:", e?.message);
        });
      }, 300);

      res.status(201).json(formatted);
    } catch (error) {
      console.error("Create request error:", error);
      res.status(500).json({ error: "Failed to create request" });
    }
  });

  // ── TASKS ─────────────────────────────────────────────────────────────────

  router.post("/api/tasks/claim", requireAuth as any, checkBanned as any, async (req: AuthRequest, res) => {
    try {
      const { requestId } = req.body;
      if (!requestId) {
        return res.status(400).json({ error: "requestId is required" });
      }
      // Allow volunteers, staff, admin, and superadmin to claim/respond
      const claimerRole = req.user!.role;
      if (!["VOLUNTEER", "STAFF", "ADMIN", "SUPERADMIN"].includes(claimerRole)) {
        return res.status(403).json({ error: "Only responders can claim tasks" });
      }

      const crisisRequest = await requestFindById(String(requestId));
      if (!crisisRequest) {
        return res.status(404).json({ error: "Request not found" });
      }
      // Allow claiming QUEUED, ACTIVE, or already-CLAIMED requests
      if (!["QUEUED", "ACTIVE", "CLAIMED"].includes(crisisRequest.status)) {
        return res.status(409).json({ error: "Request is no longer available" });
      }

      // One active task per responder rule
      const existingActiveTask = await taskFindFirst({
        volunteerId: req.user!.userId,
        status: { not: "COMPLETED" },
      });
      if (existingActiveTask) {
        return res.status(409).json({ error: "You already have an active task. Please resolve it before claiming a new one." });
      }

      const typeLabels: Record<string, string> = {
        MEDICAL: "Medical Emergency",
        FOOD_WATER: "Food/Water Supply",
        RESCUE: "Rescue Operation",
      };

      let aiRoutePlan = `Route calculated for ${typeLabels[crisisRequest.type] || crisisRequest.type} at [${Number(crisisRequest.lat).toFixed(4)}, ${Number(crisisRequest.lng).toFixed(4)}]. Proceed with standard emergency protocol. Required Gear: First Aid Kit, Flashlight, Radio.`;

      try {
        const openai = getOpenAI();
        if (openai) {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are an emergency logistics AI. Provide a 2-sentence highly optimized route and a short list of required gear for an emergency responder heading to a crisis." },
              { role: "user", content: `Crisis Type: ${typeLabels[crisisRequest.type] || crisisRequest.type}. Coordinates: [${Number(crisisRequest.lat).toFixed(4)}, ${Number(crisisRequest.lng).toFixed(4)}]. Description: ${crisisRequest.description}` },
            ],
            max_tokens: 512,
          });
          const aiResponse = completion.choices[0]?.message?.content;
          if (aiResponse) aiRoutePlan = aiResponse;
        }
      } catch (aiError) {
        console.error("AI route plan generation failed, using fallback:", aiError);
      }

      let task: Record<string, any>;
      try {
        task = await claimRequestTransaction(String(requestId), req.user!.userId, aiRoutePlan);
      } catch (e: any) {
        if (e.message === "ALREADY_CLAIMED" || e.message === "NOT_FOUND") {
          return res.status(409).json({ error: "Request already claimed" });
        }
        throw e;
      }

      const user = await userFindById(req.user!.userId);
      const requesterUser = await userFindById(crisisRequest.userId);

      io.emit("crisis_claimed", {
        requestId: String(requestId),
        claimedBy: user?.email ?? req.user!.email,
        taskId: task.id,
        aiRoutePlan: task.aiRoutePlan,
        request: {
          id: crisisRequest.id,
          type: (crisisRequest.type as string).toLowerCase(),
          description: crisisRequest.description,
          lat: crisisRequest.lat,
          lng: crisisRequest.lng,
          createdAt: crisisRequest.createdAt,
          claimed: true,
          claimedBy: user?.email ?? req.user!.email,
          status: "CLAIMED",
          taskStatus: "CLAIMED",
          aiRoutePlan: task.aiRoutePlan,
        },
      });

      // Push notification to requester
      (async () => {
        try {
          if (requesterUser?.email) {
            await sendPushToUser(
              requesterUser.email,
              "✅ Help is on the way",
              `A volunteer has accepted your ${crisisRequest.type} request and is heading to your location.`,
              { type: "crisis_claimed", requestId: String(requestId), claimedBy: user?.email }
            );
          }
        } catch (e) {
          console.error("[Push] Claim notification failed:", e);
        }
      })();

      setImmediate(async () => {
        try {
          const nearest = findNearestVolunteer(crisisRequest.lat, crisisRequest.lng, req.user!.email);
          if (!nearest) return;

          const distKm = nearest.distanceKm;
          const walkMinutes = Math.round((distKm / 5) * 60);
          const driveMinutes = Math.round((distKm / 40) * 60);
          const typeLabel = typeLabels[crisisRequest.type] || crisisRequest.type;

          let dispatchMessage = `PRIORITY: ${typeLabel} claimed near you (${distKm < 1 ? Math.round(distKm * 1000) + "m" : distKm.toFixed(1) + "km"} away). Walk ~${walkMinutes}min / Drive ~${driveMinutes}min. Stand by for backup coordination.`;

          try {
            const openai = getOpenAI();
            if (openai) {
              const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: "You are an emergency dispatch AI. Write a concise 1-sentence priority alert for a nearby volunteer. Include type, distance, and estimated travel time. Be direct and urgent." },
                  { role: "user", content: `Crisis type: ${typeLabel}. Distance to you: ${distKm < 1 ? Math.round(distKm * 1000) + " meters" : distKm.toFixed(2) + " km"}. Walk time: ~${walkMinutes} min. Drive time: ~${driveMinutes} min. Description: ${crisisRequest.description?.slice(0, 100) ?? ""}` },
                ],
                max_tokens: 120,
              });
              const msg = completion.choices[0]?.message?.content;
              if (msg) dispatchMessage = msg;
            }
          } catch (aiErr) {
            console.error("Proximity alert AI failed, using fallback:", aiErr);
          }

          io.to("volunteers").emit("priority_alert", {
            id: `pa-${task.id}-${Date.now()}`,
            targetEmail: nearest.email,
            crisisId: String(requestId),
            crisisType: (crisisRequest.type as string).toLowerCase() as "medical" | "food_water" | "rescue",
            crisisLat: crisisRequest.lat,
            crisisLng: crisisRequest.lng,
            description: crisisRequest.description,
            claimedBy: user?.email ?? req.user!.email,
            nearestVolunteerEmail: nearest.email,
            nearestVolunteerName: nearest.name,
            distanceKm: Math.round(distKm * 100) / 100,
            walkMinutes, driveMinutes, dispatchMessage,
            timestamp: new Date().toISOString(),
          });

          // Push notification to nearest volunteer
          (async () => {
            try {
              await sendPushToUser(
                nearest.email,
                "🚨 Priority Alert Nearby",
                dispatchMessage,
                { type: "priority_alert", requestId: String(requestId), crisisLat: crisisRequest.lat, crisisLng: crisisRequest.lng }
              );
            } catch (e) {
              console.error("[Push] Priority alert notification failed:", e);
            }
          })();

          console.log(`Priority alert dispatched to ${nearest.email} (${distKm.toFixed(2)}km from crisis ${requestId})`);
        } catch (proximityErr) {
          console.error("Proximity router error:", proximityErr);
        }
      });

      await activityLogCreate({
        action: "TASK_CLAIMED",
        details: `Volunteer "${user?.name ?? req.user!.email}" (${user?.publicId ?? "no-id"}) claimed ${crisisRequest.type} request ${requestId}` +
          (requesterUser ? ` submitted by "${requesterUser.name}" (${requesterUser.publicId ?? "no-id"})` : ""),
        performedById: req.user!.userId,
        targetUserId: crisisRequest.userId,
      });

      (async () => {
        try {
          const requesterEmail = requesterUser?.email ?? crisisRequest.user?.email ?? null;
          const volunteerEmail = user?.email ?? req.user!.email ?? null;
          const emailData = {
            requestId: Number(requestId),
            type: crisisRequest.type,
            description: crisisRequest.description,
            lat: crisisRequest.lat,
            lng: crisisRequest.lng,
            createdAt: crisisRequest.createdAt,
            requesterEmail,
            requesterName: requesterUser?.name ?? crisisRequest.user?.name ?? null,
            volunteerEmail,
            volunteerName: user?.name ?? null,
          };

          await Promise.all([
            requesterEmail ? sendClaimedRequesterAlert(requesterEmail, emailData) : Promise.resolve(),
            volunteerEmail ? sendClaimedVolunteerAlert(volunteerEmail, emailData) : Promise.resolve(),
          ]);
        } catch (err) {
          console.error("[Email] Claim notification error:", err);
        }
      })();

      res.json({
        taskId: task.id,
        requestId: String(requestId),
        aiRoutePlan: task.aiRoutePlan,
        status: task.status,
        requester: requesterUser ? {
          name: requesterUser.name,
          email: requesterUser.email,
          phone: requesterUser.phone ?? null,
          address: requesterUser.address ?? null,
          publicId: requesterUser.publicId ?? null,
        } : null,
      });
    } catch (error: any) {
      if (error?.statusCode === 409) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Claim task error:", error);
      res.status(500).json({ error: "Failed to claim task" });
    }
  });

  // ── AGENTIC AUTO-DISPATCH ─────────────────────────────────────────────────
  router.post("/api/tasks/agent-dispatch", requireAuth as any, checkBanned as any, async (req: AuthRequest, res) => {
    try {
      const { requestId } = req.body;
      if (!requestId) {
        return res.status(400).json({ error: "requestId is required" });
      }

      const crisisRequest = await requestFindById(String(requestId));
      if (!crisisRequest) {
        return res.status(404).json({ error: "Request not found" });
      }
      if (crisisRequest.status === "CLAIMED") {
        return res.status(409).json({ error: "Request already claimed" });
      }

      // Agent: find nearest available on-duty volunteer
      const nearest = findNearestVolunteer(crisisRequest.lat, crisisRequest.lng, "");
      if (!nearest) {
        return res.status(404).json({ error: "No available on-duty volunteers found" });
      }

      const volunteerUser = await userFindById(nearest.volunteerId);
      if (!volunteerUser) {
        return res.status(404).json({ error: "Nearest volunteer account not found" });
      }

      // Check volunteer doesn't already have an active task
      const existingActiveTask = await taskFindFirst({
        volunteerId: nearest.volunteerId,
        status: { not: "COMPLETED" },
      });
      if (existingActiveTask) {
        return res.status(409).json({ error: "Nearest volunteer already has an active task" });
      }

      const typeLabels: Record<string, string> = {
        MEDICAL: "Medical Emergency",
        FOOD_WATER: "Food/Water Supply",
        RESCUE: "Rescue Operation",
      };

      let aiRoutePlan = `Agent-dispatched route for ${typeLabels[crisisRequest.type] || crisisRequest.type} at [${Number(crisisRequest.lat).toFixed(4)}, ${Number(crisisRequest.lng).toFixed(4)}]. Proceed with standard emergency protocol. Required Gear: First Aid Kit, Flashlight, Radio.`;

      try {
        const openai = getOpenAI();
        if (openai) {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are an emergency logistics AI. Provide a 2-sentence highly optimized route and a short list of required gear for an emergency responder heading to a crisis." },
              { role: "user", content: `Crisis Type: ${typeLabels[crisisRequest.type] || crisisRequest.type}. Coordinates: [${Number(crisisRequest.lat).toFixed(4)}, ${Number(crisisRequest.lng).toFixed(4)}]. Description: ${crisisRequest.description}` },
            ],
            max_tokens: 512,
          });
          const aiResponse = completion.choices[0]?.message?.content;
          if (aiResponse) aiRoutePlan = aiResponse;
        }
      } catch (aiError) {
        console.error("AI route plan generation failed, using fallback:", aiError);
      }

      let task: Record<string, any>;
      try {
        task = await claimRequestTransaction(String(requestId), nearest.volunteerId, aiRoutePlan);
      } catch (e: any) {
        if (e.message === "ALREADY_CLAIMED" || e.message === "NOT_FOUND") {
          return res.status(409).json({ error: "Request already claimed" });
        }
        throw e;
      }

      const requesterUser = await userFindById(crisisRequest.userId);

      io.emit("crisis_claimed", {
        requestId: String(requestId),
        claimedBy: volunteerUser.email,
        taskId: task.id,
        aiRoutePlan: task.aiRoutePlan,
        agentDispatched: true,
      });

      // Notify the assigned volunteer
      io.to("volunteers").emit("priority_alert", {
        id: `pa-${task.id}-${Date.now()}`,
        targetEmail: volunteerUser.email,
        crisisId: String(requestId),
        crisisType: (crisisRequest.type as string).toLowerCase() as "medical" | "food_water" | "rescue",
        crisisLat: crisisRequest.lat,
        crisisLng: crisisRequest.lng,
        description: crisisRequest.description,
        claimedBy: volunteerUser.email,
        nearestVolunteerEmail: volunteerUser.email,
        nearestVolunteerName: volunteerUser.name,
        distanceKm: Math.round(nearest.distanceKm * 100) / 100,
        walkMinutes: Math.round((nearest.distanceKm / 5) * 60),
        driveMinutes: Math.round((nearest.distanceKm / 40) * 60),
        dispatchMessage: `AGENT DISPATCH: You have been auto-assigned to a ${typeLabels[crisisRequest.type] || crisisRequest.type} (${nearest.distanceKm < 1 ? Math.round(nearest.distanceKm * 1000) + "m" : nearest.distanceKm.toFixed(1) + "km"} away).`,
        timestamp: new Date().toISOString(),
      });

      // Push notification to assigned volunteer
      (async () => {
        try {
          await sendPushToUser(
            volunteerUser.email,
            "🤖 Agent Dispatch",
            `You've been auto-assigned to a ${typeLabels[crisisRequest.type] || crisisRequest.type} (${nearest.distanceKm < 1 ? Math.round(nearest.distanceKm * 1000) + "m" : nearest.distanceKm.toFixed(1) + "km"} away).`,
            { type: "agent_dispatch", requestId: String(requestId), crisisLat: crisisRequest.lat, crisisLng: crisisRequest.lng }
          );
        } catch (e) {
          console.error("[Push] Agent dispatch notification failed:", e);
        }
      })();

      // Push notification to requester
      (async () => {
        try {
          if (requesterUser?.email) {
            await sendPushToUser(
              requesterUser.email,
              "✅ Help is on the way",
              `A volunteer has been automatically dispatched to your ${crisisRequest.type} request.`,
              { type: "crisis_claimed", requestId: String(requestId), agentDispatched: true }
            );
          }
        } catch (e) {
          console.error("[Push] Requester dispatch notification failed:", e);
        }
      })();

      await activityLogCreate({
        action: "AGENT_DISPATCH",
        details: `Agent auto-dispatched ${crisisRequest.type} request ${requestId} to volunteer "${volunteerUser.name}" (${volunteerUser.email}) at ${nearest.distanceKm.toFixed(2)}km`,
        performedById: req.user!.userId,
        targetUserId: nearest.volunteerId,
      });

      (async () => {
        try {
          const requesterEmail = requesterUser?.email ?? crisisRequest.user?.email ?? null;
          const emailData = {
            requestId: Number(requestId),
            type: crisisRequest.type,
            description: crisisRequest.description,
            lat: crisisRequest.lat,
            lng: crisisRequest.lng,
            createdAt: crisisRequest.createdAt,
            requesterEmail,
            requesterName: requesterUser?.name ?? crisisRequest.user?.name ?? null,
            volunteerEmail: volunteerUser.email,
            volunteerName: volunteerUser.name,
          };

          await Promise.all([
            requesterEmail ? sendClaimedRequesterAlert(requesterEmail, emailData) : Promise.resolve(),
            volunteerUser.email ? sendClaimedVolunteerAlert(volunteerUser.email, emailData) : Promise.resolve(),
          ]);
        } catch (err) {
          console.error("[Email] Agent dispatch notification error:", err);
        }
      })();

      res.json({
        taskId: task.id,
        requestId: String(requestId),
        aiRoutePlan: task.aiRoutePlan,
        status: task.status,
        dispatchedTo: {
          name: volunteerUser.name,
          email: volunteerUser.email,
          distanceKm: nearest.distanceKm,
        },
        agentDispatched: true,
      });
    } catch (error: any) {
      console.error("Agent dispatch error:", error);
      res.status(500).json({ error: "Failed to dispatch agent" });
    }
  });

  router.get("/api/tasks/mine", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const tasks = await taskFindMany({
        where: { volunteerId: req.user!.userId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
        includeRequest: true,
      });

      const formatted = tasks.map((t: any) => ({
        id: t.request?.id,
        taskId: t.id,
        type: (t.request?.type as string)?.toLowerCase() as "medical" | "food_water" | "rescue",
        description: t.request?.description,
        lng: t.request?.lng,
        lat: t.request?.lat,
        createdAt: t.request?.createdAt,
        claimed: true,
        claimedBy: req.user!.email,
        createdBy: t.request?.user?.email ?? null,
        aiRoutePlan: t.aiRoutePlan,
        taskStatus: t.status,
        requester: t.request?.user ? {
          name: t.request.user.name,
          email: t.request.user.email,
          phone: t.request.user.phone ?? null,
          address: t.request.user.address ?? null,
          publicId: t.request.user.publicId ?? null,
        } : null,
      }));

      res.json(formatted);
    } catch (error) {
      console.error("Fetch my tasks error:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Volunteer task history — shows completed/resolved tasks for this volunteer
  router.get("/api/tasks/history", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const tasks = await taskFindMany({
        where: { volunteerId: req.user!.userId, status: "COMPLETED" },
        includeRequest: true,
      });

      const formatted = tasks.map((t: any) => ({
        id: t.request?.id,
        taskId: t.id,
        type: (t.request?.type as string)?.toLowerCase() as "medical" | "food_water" | "rescue",
        description: t.request?.description,
        lng: t.request?.lng,
        lat: t.request?.lat,
        createdAt: t.request?.createdAt,
        resolvedAt: t.resolvedAt,
        status: "RESOLVED",
        aiRoutePlan: t.aiRoutePlan,
        requester: t.request?.user ? {
          name: t.request.user.name,
          email: t.request.user.email,
        } : null,
      }));

      res.json(formatted);
    } catch (error) {
      console.error("Fetch task history error:", error);
      res.status(500).json({ error: "Failed to fetch task history" });
    }
  });

  router.post("/api/requests/:id/resolve", requireAuth as any, checkBanned as any, async (req: AuthRequest, res) => {
    try {
      const requestId = req.params.id;

      const task = await taskFindFirst({ requestId, volunteerId: req.user!.userId });
      if (!task) {
        return res.status(404).json({ error: "Task not found for this request" });
      }

      // Mark this responder's task as completed
      await taskUpdate(task.id, { status: "COMPLETED", resolvedAt: new Date().toISOString() });

      // Multi-responder: only mark request RESOLVED when ALL tasks are completed
      const allTasks = await taskFindMany({ where: { requestId } });
      const allCompleted = allTasks.every((t: any) => t.status === "COMPLETED");
      if (allCompleted) {
        await requestUpdate(requestId, { status: "RESOLVED" });
        io.emit("crisis_resolved", { requestId });
        // Promote next queued request for the requester
        const resolvedReq = await requestFindById(requestId);
        if (resolvedReq?.userId) {
          await promoteQueuedRequest(resolvedReq.userId, io);
        }
      } else {
        // Emit partial resolve so other responders know one has completed
        io.emit("crisis_partial_resolved", { requestId, completedBy: req.user!.email, remainingResponders: allTasks.filter((t: any) => t.status !== "COMPLETED").length });
      }

      const resolverEmail = req.user!.email;
      const shiftEntry = volunteerShiftStore.get(resolverEmail);
      if (shiftEntry) {
        shiftEntry.tasksResolved += 1;
        volunteerShiftStore.set(resolverEmail, shiftEntry);
      }

      // Push notification to requester on resolve
      (async () => {
        try {
          const fullRequest = await requestFindById(requestId);
          if (fullRequest?.user?.email) {
            await sendPushToUser(
              fullRequest.user.email,
              "✅ Crisis Resolved",
              `Your ${fullRequest.type} request has been marked as resolved by the volunteer.`,
              { type: "crisis_resolved", requestId }
            );
          }
        } catch (e) {
          console.error("[Push] Resolve notification failed:", e);
        }
      })();

      // Resolution emails: notify the requester, all staff/admins, and all
      // volunteers (so the dispatch network sees the close-out). Best-effort:
      // never fail the request because of mail transport.
      (async () => {
        try {
          const fullRequest = await requestFindById(requestId);
          if (!fullRequest) return;
          const [requester, volunteer, staffUsers, volunteerUsers] = await Promise.all([
            userFindById(fullRequest.userId),
            userFindById(req.user!.userId),
            userFindMany({
              where: { role: { in: ["STAFF", "ADMIN", "SUPERADMIN"] }, banned: false },
            }),
            userFindMany({ where: { role: "VOLUNTEER", banned: false } }),
          ]);
          const recipientEmails = new Set<string>();
          if (requester?.email && requester.email !== "anonymous@crisisgrid.app") {
            recipientEmails.add(requester.email);
          }
          for (const u of staffUsers as any[]) if (u.email) recipientEmails.add(u.email);
          for (const u of volunteerUsers as any[]) if (u.email) recipientEmails.add(u.email);

          console.log(
            `[Email] Resolved #${requestId} — broadcasting to ${recipientEmails.size} recipient(s)`,
          );
          await Promise.all(
            Array.from(recipientEmails).map((to) =>
              sendCrisisResolved(to, {
                requestId,
                type: fullRequest.type as "MEDICAL" | "FOOD_WATER" | "RESCUE",
                description: fullRequest.description,
                volunteerName: volunteer?.name ?? null,
                volunteerEmail: volunteer?.email ?? null,
              }).catch((err) => {
                console.error(`[Email] resolved → ${to} failed:`, err);
              }),
            ),
          );
        } catch (err) {
          console.error("Failed to send resolved email:", err);
        }
      })();

      await activityLogCreate({
        action: "TASK_RESOLVED",
        details: `Request ${requestId} marked as resolved by volunteer (task ${task.id})`,
        performedById: req.user!.userId,
        targetUserId: task.volunteerId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Resolve task error:", error);
      res.status(500).json({ error: "Failed to resolve task" });
    }
  });

  router.post("/api/volunteer/location", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const { lat, lng } = req.body;
      if (lat == null || lng == null) {
        return res.status(400).json({ error: "lat and lng are required" });
      }
      if (!["VOLUNTEER", "STAFF", "ADMIN", "SUPERADMIN"].includes(req.user!.role)) {
        return res.status(403).json({ error: "Only responders can update location" });
      }

      const user = await userFindById(req.user!.userId);
      const existing = volunteerPositionStore.get(req.user!.email);
      const now = Date.now();
      volunteerPositionStore.set(req.user!.email, {
        volunteerId: req.user!.userId,
        email: req.user!.email,
        name: user?.name ?? req.user!.email.split("@")[0],
        lat, lng,
        timestamp: now,
        isAvailable: existing?.isAvailable !== false,
      });

      const shift = volunteerShiftStore.get(req.user!.email);
      if (shift && shift.sessionStart !== null) {
        if (shift.lastLat !== null && shift.lastLng !== null) {
          shift.distanceTraveledKm += haversineKm(shift.lastLat, shift.lastLng, lat, lng);
        }
        shift.lastLat = lat;
        shift.lastLng = lng;
        volunteerShiftStore.set(req.user!.email, shift);
      }

      io.emit("volunteer_location", {
        volunteerId: req.user!.userId,
        email: req.user!.email,
        lat, lng,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Update volunteer location error:", error);
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  router.post("/api/volunteer/availability", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      if (!["VOLUNTEER", "STAFF", "ADMIN", "SUPERADMIN"].includes(req.user!.role)) {
        return res.status(403).json({ error: "Only responders can update availability" });
      }
      const { isAvailable } = req.body;
      if (typeof isAvailable !== "boolean") {
        return res.status(400).json({ error: "isAvailable must be a boolean" });
      }

      const existing = volunteerPositionStore.get(req.user!.email);
      if (existing) {
        existing.isAvailable = isAvailable;
        volunteerPositionStore.set(req.user!.email, existing);
      }

      const userRecord = await userFindById(req.user!.userId);
      const userName = userRecord?.name ?? req.user!.email.split("@")[0];

      const now = Date.now();
      let shift = volunteerShiftStore.get(req.user!.email);
      if (isAvailable) {
        if (!shift) {
          shift = { email: req.user!.email, name: userName, sessionStart: now, accumulatedMs: 0, tasksResolved: 0, distanceTraveledKm: 0, lastLat: null, lastLng: null };
        } else {
          shift.sessionStart = now;
        }
      } else {
        if (shift && shift.sessionStart !== null) {
          shift.accumulatedMs += now - shift.sessionStart;
          shift.sessionStart = null;
        }
      }
      if (shift) volunteerShiftStore.set(req.user!.email, shift);

      io.to("volunteers").emit("volunteer_availability", {
        email: req.user!.email, isAvailable, timestamp: new Date().toISOString(),
      });
      console.log(`Volunteer ${req.user!.email} is now ${isAvailable ? "ON DUTY" : "OFF DUTY"}`);
      res.json({ success: true, isAvailable });
    } catch (error) {
      console.error("Update availability error:", error);
      res.status(500).json({ error: "Failed to update availability" });
    }
  });

  router.post("/api/requests/:id/cancel", requireAuth as any, checkBanned as any, async (req: AuthRequest, res) => {
    try {
      const requestId = req.params.id;

      const request = await requestFindById(requestId);
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }
      if (request.userId !== req.user!.userId) {
        return res.status(403).json({ error: "You can only cancel your own requests" });
      }
      if (request.status === "RESOLVED") {
        return res.status(400).json({ error: "Request already resolved" });
      }

      // Mark request as CANCELLED and release any assigned volunteer
      await requestUpdate(requestId, { status: "CANCELLED" });

      // Find and release the volunteer's task if claimed
      const claimedTask = await taskFindFirst({ requestId, status: { not: "COMPLETED" } });
      if (claimedTask) {
        await taskUpdate(claimedTask.id, { status: "COMPLETED", resolvedAt: new Date().toISOString() });
        const volunteer = await userFindById(claimedTask.volunteerId);
        if (volunteer?.email) {
          io.to("volunteers").emit("task_cancelled_by_requester", {
            requestId,
            taskId: claimedTask.id,
            volunteerEmail: volunteer.email,
            reason: "Requester cancelled their crisis request",
          });
          // Push notification to volunteer
          (async () => {
            try {
              await sendPushToUser(
                volunteer.email,
                "Task Cancelled by Requester",
                "The crisis request you accepted has been cancelled by the requester.",
                { type: "task_cancelled", requestId }
              );
            } catch (e) {
              console.error("[Push] Task cancel notification failed:", e);
            }
          })();
        }
      }

      io.emit("crisis_cancelled", { requestId });

      // Promote next queued request for the requester
      if (request.userId) {
        await promoteQueuedRequest(request.userId, io);
      }

      // Spam-cancel guard. Each civilian (VICTIM) cancel increments a
      // counter on the user record; the 5th lifetime cancel auto-bans the
      // account. Firestore is schemaless — the `cancelCount` and
      // `bannedAt` / `banReason` fields are added on first write.
      const me = await userFindById(req.user!.userId);
      const role = (me?.role || "").toUpperCase();
      let warning: string | null = null;
      let banned = false;
      const previous = Number((me as any)?.cancelCount) || 0;
      const cancelCount = previous + 1;

      if (role === "VICTIM") {
        try {
          if (cancelCount >= 5) {
            banned = true;
            await userUpdate(req.user!.userId, {
              cancelCount,
              banned: true,
              bannedAt: new Date().toISOString(),
              banReason: "Auto-ban: 5+ cancellations",
            });
            console.log(
              `[Ban] Auto-banned user ${req.user!.email} after ${cancelCount} cancels`,
            );
            await activityLogCreate({
              action: "AUTO_BAN_CANCELLATIONS",
              details: `User auto-banned after ${cancelCount} cancellations`,
              performedById: req.user!.userId,
              targetUserId: req.user!.userId,
            });
          } else {
            await userUpdate(req.user!.userId, { cancelCount });
            console.log(
              `[Cancel] ${req.user!.email} cancelCount: ${previous} → ${cancelCount}`,
            );
            if (cancelCount >= 3) {
              warning = `You've cancelled ${cancelCount} requests. ${5 - cancelCount
                } more and your account will be auto-banned.`;
            }
          }
        } catch (writeErr) {
          // Surface the underlying Firestore error so we can diagnose if
          // the document hasn't been initialized correctly.
          console.error("[Cancel] Failed to update user cancelCount:", writeErr);
        }
      }

      await activityLogCreate({
        action: "REQUEST_CANCELLED",
        details: `User cancelled their own ${request.type} request ${requestId}`,
        performedById: req.user!.userId,
        targetUserId: req.user!.userId,
      });

      res.json({ success: true, cancelCount, warning, banned });
    } catch (error) {
      console.error("Cancel request error:", error);
      res.status(500).json({ error: "Failed to cancel request" });
    }
  });

  router.post("/api/contact", async (req, res) => {
    try {
      const { orgName, contactName, email, phone, message } = req.body;
      if (!orgName || !contactName || !email || !message) {
        return res.status(400).json({ error: "Organization name, contact name, email, and message are required" });
      }
      const submission = await contactSubmissionCreate({ orgName, contactName, email, phone: phone || null, message });
      res.status(201).json({ success: true, id: submission.id });
    } catch (error) {
      console.error("Contact submission error:", error);
      res.status(500).json({ error: "Failed to submit contact form" });
    }
  });

  router.post("/api/requests/:id/report-fraud", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const requestId = req.params.id;
      const { reason } = req.body;

      const request = await requestFindById(requestId);
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      await activityLogCreate({
        action: "REPORT_FRAUD",
        details: `Fraud reported on request ${requestId}${reason ? `: ${reason}` : ""}`,
        performedById: req.user!.userId,
        targetUserId: request.userId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Report fraud error:", error);
      res.status(500).json({ error: "Failed to report fraud" });
    }
  });

  // ── ADMIN ─────────────────────────────────────────────────────────────────

  router.get("/api/admin/stats", requireAuth as any, requireAdmin as any, async (_req: AuthRequest, res) => {
    try {
      const [totalUsers, totalVolunteers, totalRequests, activeRequests, resolvedRequests, bannedUsers, lockedUsers] =
        await Promise.all([
          userCount(),
          userCount({ where: { role: "VOLUNTEER" } }),
          requestCount(),
          requestCount({ where: { status: { in: ["ACTIVE", "CLAIMED"] } } }),
          requestCount({ where: { status: "RESOLVED" } }),
          userCount({ where: { banned: true } }),
          userCount({ where: { lockedUntil: { gt: new Date() } } }),
        ]);

      res.json({ totalUsers, totalVolunteers, totalRequests, activeRequests, resolvedRequests, bannedUsers, lockedUsers });
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  router.get("/api/admin/security-summary", requireAuth as any, requireAdmin as any, async (req: AuthRequest, res) => {
    try {
      const now = new Date();
      const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [blocked24h, blocked7d, recentBlockedResult, recentAdminLoginsResult] = await Promise.all([
        activityLogCount({ where: { action: "ROLE_CHANGE_BLOCKED", createdAt: { gte: ago24h } } }),
        activityLogCount({ where: { action: "ROLE_CHANGE_BLOCKED", createdAt: { gte: ago7d } } }),
        activityLogFindMany({ where: { action: "ROLE_CHANGE_BLOCKED" }, take: 5, includePerformedBy: true, includeTargetUser: true }),
        activityLogFindMany({ where: { action: "USER_LOGIN" }, take: 8, includePerformedBy: true }),
      ]);

      const recentBlocked = recentBlockedResult.logs;
      const allAdminLogins = recentAdminLoginsResult.logs.filter(
        (l: any) => l.performedBy && ["STAFF", "ADMIN", "SUPERADMIN"].includes(l.performedBy.role)
      );

      res.json({ blocked24h, blocked7d, recentBlocked, recentAdminLogins: allAdminLogins });
    } catch (error) {
      console.error("Security summary error:", error);
      res.status(500).json({ error: "Failed to fetch security summary" });
    }
  });

  router.get("/api/admin/users", requireAuth as any, requireAdmin as any, async (req: AuthRequest, res) => {
    try {
      const { search, role, banned, locked, page = "1", limit = "20" } = req.query as Record<string, string>;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      const where: Record<string, any> = {};
      const orConditions: Record<string, any>[] | null = search
        ? [
          { name: { contains: search } },
          { email: { contains: search } },
          { publicId: { contains: search } },
        ]
        : null;

      if (role) where.role = role;
      if (banned === "true") where.banned = true;
      if (locked === "true") where.lockedUntil = { gt: new Date() };

      const allUsers = await userFindMany({
        where: orConditions ? { ...where, OR: orConditions } : where,
      });

      const total = allUsers.length;
      const skip = (pageNum - 1) * limitNum;
      const users = allUsers.slice(skip, skip + limitNum).map((u: any) => ({
        ...u,
        _count: { requests: 0, tasks: 0 },
      }));

      const filterDesc = [
        search ? `search="${search}"` : null,
        role ? `role=${role}` : null,
        banned === "true" ? "banned=true" : null,
        locked === "true" ? "locked=true" : null,
        pageNum > 1 ? `page=${pageNum}` : null,
      ].filter(Boolean).join(", ");

      await activityLogCreate({
        action: "ADMIN_VIEWED_USERS",
        details: `${req.user!.role} viewed user list${filterDesc ? ` with filters: ${filterDesc}` : ""}. ${total} users matched.`,
        performedById: req.user!.userId,
      });

      res.json({ users, total, page: pageNum, limit: limitNum });
    } catch (error) {
      console.error("Admin users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  router.patch("/api/admin/users/:id/role", requireAuth as any, requireAdmin as any, async (req: AuthRequest, res) => {
    try {
      const userId = req.params.id;
      const { role } = req.body;
      if (!VALID_ROLES.includes(role as DbRole)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const user = await userFindById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const actorRole = req.user!.role;
      const actorLevel = ROLE_LEVEL[actorRole] ?? 0;
      const targetCurrentLevel = ROLE_LEVEL[user.role] ?? 0;
      const targetNewLevel = ROLE_LEVEL[role] ?? 0;

      if (actorRole !== "SUPERADMIN") {
        if (targetCurrentLevel >= actorLevel) {
          const blockedDetails = `Blocked attempt to modify ${user.role} user "${user.name}" (${user.publicId || user.email}). Actor ${actorRole} lacks sufficient level.`;
          await activityLogCreate({
            action: "ROLE_CHANGE_BLOCKED",
            details: blockedDetails,
            performedById: req.user!.userId,
            targetUserId: userId,
          });
          io.emit("security_alert", {
            type: "ROLE_CHANGE_BLOCKED",
            actorName: req.user!.email, actorRole,
            targetName: user.name, targetRole: user.role,
            details: blockedDetails, timestamp: new Date().toISOString(),
          });
          return res.status(403).json({
            error: `You cannot modify a user with role ${user.role}. You can only manage users below your own role level.`,
          });
        }
        if (targetNewLevel > actorLevel) {
          const blockedDetails = `Blocked attempt to assign ${role} role to "${user.name}" (${user.publicId || user.email}). Actor ${actorRole} cannot assign roles above their own level.`;
          await activityLogCreate({
            action: "ROLE_CHANGE_BLOCKED",
            details: blockedDetails,
            performedById: req.user!.userId,
            targetUserId: userId,
          });
          io.emit("security_alert", {
            type: "ROLE_CHANGE_BLOCKED",
            actorName: req.user!.email, actorRole,
            targetName: user.name, targetRole: user.role,
            details: blockedDetails, timestamp: new Date().toISOString(),
          });
          return res.status(403).json({
            error: `You cannot assign the ${role} role. You can only assign roles up to your own level (${actorRole}).`,
          });
        }
      }

      const oldRole = user.role;
      const newPublicId = await generatePublicId(role);
      await userUpdate(userId, { role, publicId: newPublicId });

      await activityLogCreate({
        action: "ROLE_CHANGE",
        details: `Role changed from ${oldRole} to ${role}. Old ID: ${user.publicId || "none"}, New ID: ${newPublicId}`,
        performedById: req.user!.userId,
        targetUserId: userId,
      });

      // Notify user of role change
      (async () => {
        try {
          await sendPushToUser(
            user.email,
            "🔄 Role Updated",
            `Your CrisisGrid role has been changed from ${oldRole} to ${role}. Your new Public ID is ${newPublicId}.`,
            { type: "role_changed", oldRole, newRole: role, newPublicId }
          );
        } catch (e) {
          console.error("[Push] Role change notification failed:", e);
        }
      })();

      res.json({ success: true, publicId: newPublicId });
    } catch (error) {
      console.error("Admin role change error:", error);
      res.status(500).json({ error: "Failed to change role" });
    }
  });

  router.patch("/api/admin/users/:id/ban", requireAuth as any, requireAdmin as any, async (req: AuthRequest, res) => {
    try {
      const userId = req.params.id;
      const { banned } = req.body;

      const user = await userFindById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await userUpdate(userId, { banned: !!banned });

      await activityLogCreate({
        action: banned ? "BAN_USER" : "UNBAN_USER",
        details: `${banned ? "Banned" : "Unbanned"} user: ${user.name} (${user.email})`,
        performedById: req.user!.userId,
        targetUserId: userId,
      });

      // Notify user of ban/unban
      (async () => {
        try {
          if (banned) {
            await sendPushToUser(
              user.email,
              "⛔ Account Banned",
              "Your CrisisGrid account has been suspended by an administrator. Contact support for more information.",
              { type: "account_banned", bannedBy: req.user!.email }
            );
          } else {
            await sendPushToUser(
              user.email,
              "✅ Account Restored",
              "Your CrisisGrid account has been restored. You can now sign in again.",
              { type: "account_unbanned", unbannedBy: req.user!.email }
            );
          }
        } catch (e) {
          console.error("[Push] Ban/unban notification failed:", e);
        }
      })();

      res.json({ success: true });
    } catch (error) {
      console.error("Admin ban error:", error);
      res.status(500).json({ error: "Failed to update ban status" });
    }
  });

  router.patch("/api/admin/users/:id/reset-cancel-count", requireAuth as any, requireAdmin as any, async (req: AuthRequest, res) => {
    try {
      const userId = req.params.id;
      const user = await userFindById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await userUpdate(userId, { cancelCount: 0 });

      await activityLogCreate({
        action: "CANCEL_COUNT_RESET",
        details: `Cancel count reset for "${user.name}" (${user.email}) by ${req.user!.role}`,
        performedById: req.user!.userId,
        targetUserId: userId,
      });

      res.json({ success: true, cancelCount: 0 });
    } catch (error) {
      console.error("Reset cancel count error:", error);
      res.status(500).json({ error: "Failed to reset cancel count" });
    }
  });

  router.patch("/api/admin/users/:id/unlock", requireAuth as any, requireAdmin as any, async (req: AuthRequest, res) => {
    try {
      const userId = req.params.id;

      const user = await userFindById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (!user.lockedUntil || new Date(user.lockedUntil) <= new Date()) {
        return res.status(400).json({ error: "Account is not currently locked" });
      }

      await userUpdate(userId, { failedLoginAttempts: 0, lockedUntil: null });

      await activityLogCreate({
        action: "ACCOUNT_UNLOCKED",
        details: `Account manually unlocked for "${user.name}" (${user.email}) by ${req.user!.role}`,
        performedById: req.user!.userId,
        targetUserId: userId,
      });

      // Notify user their account was unlocked
      (async () => {
        try {
          await sendPushToUser(
            user.email,
            "🔓 Account Unlocked",
            "Your CrisisGrid account has been manually unlocked by an administrator. You can now sign in.",
            { type: "account_unlocked", unlockedBy: req.user!.email }
          );
        } catch (e) {
          console.error("[Push] Unlock notification failed:", e);
        }
      })();

      res.json({ success: true });
    } catch (error) {
      console.error("Admin unlock error:", error);
      res.status(500).json({ error: "Failed to unlock account" });
    }
  });

  router.get("/api/admin/logs", requireAuth as any, requireAdmin as any, async (req: AuthRequest, res) => {
    try {
      const { search, action, page = "1", limit = "30" } = req.query as Record<string, string>;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      const where: Record<string, any> = {};
      if (action) where.action = action;
      if (search) {
        where.OR = [
          { details: { contains: search } },
          { action: { contains: search } },
        ];
      }

      const skip = (pageNum - 1) * limitNum;
      const { logs, total } = await activityLogFindMany({
        where,
        skip,
        take: limitNum,
        includePerformedBy: true,
        includeTargetUser: true,
      });

      res.json({ logs, total, page: pageNum, limit: limitNum });
    } catch (error) {
      console.error("Admin logs error:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  router.get("/api/admin/requests", requireAuth as any, requireAdmin as any, async (_req: AuthRequest, res) => {
    try {
      const requests = await requestFindMany({ includeUser: true, includeTasks: true });

      const formatted = requests.map((r: any) => ({
        id: r.id,
        type: (r.type as string).toLowerCase(),
        description: r.description,
        lng: r.lng,
        lat: r.lat,
        createdAt: r.createdAt,
        claimed: r.status === "CLAIMED",
        claimedBy: r.tasks?.[0]?.volunteer?.email ?? null,
        createdBy: r.user?.email ?? null,
        status: r.status,
      }));

      res.json(formatted);
    } catch (error) {
      console.error("Admin requests error:", error);
      res.status(500).json({ error: "Failed to fetch requests" });
    }
  });

  // ── SAFE ZONES ────────────────────────────────────────────────────────────

  router.get("/api/safe-zones", async (_req, res) => {
    try {
      const zones = await safeZoneFindMany();
      res.json(zones);
    } catch (error) {
      console.error("Safe zones fetch error:", error);
      res.status(500).json({ error: "Failed to fetch safe zones" });
    }
  });

  router.post("/api/admin/safe-zones", requireAuth as any, requireAdmin as any, async (req: AuthRequest, res) => {
    try {
      const { name, type, lat, lng, description } = req.body;
      if (!name || !type || lat == null || lng == null) {
        return res.status(400).json({ error: "name, type, lat, lng are required" });
      }
      const zone = await safeZoneCreate({
        name, type, lat: Number(lat), lng: Number(lng),
        description: description || null,
        createdById: req.user!.userId,
      });
      io.emit("safe_zone_added", zone);
      res.json(zone);
    } catch (error) {
      console.error("Safe zone create error:", error);
      res.status(500).json({ error: "Failed to create safe zone" });
    }
  });

  router.delete("/api/admin/safe-zones/:id", requireAuth as any, requireAdmin as any, async (req: AuthRequest, res) => {
    try {
      const id = req.params.id;
      await safeZoneDelete(id);
      io.emit("safe_zone_removed", { id });
      res.json({ success: true });
    } catch (error) {
      console.error("Safe zone delete error:", error);
      res.status(500).json({ error: "Failed to delete safe zone" });
    }
  });

  // ── VOLUNTEER SHIFTS ──────────────────────────────────────────────────────

  // ── PUSH NOTIFICATIONS ────────────────────────────────────────────────────
  router.post("/api/push/register", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Push token is required" });
      const success = await registerPushToken(req.user!.email, token, req.user!.role);
      res.json({ success, message: success ? "Token registered" : "Invalid token" });
    } catch (error) {
      console.error("Push register error:", error);
      res.status(500).json({ error: "Failed to register push token" });
    }
  });

  router.post("/api/push/unregister", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Push token is required" });
      await unregisterPushToken(req.user!.email, token);
      res.json({ success: true, message: "Token unregistered" });
    } catch (error) {
      console.error("Push unregister error:", error);
      res.status(500).json({ error: "Failed to unregister push token" });
    }
  });

  router.post("/api/push/unregister-all", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      await unregisterAllPushTokens(req.user!.email);
      res.json({ success: true, message: "All tokens unregistered" });
    } catch (error) {
      console.error("Push unregister-all error:", error);
      res.status(500).json({ error: "Failed to unregister all push tokens" });
    }
  });

  // Diagnostic: get my registered push tokens
  router.get("/api/push/my-tokens", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const tokens = await getPushTokens(req.user!.email);
      res.json({ email: req.user!.email, tokenCount: tokens.length, tokens });
    } catch (error) {
      console.error("Push my-tokens error:", error);
      res.status(500).json({ error: "Failed to fetch tokens" });
    }
  });

  router.get("/api/volunteer/shift", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      if (req.user!.role !== "VOLUNTEER") {
        return res.status(403).json({ error: "Volunteers only" });
      }
      const shift = volunteerShiftStore.get(req.user!.email);
      if (!shift) return res.json(null);
      const liveMs = shift.sessionStart !== null ? Date.now() - shift.sessionStart : 0;
      return res.json({
        email: shift.email,
        name: shift.name,
        onDurationMs: shift.accumulatedMs + liveMs,
        tasksResolved: shift.tasksResolved,
        distanceTraveledKm: shift.distanceTraveledKm,
      });
    } catch (error) {
      console.error("Get shift error:", error);
      res.status(500).json({ error: "Failed to get shift" });
    }
  });

  // ── CIRO AI CHAT ──────────────────────────────────────────────────────────
  router.post("/api/ciro/chat", requireAuth as any, async (req: AuthRequest, res) => {
    try {
      const { question, context } = req.body;
      if (!question || typeof question !== "string") {
        return res.status(400).json({ error: "question is required" });
      }

      const openai = getOpenAI();
      if (!openai) {
        return res.status(503).json({ error: "AI service unavailable" });
      }

      // Build context from available scenario data
      let systemPrompt = `You are the CIRO (Crisis Intelligence & Response Orchestrator) AI Assistant. You help users understand crisis scenarios, incident data, and emergency response analytics.

You have access to:
- All CIRO scenario definitions (flood, multi_crisis, false_alarm, degraded)
- Real Islamabad coordinate data for G-10, F-8, I-8, Aabpara sectors
- Signal sources: social media, weather, traffic, sensors, field reports, emergency calls
- Resource allocation data: ambulances, rescue teams, traffic police, medics
- Action chain execution traces and outcomes

Respond concisely and factually. Use the scenario context provided by the user if available. If asked about specific incidents, reference the scenario data. Be helpful for emergency responders and analysts.`;

      const messages: any[] = [
        { role: "system", content: systemPrompt },
      ];

      if (context?.scenarioId) {
        messages.push({
          role: "system",
          content: `User is asking about scenario: ${context.scenarioId}. CIRO result data: ${JSON.stringify(context.result || {}, null, 2).slice(0, 4000)}`,
        });
      }

      messages.push({ role: "user", content: question });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 1024,
        temperature: 0.4,
      });

      const answer = completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";
      res.json({ answer });
    } catch (error: any) {
      console.error("CIRO chat error:", error);
      res.status(500).json({ error: "Failed to process question" });
    }
  });

  router.get("/api/admin/volunteer-shifts", requireAuth as any, requireAdmin as any, async (_req: AuthRequest, res) => {
    try {
      const now = Date.now();
      const result = Array.from(volunteerShiftStore.values())
        .filter((s) => s.sessionStart !== null || s.accumulatedMs > 0)
        .map((s) => ({
          email: s.email,
          name: s.name,
          onDurationMs: s.accumulatedMs + (s.sessionStart !== null ? now - s.sessionStart : 0),
          tasksResolved: s.tasksResolved,
          distanceTraveledKm: s.distanceTraveledKm,
        }))
        .sort((a, b) => b.onDurationMs - a.onDurationMs);
      res.json(result);
    } catch (error) {
      console.error("Get all shifts error:", error);
      res.status(500).json({ error: "Failed to get shifts" });
    }
  });

  return router;
}
