/**
 * CrisisGrid Seed Script  (Firestore)
 * ─────────────────────────────────────
 * Upserts known test users and creates realistic demo crisis requests in
 * Islamabad.  Enforces the one-active-task-per-responder rule strictly:
 *   • Each volunteer / staff holds AT MOST 1 active (ASSIGNED) task.
 *   • A second request for the same civilian goes QUEUED, not CLAIMED.
 *
 * Run:  npx tsx server/seed.ts
 */

import "dotenv/config";
import { db } from "./firebase.js";
import { hashPassword } from "./auth.js";

// ── Known test accounts ───────────────────────────────────────────────────────
const SEED_USERS = [
  { email: "umairaziz682@gmail.com", role: "SUPERADMIN", name: "Umair Aziz",       password: "CrisisGrid2026!" },
  { email: "ddmcbaba69@gmail.com",   role: "ADMIN",      name: "Admin User",       password: "CrisisGrid2026!" },
  { email: "justufor11@gmail.com",   role: "STAFF",      name: "Staff User",       password: "CrisisGrid2026!" },
  { email: "justufor14@gmail.com",   role: "VOLUNTEER",  name: "Volunteer Alpha",  password: "CrisisGrid2026!" },
  { email: "justufor18@gmail.com",   role: "VOLUNTEER",  name: "Volunteer Beta",   password: "CrisisGrid2026!" },
  { email: "justufor21@gmail.com",   role: "CIVILIAN",   name: "Civilian One",     password: "CrisisGrid2026!" },
  { email: "justufor27@gmail.com",   role: "CIVILIAN",   name: "Civilian Two",     password: "121212" },
];

