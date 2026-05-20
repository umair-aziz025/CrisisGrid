import { db } from "./firebase.js";
import type { DocumentData, QueryDocumentSnapshot, DocumentSnapshot } from "firebase-admin/firestore";

// ── helpers ──────────────────────────────────────────────────────────────────

function toPlain(doc: QueryDocumentSnapshot | DocumentSnapshot): Record<string, any> | null {
  if (!doc.exists) return null;
  const data = doc.data() as Record<string, any>;
  return { id: doc.id, ...data };
}

function toNum(val: any): number {
  if (val == null) return 0;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "string") { const d = Date.parse(val); return isNaN(d) ? 0 : d; }
  return Number(val);
}

function matchesWhere(obj: Record<string, any>, where: Record<string, any>): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue;

    // Special case for banned: false
    // If the query asks for banned: false, we accept false, null, or undefined (defaults to unbanned)
    if (k === "banned" && v === false) {
      if (obj[k] === true) return false;
      continue;
    }

    if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      if ("in" in v && !v.in.includes(obj[k])) return false;
      if ("not" in v) {
        if (k === "banned" && v.not === true) {
          if (obj[k] === true) return false;
        } else {
          if (obj[k] === v.not) return false;
        }
      }
      if ("gt" in v && !(toNum(obj[k]) > toNum(v.gt))) return false;
      if ("gte" in v && !(toNum(obj[k]) >= toNum(v.gte))) return false;
      if ("lt" in v && !(toNum(obj[k]) < toNum(v.lt))) return false;
      if ("startsWith" in v && !String(obj[k] ?? "").startsWith(v.startsWith)) return false;
      if ("contains" in v) {
        const haystack = String(obj[k] ?? "").toLowerCase();
        const needle = String(v.contains).toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
    } else {
      if (obj[k] !== v) return false;
    }
  }
  return true;
}

// ── USERS ────────────────────────────────────────────────────────────────────

export async function userFindByEmail(email: string) {
  const snap = await db().collection("users").where("email", "==", email).limit(1).get();
  if (snap.empty) return null;
  return toPlain(snap.docs[0]);
}

export async function userFindById(id: string) {
  const doc = await db().collection("users").doc(id).get();
  return toPlain(doc);
}

export async function userFindFirst(where: Record<string, any>) {
  const snap = await db().collection("users").get();
  const all = snap.docs.map(toPlain).filter(Boolean) as Record<string, any>[];
  return all.find((u) => matchesWhere(u, where)) ?? null;
}

export async function userCreate(data: Record<string, any>) {
  const payload = { ...data, createdAt: new Date().toISOString() };
  const ref = await db().collection("users").add(payload);
  const doc = await ref.get();
  return toPlain(doc)!;
}

export async function userUpdate(id: string, data: Record<string, any>) {
  await db().collection("users").doc(id).update(data);
  const doc = await db().collection("users").doc(id).get();
  return toPlain(doc)!;
}

export async function userFindMany(opts: {
  where?: Record<string, any>;
  select?: string[];
  skip?: number;
  take?: number;
  orderBy?: string;
  search?: string;
} = {}) {
  const snap = await db().collection("users").orderBy("createdAt", "desc").get();
  let results = snap.docs.map(toPlain).filter(Boolean) as Record<string, any>[];

  if (opts.where) {
    if (opts.where.OR) {
      const ors = opts.where.OR as Record<string, any>[];
      const rest = Object.fromEntries(Object.entries(opts.where).filter(([k]) => k !== "OR"));
      results = results.filter((u) =>
        ors.some((or) => matchesWhere(u, or)) && (Object.keys(rest).length === 0 || matchesWhere(u, rest))
      );
    } else {
      results = results.filter((u) => matchesWhere(u, opts.where!));
    }
  }

  if (opts.skip) results = results.slice(opts.skip);
  if (opts.take) results = results.slice(0, opts.take);

  return results;
}

