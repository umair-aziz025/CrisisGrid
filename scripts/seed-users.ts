import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) { console.error("FIREBASE_SERVICE_ACCOUNT_JSON not set"); process.exit(1); }
const sa = JSON.parse(raw);
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

const DEFAULT_PASSWORD = "CrisisGrid2025!";

const ROLE_PREFIX: Record<string, string> = {
  VICTIM: "USR", VOLUNTEER: "VOL", STAFF: "STA", ADMIN: "ADM", SUPERADMIN: "SUP",
};

async function generatePublicId(role: string, db: FirebaseFirestore.Firestore): Promise<string> {
  const prefix = ROLE_PREFIX[role] ?? "USR";
  const snap = await db.collection("users")
    .where("publicId", ">=", `${prefix}-`)
    .where("publicId", "<=", `${prefix}-\uffff`)
    .get();
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

const accounts = [
  { email: "umairaziz682@gmail.com", name: "Umair Aziz",   role: "SUPERADMIN" },
  { email: "ddmcbaba69@gmail.com",   name: "DDMcBaba",     role: "ADMIN"      },
  { email: "justufor21@gmail.com",   name: "Staff Member",  role: "STAFF"      },
  { email: "justufor14@gmail.com",   name: "Volunteer One", role: "VOLUNTEER"  },
  { email: "justufor18@gmail.com",   name: "Volunteer Two", role: "VOLUNTEER"  },
  { email: "justufor27@gmail.com",   name: "User Member",   role: "VICTIM"     },
];

async function seed() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const account of accounts) {
    const snap = await db.collection("users").where("email", "==", account.email).limit(1).get();
    if (!snap.empty) {
      console.log(`⏭  Skipping ${account.email} — already exists`);
      continue;
    }

    const publicId = await generatePublicId(account.role, db);
    await db.collection("users").add({
      email: account.email,
      passwordHash,
      name: account.name,
      role: account.role,
      publicId,
      phone: null,
      address: null,
      banned: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordResetToken: null,
      passwordResetExpiry: null,
      createdAt: new Date().toISOString(),
    });

    console.log(`✅  Created ${account.role.padEnd(12)} ${account.email} (${publicId})`);
  }

  console.log(`\nDefault password for all accounts: ${DEFAULT_PASSWORD}`);
  console.log("Done.");
  process.exit(0);
}

seed().catch((e) => { console.error("Seed failed:", e.message); process.exit(1); });