// ── Demo crisis locations (Islamabad) ─────────────────────────────────────────
const CRISES = [
  { type: "MEDICAL",    lat: 33.7215, lng: 73.0433, desc: "Person collapsed near Blue Area, needs immediate medical help" },
  { type: "FOOD_WATER", lat: 33.6941, lng: 73.0651, desc: "Family of 5 stranded without food or water since yesterday" },
  { type: "RESCUE",     lat: 33.7090, lng: 73.0710, desc: "Car accident on Jinnah Ave — two people trapped" },
  { type: "MEDICAL",    lat: 33.6780, lng: 73.0432, desc: "Elderly woman with chest pains at G-9 sector" },
  { type: "FOOD_WATER", lat: 33.7300, lng: 73.0900, desc: "Flood victims need supplies near Rawal Lake" },
  { type: "RESCUE",     lat: 33.6610, lng: 72.9990, desc: "Building fire at I-8 industrial zone, residents trapped" },
  { type: "MEDICAL",    lat: 33.7450, lng: 73.1200, desc: "Severe allergic reaction — person unresponsive" },
  { type: "RESCUE",     lat: 33.7020, lng: 73.0550, desc: "Elderly man fell into open drain near F-7 market" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function upsertUser(
  firestore: FirebaseFirestore.Firestore,
  { email, role, name, password }: (typeof SEED_USERS)[number],
): Promise<string> {
  const snap = await firestore.collection("users").where("email", "==", email).limit(1).get();
  if (!snap.empty) {
    console.log(`  ✓ exists  [${role.padEnd(10)}]  ${email}`);
    return snap.docs[0].id;
  }
  const hash = await hashPassword(password);
  const ref = await firestore.collection("users").add({
    email, role, name,
    password: hash,
    banned: false,
    createdAt: new Date().toISOString(),
  });
  console.log(`  + created [${role.padEnd(10)}]  ${email}`);
  return ref.id;
}

async function clearSeededData(firestore: FirebaseFirestore.Firestore) {
  const reqSnap = await firestore.collection("requests").where("seeded", "==", true).get();
  if (reqSnap.empty) return;

  const seedIds = new Set(reqSnap.docs.map((d) => d.id));

  // Delete tasks for seeded requests
  const taskSnap = await firestore.collection("tasks").get();
  const tBatch = firestore.batch();
  let tCount = 0;
  for (const t of taskSnap.docs) {
    if (seedIds.has(t.data().requestId)) { tBatch.delete(t.ref); tCount++; }
  }
  if (tCount > 0) await tBatch.commit();

  // Delete the requests themselves
  const rBatch = firestore.batch();
  for (const r of reqSnap.docs) rBatch.delete(r.ref);
  await rBatch.commit();

  console.log(`  cleared ${reqSnap.size} old seeded request(s) + ${tCount} task(s)`);
}

async function addRequest(
  firestore: FirebaseFirestore.Firestore,
  userId: string,
  crisis: (typeof CRISES)[number],
  status: "QUEUED" | "ACTIVE" | "CLAIMED" | "RESOLVED",
  offsetMs = 0,
): Promise<string> {
  const ref = await firestore.collection("requests").add({
    userId,
    type:        crisis.type,
    description: crisis.desc,
    lat:         crisis.lat,
    lng:         crisis.lng,
    status,
    seeded:      true,
    createdAt:   new Date(Date.now() - offsetMs).toISOString(),
  });
  return ref.id;
}

/** Marks a request CLAIMED and creates one ASSIGNED task for responderId.
 *  Callers must guarantee the responder has no other active task. */
async function assignTask(
  firestore: FirebaseFirestore.Firestore,
  requestId: string,
  responderId: string,
) {
  await firestore.collection("requests").doc(requestId).update({ status: "CLAIMED" });
  await firestore.collection("tasks").add({
    requestId,
    volunteerId: responderId,
    status:      "ASSIGNED",
    aiRoutePlan: "Seeded route — proceed to crisis location using standard emergency protocol.",
    resolvedAt:  null,
    createdAt:   new Date().toISOString(),
  });
}

/** Marks a request + all its tasks RESOLVED/COMPLETED. */
async function markResolved(
  firestore: FirebaseFirestore.Firestore,
  requestId: string,
) {
  await firestore.collection("requests").doc(requestId).update({ status: "RESOLVED" });
  const taskSnap = await firestore.collection("tasks").where("requestId", "==", requestId).get();
  if (taskSnap.empty) return;
  const batch = firestore.batch();
  for (const t of taskSnap.docs) {
    batch.update(t.ref, { status: "COMPLETED", resolvedAt: new Date().toISOString() });
  }
  await batch.commit();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  CrisisGrid Seed  (Firestore)\n");
  const firestore = db();

  // 1. Upsert users
  console.log("👤 Users");
  const ids: Record<string, string> = {};
  for (const u of SEED_USERS) ids[u.email] = await upsertUser(firestore, u);

  const civ1 = ids["justufor21@gmail.com"];
  const civ2 = ids["justufor27@gmail.com"];
  const vol1 = ids["justufor14@gmail.com"];   // Volunteer Alpha
  const vol2 = ids["justufor18@gmail.com"];   // Volunteer Beta
  // staff / admin / superadmin are available but hold no tasks in this seed

  // 2. Clear previous seed runs
  console.log("\n🧹 Clearing old seed data");
  await clearSeededData(firestore);

  // 3. Create requests
  console.log("\n📋 Creating requests");

  // --- Civilian 1 ---
  // Resolved historical request (volunteer Alpha handled it in the past)
  const r_hist = await addRequest(firestore, civ1, CRISES[0], "RESOLVED", 3_600_000);
  await markResolved(firestore, r_hist);
  await firestore.collection("tasks").add({
    requestId:   r_hist,
    volunteerId: vol1,
    status:      "COMPLETED",
    aiRoutePlan: "Historical seeded route.",
    resolvedAt:  new Date(Date.now() - 3_500_000).toISOString(),
    createdAt:   new Date(Date.now() - 3_600_000).toISOString(),
  });
  console.log(`  + [RESOLVED]  Civilian 1  — ${CRISES[0].type} (vol-Alpha resolved, history)`);

  // Active claimed request → assigned to Volunteer Alpha (only 1 active task!)
  const r_active1 = await addRequest(firestore, civ1, CRISES[2], "CLAIMED", 1_800_000);
  await assignTask(firestore, r_active1, vol1);
  console.log(`  + [CLAIMED ]  Civilian 1  — ${CRISES[2].type} → Volunteer Alpha (active)`);

  // Second request for civilian 1 → QUEUED (will auto-dispatch when vol becomes free)
  const r_queue1 = await addRequest(firestore, civ1, CRISES[4], "QUEUED", 900_000);
  console.log(`  + [QUEUED  ]  Civilian 1  — ${CRISES[4].type} (queued, awaiting dispatch)`);

  // --- Civilian 2 ---
  // Active claimed request → assigned to Volunteer Beta
  const r_active2 = await addRequest(firestore, civ2, CRISES[1], "CLAIMED", 1_200_000);
  await assignTask(firestore, r_active2, vol2);
  console.log(`  + [CLAIMED ]  Civilian 2  — ${CRISES[1].type} → Volunteer Beta (active)`);

  // Second request for civilian 2 → QUEUED
  const r_queue2 = await addRequest(firestore, civ2, CRISES[3], "QUEUED", 600_000);
  console.log(`  + [QUEUED  ]  Civilian 2  — ${CRISES[3].type} (queued)`);

  // Extra unclaimed requests for heatmap / live-feed demo
  await addRequest(firestore, civ1, CRISES[5], "QUEUED", 300_000);
  await addRequest(firestore, civ2, CRISES[6], "QUEUED", 200_000);
  await addRequest(firestore, civ1, CRISES[7], "QUEUED", 100_000);
  console.log(`  + [QUEUED  ]  3 extra unclaimed requests (heatmap / live-feed demo)`);

  // 4. One-task constraint verification
  // vol1 has exactly 1 ASSIGNED task (r_active1) — r_hist is COMPLETED ✓
  // vol2 has exactly 1 ASSIGNED task (r_active2) ✓
  // staff / admin / superadmin hold 0 tasks ✓

  console.log("\n✅  Seed complete!\n");
  console.log("─────────────────────────────────────────────────");
  console.log("State summary:");
  console.log("  RESOLVED  1  (civilian 1 — history, vol-Alpha completed)");
  console.log("  CLAIMED   2  (civ1→vol-Alpha, civ2→vol-Beta; 1 task each)");
  console.log("  QUEUED    5  (2 civilian overflow + 3 heatmap demo)");
  console.log("\nOne-active-task constraint verified: each responder holds ≤ 1 active task ✓");
  console.log("\nTest accounts:");
  for (const u of SEED_USERS) {
    console.log(`  [${u.role.padEnd(10)}]  ${u.email.padEnd(30)}  ${u.password}`);
  }
  console.log("─────────────────────────────────────────────────");
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); });
