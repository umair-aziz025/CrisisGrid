import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { createRoutes } from "./routes.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import { userFindById, getActiveRequests, requestFindById, taskFindMany } from "./firestoreDb.js";

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const io = new SocketServer(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

export const volunteerSockets = new Set<string>();
export const adminSockets = new Set<string>();

export type VolunteerPositionEntry = {
  volunteerId: string;
  email: string;
  name: string;
  lat: number;
  lng: number;
  timestamp: number;
  isAvailable: boolean;
};

export const volunteerPositionStore = new Map<string, VolunteerPositionEntry>();

export type VolunteerShiftSession = {
  email: string;
  name: string;
  sessionStart: number | null;
  accumulatedMs: number;
  tasksResolved: number;
  distanceTraveledKm: number;
  lastLat: number | null;
  lastLng: number | null;
};

export const volunteerShiftStore = new Map<string, VolunteerShiftSession>();

export type ChatMessage = {
  id: string;
  requestId: string;
  senderEmail: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
  type?: "text" | "audio";
  audioBase64?: string;
  mimeType?: string;
  durationSec?: number;
};

export const chatStore = new Map<string, ChatMessage[]>();

const socketUsers = new Map<string, { userId: string; email: string; name: string; role: string }>();

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearestVolunteer(
  crisisLat: number,
  crisisLng: number,
  excludeEmail: string
): (VolunteerPositionEntry & { distanceKm: number }) | null {
  const cutoff = Date.now() - 5 * 60 * 1000;
  let best: (VolunteerPositionEntry & { distanceKm: number }) | null = null;
  for (const entry of volunteerPositionStore.values()) {
    if (entry.email === excludeEmail) continue;
    if (entry.timestamp < cutoff) continue;
    if (!entry.isAvailable) continue;
    const d = haversineKm(crisisLat, crisisLng, entry.lat, entry.lng);
    if (!best || d < best.distanceKm) best = { ...entry, distanceKm: d };
  }
  return best;
}

app.set("trust proxy", 1);

app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
app.use(cors({ origin: true }));
app.use(express.json({ limit: "10kb" }));

const adminApiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 120,
  message: { error: "Too many admin requests. Please slow down." },
  standardHeaders: true, legacyHeaders: false,
});

const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true, legacyHeaders: false,
});

app.use("/api/admin", adminApiLimiter);
app.use("/api", generalApiLimiter);

app.get("/api/health", async (_req, res) => {
  try {
    const { db } = await import("./firebase.js");
    await db().collection("_health").limit(1).get();
    res.json({ status: "ok", database: "firebase-connected" });
  } catch (error) {
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

app.use(createRoutes(io));

if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "..", "dist");
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      return next();
    }

    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

const JWT_SECRET = process.env.SESSION_SECRET || "crisisgrid-dev-secret";

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("authenticate", async (token: string) => {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; email: string };
      if (payload.role === "VOLUNTEER" || payload.role === "ADMIN") {
        socket.join("volunteers");
        volunteerSockets.add(socket.id);
        console.log(`Socket ${socket.id} (${payload.email}) joined volunteers room`);
      }
      if (payload.role === "ADMIN" || payload.role === "SUPERADMIN") {
        socket.join("admins");
        adminSockets.add(socket.id);
      }
      const dbUser = await userFindById(payload.userId);
      socketUsers.set(socket.id, {
        userId: payload.userId,
        email: payload.email,
        name: dbUser?.name ?? payload.email,
        role: payload.role,
      });
      socket.emit("authenticated", { userId: payload.userId, email: payload.email, role: payload.role });
    } catch {
      // invalid token — ignore silently
    }
  });

  socket.on("join_chat", async ({ requestId }: { requestId: string }) => {
    try {
      const user = socketUsers.get(socket.id);
      // Socket not yet authenticated — client will retry after receiving "authenticated"
      if (!user || !requestId) return;

      const request = await requestFindById(requestId);
      if (!request) {
        socket.emit("chat_error", { requestId, reason: "Request not found" });
        return;
      }

      const tasks = await taskFindMany({ where: { requestId } });
      const isRequester = request.userId === user.userId;
      const isAssignedVolunteer = tasks.some((t: any) => t.volunteerId === user.userId);
      const isAdmin = ["ADMIN", "SUPERADMIN", "STAFF"].includes(user.role);

      if (!isRequester && !isAssignedVolunteer && !isAdmin) {
        socket.emit("chat_error", { requestId, reason: "You are not authorized to join this chat" });
        return;
      }

      socket.join(`chat:${requestId}`);
      const history = chatStore.get(requestId) ?? [];
      socket.emit("chat_history", { requestId, messages: history });
    } catch (err) {
      console.error("join_chat error:", err);
      socket.emit("chat_error", { requestId, reason: "Server error joining chat" });
    }
  });

  socket.on("send_chat_message", ({ requestId, text }: { requestId: string; text: string }) => {
    try {
      const user = socketUsers.get(socket.id);
      if (!user || !text?.trim() || !requestId) return;
      if (!socket.rooms.has(`chat:${requestId}`)) return;

      const message: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        requestId,
        senderEmail: user.email,
        senderName: user.name,
        senderRole: user.role,
        text: text.trim().slice(0, 1000),
        timestamp: new Date().toISOString(),
        type: "text",
      };

      const history = chatStore.get(requestId) ?? [];
      history.push(message);
      if (history.length > 150) history.shift();
      chatStore.set(requestId, history);
      io.to(`chat:${requestId}`).emit("chat_message", message);
    } catch (err) {
      console.error("send_chat_message error:", err);
    }
  });

  socket.on("send_voice_note", ({ requestId, audioBase64, mimeType, durationSec }: { requestId: string; audioBase64: string; mimeType: string; durationSec: number }) => {
    try {
      const user = socketUsers.get(socket.id);
      if (!user || !audioBase64 || !requestId) return;
      if (!socket.rooms.has(`chat:${requestId}`)) return;
      if (audioBase64.length > 700000) return;

      const message: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        requestId,
        senderEmail: user.email,
        senderName: user.name,
        senderRole: user.role,
        text: "🎙️ Voice note",
        timestamp: new Date().toISOString(),
        type: "audio",
        audioBase64,
        mimeType: mimeType || "audio/webm",
        durationSec: Math.min(durationSec ?? 0, 120),
      };

      const history = chatStore.get(requestId) ?? [];
      history.push(message);
      if (history.length > 150) history.shift();
      chatStore.set(requestId, history);
      io.to(`chat:${requestId}`).emit("chat_message", message);
    } catch (err) {
      console.error("send_voice_note error:", err);
    }
  });

  // CIRO live-trace session: mobile app joins this room to receive streaming
  // trace entries emitted during a /api/ciro/analyze pipeline run
  socket.on("join_ciro_session", (sessionId: string) => {
    if (typeof sessionId === "string" && sessionId.length > 0 && sessionId.length < 80) {
      socket.join(`ciro:${sessionId}`);
      console.log(`Socket ${socket.id} joined CIRO session: ciro:${sessionId}`);
    }
  });

  socket.on("disconnect", () => {
    socketUsers.delete(socket.id);
    volunteerSockets.delete(socket.id);
    adminSockets.delete(socket.id);
    console.log(`Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Express server running on port ${PORT}`);
});