export async function userCount(opts: { where?: Record<string, any> } = {}) {
  const snap = await db().collection("users").get();
  if (!opts.where) return snap.size;
  let results = snap.docs.map(toPlain).filter(Boolean) as Record<string, any>[];
  if (opts.where) results = results.filter((u) => matchesWhere(u, opts.where!));
  return results.length;
}

// ── REQUESTS ─────────────────────────────────────────────────────────────────

export async function requestFindById(id: string) {
  const doc = await db().collection("requests").doc(id).get();
  return toPlain(doc);
}

export async function requestFindMany(opts: {
  where?: Record<string, any>;
  includeUser?: boolean;
  includeTasks?: boolean;
} = {}) {
  const snap = await db().collection("requests").orderBy("createdAt", "desc").get();
  let results = snap.docs.map(toPlain).filter(Boolean) as Record<string, any>[];

  if (opts.where) {
    if (opts.where.status && typeof opts.where.status === "object" && "in" in opts.where.status) {
      const statuses = opts.where.status.in as string[];
      results = results.filter((r) => statuses.includes(r.status));
    } else if (opts.where.status) {
      results = results.filter((r) => r.status === opts.where!.status);
    }
  }

  if (opts.includeUser || opts.includeTasks) {
    const userIds = [...new Set(results.map((r) => r.userId).filter(Boolean))];
    const userMap: Record<string, any> = {};
    await Promise.all(
      userIds.map(async (uid) => {
        const doc = await db().collection("users").doc(uid).get();
        if (doc.exists) userMap[uid] = toPlain(doc);
      })
    );

    const requestIds = results.map((r) => r.id);
    const taskMap: Record<string, any[]> = {};
    if (opts.includeTasks && requestIds.length > 0) {
      const taskSnap = await db().collection("tasks").get();
      for (const td of taskSnap.docs) {
        const t = toPlain(td)!;
        if (requestIds.includes(t.requestId)) {
          taskMap[t.requestId] = taskMap[t.requestId] ?? [];
          const vol = t.volunteerId ? userMap[t.volunteerId] ?? (await userFindById(t.volunteerId)) : null;
          taskMap[t.requestId].push({ ...t, volunteer: vol ? { email: vol.email, name: vol.name } : null });
        }
      }
    }

    results = results.map((r) => ({
      ...r,
      user: opts.includeUser ? (r.userId ? userMap[r.userId] ?? null : null) : undefined,
      tasks: opts.includeTasks ? (taskMap[r.id] ?? []) : undefined,
    }));
  }

  return results;
}

export async function requestCreate(data: Record<string, any>) {
  const payload = { ...data, createdAt: new Date().toISOString() };
  const ref = await db().collection("requests").add(payload);
  const doc = await ref.get();
  return toPlain(doc)!;
}

export async function requestUpdate(id: string, data: Record<string, any>) {
  await db().collection("requests").doc(id).update(data);
  const doc = await db().collection("requests").doc(id).get();
  return toPlain(doc)!;
}

export async function requestCount(opts: { where?: Record<string, any> } = {}) {
  const snap = await db().collection("requests").get();
  if (!opts.where) return snap.size;
  let results = snap.docs.map(toPlain).filter(Boolean) as Record<string, any>[];
  if (opts.where) {
    if (opts.where.status && typeof opts.where.status === "object" && "in" in opts.where.status) {
      const statuses = opts.where.status.in as string[];
      results = results.filter((r) => statuses.includes(r.status));
    } else {
      results = results.filter((r) => matchesWhere(r, opts.where!));
    }
  }
  return results.length;
}

// ── TASKS ────────────────────────────────────────────────────────────────────

export async function taskFindFirst(where: Record<string, any>) {
  const snap = await db().collection("tasks").get();
  const all = snap.docs.map(toPlain).filter(Boolean) as Record<string, any>[];
  return all.find((t) => matchesWhere(t, where)) ?? null;
}