// Gap detection: every 30s emit uncovered ACTIVE requests to admins
setInterval(async () => {
  if (adminSockets.size === 0) return;
  try {
    const activeRequests = await getActiveRequests();
    const cutoff = Date.now() - 5 * 60 * 1000;
    const onlineVolunteers = [...volunteerPositionStore.values()].filter((v) => v.timestamp > cutoff);
    const gaps = activeRequests.map((req) => {
      let closest: number | null = null;
      for (const vol of onlineVolunteers) {
        const d = haversineKm(req.lat, req.lng, vol.lat, vol.lng);
        if (closest === null || d < closest) closest = d;
      }
      return {
        requestId: req.id,
        type: req.type as string,
        lat: req.lat,
        lng: req.lng,
        description: req.description,
        closestVolunteerKm: closest !== null ? Math.round(closest * 10) / 10 : null,
        createdAt: req.createdAt,
      };
    });
    io.to("admins").emit("coverage_gap_update", { gaps, checkedAt: new Date().toISOString() });
  } catch {
    // silently ignore during gap check
  }
}, 30_000);

// Periodic auto-dispatch: every 30s, try to dispatch QUEUED requests
// to newly available on-duty volunteers. This handles the case where
// a request was created when no volunteers were on duty, and one
// comes online later.
setInterval(async () => {
  try {
    const { requestFindMany: findRequests } = await import("./firestoreDb.js");
    const queuedRequests = await findRequests({ where: { status: "QUEUED" } });
    if (queuedRequests.length === 0) return;
    // Sort by oldest first so FIFO ordering is respected
    const sorted = [...queuedRequests].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const { createRoutes: _cr } = await import("./routes.js");
    // We can't call autoDispatchRequest directly since it's inside createRoutes,
    // so we use the HTTP-less approach: just check for available volunteers
    // and update via the DB + socket directly.
    const cutoff = Date.now() - 10 * 60 * 1000;
    const availableResponders = [...volunteerPositionStore.values()].filter(
      (v) => v.isAvailable && v.timestamp > cutoff
    );
    if (availableResponders.length === 0) return;

    for (const request of sorted) {
      // Find nearest available responder for this request
      let bestResponder: (typeof availableResponders[0] & { distanceKm: number }) | null = null;
      for (const vol of availableResponders) {
        const d = haversineKm(request.lat, request.lng, vol.lat, vol.lng);
        if (!bestResponder || d < bestResponder.distanceKm) {
          bestResponder = { ...vol, distanceKm: d };
        }
      }
      if (!bestResponder) continue;

      // Check if this responder already has an active task
      const { taskFindFirst: findTask, claimRequestTransaction: claimTx } = await import("./firestoreDb.js");
      const existingTask = await findTask({ volunteerId: bestResponder.volunteerId, status: { not: "COMPLETED" } });
      if (existingTask) continue;

      try {
        const task = await claimTx(request.id, bestResponder.volunteerId, `Auto-dispatched to nearest on-duty volunteer at ${bestResponder.distanceKm.toFixed(2)}km.`);
        const { userFindById: findUser } = await import("./firestoreDb.js");
        const volunteerUser = await findUser(bestResponder.volunteerId);
        io.emit("crisis_claimed", {
          requestId: request.id,
          claimedBy: volunteerUser?.email ?? bestResponder.email,
          volunteerId: bestResponder.volunteerId,
          taskId: task.id,
          agentDispatched: true,
          crisisLat: request.lat,
          crisisLng: request.lng,
        });
        console.log(`[PeriodicDispatch] Dispatched QUEUED request ${request.id} to ${bestResponder.email} (${bestResponder.distanceKm.toFixed(2)}km)`);
        // Remove this responder from the available pool for subsequent requests
        const idx = availableResponders.findIndex((v) => v.volunteerId === bestResponder!.volunteerId);
        if (idx >= 0) availableResponders.splice(idx, 1);
      } catch (e: any) {
        // Already claimed or not found — skip
      }
    }
  } catch {
    // silently ignore periodic dispatch errors
  }
}, 30_000);

async function shutdown() {
  console.log("Shutting down gracefully...");
  io.close();
  httpServer.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