export async function taskFindMany(opts: {
  where: Record<string, any>;
  includeRequest?: boolean;
  includeVolunteer?: boolean;
}) {
  const snap = await db().collection("tasks").orderBy("createdAt", "desc").get();
  let results = snap.docs.map(toPlain).filter(Boolean) as Record<string, any>[];
  results = results.filter((t) => matchesWhere(t, opts.where));

  if (opts.includeRequest) {
    const reqIds = [...new Set(results.map((t) => t.requestId).filter(Boolean))];
    const reqMap: Record<string, any> = {};
    await Promise.all(
      reqIds.map(async (rid) => {
        const doc = await db().collection("requests").doc(rid).get();
        if (doc.exists) {
          const req = toPlain(doc)!;
          const userDoc = req.userId ? await db().collection("users").doc(req.userId).get() : null;
          req.user = userDoc?.exists
            ? { email: userDoc.data()!.email, name: userDoc.data()!.name, phone: userDoc.data()!.phone ?? null, address: userDoc.data()!.address ?? null, publicId: userDoc.data()!.publicId ?? null }
            : null;
          reqMap[rid] = req;
        }
      })
    );
    results = results.map((t) => ({ ...t, request: reqMap[t.requestId] ?? null }));
  }

  return results;
}

export async function taskCreate(data: Record<string, any>) {
  const payload = { ...data, createdAt: new Date().toISOString() };
  const ref = await db().collection("tasks").add(payload);
  const doc = await ref.get();
  return toPlain(doc)!;
}

export async function taskUpdate(id: string, data: Record<string, any>) {
  await db().collection("tasks").doc(id).update(data);
  const doc = await db().collection("tasks").doc(id).get();
  return toPlain(doc)!;
}

// ── ATOMIC CLAIM (Multi-responder support) ───────────────────────────────────

export async function claimRequestTransaction(requestId: string, volunteerId: string, aiRoutePlan: string) {
  const firestore = db();
  const requestRef = firestore.collection("requests").doc(requestId);

  let taskId: string | null = null;

  await firestore.runTransaction(async (tx) => {
    const reqSnap = await tx.get(requestRef);
    if (!reqSnap.exists) throw new Error("NOT_FOUND");
    const req = reqSnap.data()!;
    // Allow claiming QUEUED, ACTIVE, or already-CLAIMED requests (multi-responder)
    if (!["QUEUED", "ACTIVE", "CLAIMED"].includes(req.status)) {
      throw new Error("ALREADY_CLAIMED");
    }

    const taskRef = firestore.collection("tasks").doc();
    taskId = taskRef.id;
    tx.set(taskRef, {
      requestId,
      volunteerId,
      aiRoutePlan,
      status: "ASSIGNED",
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    });
    // Always set to CLAIMED (covers QUEUED -> CLAIMED, ACTIVE -> CLAIMED, or keep CLAIMED)
    if (req.status !== "CLAIMED") {
      tx.update(requestRef, { status: "CLAIMED" });
    }
  });

  const taskDoc = await firestore.collection("tasks").doc(taskId!).get();
  return toPlain(taskDoc)!;
}

// ── ACTIVITY LOGS ────────────────────────────────────────────────────────────

export async function activityLogCreate(data: Record<string, any>) {
  const payload = { ...data, createdAt: new Date().toISOString() };
  const ref = await db().collection("activityLogs").add(payload);
  const doc = await ref.get();
  return toPlain(doc)!;
}

export async function activityLogFindMany(opts: {
  where?: Record<string, any>;
  skip?: number;
  take?: number;
  includePerformedBy?: boolean;
  includeTargetUser?: boolean;
} = {}) {
  const snap = await db().collection("activityLogs").orderBy("createdAt", "desc").get();
  let results = snap.docs.map(toPlain).filter(Boolean) as Record<string, any>[];

  if (opts.where) {
    const { OR, ...rest } = opts.where as any;
    if (OR) {
      results = results.filter(
        (l) => (OR as any[]).some((or: any) => matchesWhere(l, or)) && matchesWhere(l, rest)
      );
    } else {
      results = results.filter((l) => matchesWhere(l, rest));
    }
  }

  if (opts.skip) results = results.slice(opts.skip);
  const total = results.length;
  if (opts.take) results = results.slice(0, opts.take);

  if (opts.includePerformedBy || opts.includeTargetUser) {
    const userIds = [
      ...new Set([
        ...(opts.includePerformedBy ? results.map((l) => l.performedById) : []),
        ...(opts.includeTargetUser ? results.map((l) => l.targetUserId) : []),
      ].filter(Boolean)),
    ];
    const userMap: Record<string, any> = {};
    await Promise.all(
      userIds.map(async (uid) => {
        const doc = await db().collection("users").doc(uid).get();
        if (doc.exists) userMap[uid] = toPlain(doc);
      })
    );
    results = results.map((l) => ({
      ...l,
      performedBy: opts.includePerformedBy && l.performedById ? (userMap[l.performedById] ?? null) : undefined,
      targetUser: opts.includeTargetUser && l.targetUserId ? (userMap[l.targetUserId] ?? null) : undefined,
    }));
  }

  return { logs: results, total };
}

export async function activityLogCount(opts: { where?: Record<string, any> } = {}) {
  const snap = await db().collection("activityLogs").get();
  if (!opts.where) return snap.size;
  let results = snap.docs.map(toPlain).filter(Boolean) as Record<string, any>[];
  const { OR, ...rest } = (opts.where ?? {}) as any;
  if (OR) {
    results = results.filter(
      (l) => (OR as any[]).some((or: any) => matchesWhere(l, or)) && matchesWhere(l, rest)
    );
  } else {
    results = results.filter((l) => matchesWhere(l, rest));
  }
  return results.length;
}

// ── SAFE ZONES ───────────────────────────────────────────────────────────────

export async function safeZoneFindMany() {
  const snap = await db().collection("safeZones").orderBy("createdAt", "desc").get();
  return snap.docs.map(toPlain).filter(Boolean) as Record<string, any>[];
}

export async function safeZoneCreate(data: Record<string, any>) {
  const payload = { ...data, createdAt: new Date().toISOString() };
  const ref = await db().collection("safeZones").add(payload);
  const doc = await ref.get();
  return toPlain(doc)!;
}

export async function safeZoneDelete(id: string) {
  await db().collection("safeZones").doc(id).delete();
}

// ── CONTACT SUBMISSIONS ───────────────────────────────────────────────────────

export async function contactSubmissionCreate(data: Record<string, any>) {
  const payload = { ...data, createdAt: new Date().toISOString() };
  const ref = await db().collection("contactSubmissions").add(payload);
  const doc = await ref.get();
  return toPlain(doc)!;
}

// ── PUBLIC ID GENERATION ──────────────────────────────────────────────────────

export async function generatePublicId(role: string): Promise<string> {
  const prefixMap: Record<string, string> = {
    VICTIM: "USR", VOLUNTEER: "VOL", STAFF: "STA", ADMIN: "ADM", SUPERADMIN: "SUP",
  };
  const prefix = prefixMap[role] ?? "USR";
  const snap = await db().collection("users").where("publicId", ">=", `${prefix}-`).where("publicId", "<=", `${prefix}-\uffff`).get();
  let max = 0;
  for (const doc of snap.docs) {
    const pid = doc.data().publicId as string | null;
    if (pid) {
      const n = parseInt(pid.split("-")[1], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

// ── ACTIVE REQUESTS (for coverage gap) ───────────────────────────────────────

export async function getActiveRequests() {
  const snap = await db().collection("requests").where("status", "==", "ACTIVE").get();
  return snap.docs.map(toPlain).filter(Boolean) as Record<string, any>[];
}
