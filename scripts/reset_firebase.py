#!/usr/bin/env python3
"""
Reset Firebase Firestore database to only contain seed user accounts.
Wipes all collections except users, then creates the specified accounts.

Usage:
    python reset_firebase.py

Requires: firebase-admin (pip install firebase-admin)
"""

import sys
import os

# Path to your service account key
SERVICE_ACCOUNT_PATH = r"C:\Users\stxrdust\Downloads\crisisgrid-fe615-firebase-adminsdk-fbsvc-f5d44f9fb6.json"

# Default password for all seeded accounts
DEFAULT_PASSWORD = "password123"

# Hash password using bcrypt (same as backend)
def hash_password(password: str) -> str:
    import bcrypt
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")

# ─── Seed Data ────────────────────────────────────────────────────────────────

SEED_USERS = [
    # SUPERADMIN
    {"email": "superadmin@crisisgrid.app", "name": "Aria Sterling", "role": "SUPERADMIN"},
    # ADMIN
    {"email": "admin@crisisgrid.app", "name": "Marcus Webb", "role": "ADMIN"},
    # STAFF
    {"email": "staff@crisisgrid.app", "name": "Dana Okafor", "role": "STAFF"},
    # VOLUNTEERS (8)
    {"email": "volunteer1@crisisgrid.app", "name": "Aisha Kareem", "role": "VOLUNTEER"},
    {"email": "volunteer2@crisisgrid.app", "name": "Omar Han", "role": "VOLUNTEER"},
    {"email": "volunteer3@crisisgrid.app", "name": "Lina Park", "role": "VOLUNTEER"},
    {"email": "volunteer4@crisisgrid.app", "name": "David Cole", "role": "VOLUNTEER"},
    {"email": "volunteer5@crisisgrid.app", "name": "Yusuf Ali", "role": "VOLUNTEER"},
    {"email": "volunteer6@crisisgrid.app", "name": "Mina Zhou", "role": "VOLUNTEER"},
    {"email": "volunteer7@crisisgrid.app", "name": "Carlos Vega", "role": "VOLUNTEER"},
    {"email": "volunteer8@crisisgrid.app", "name": "Sara Nouri", "role": "VOLUNTEER"},
    # VICTIMS / CIVILIANS (13)
    {"email": "civilian1@crisisgrid.app", "name": "Hiba Malik", "role": "VICTIM"},
    {"email": "civilian2@crisisgrid.app", "name": "Noah Reed", "role": "VICTIM"},
    {"email": "civilian3@crisisgrid.app", "name": "Rania Saleh", "role": "VICTIM"},
    {"email": "civilian4@crisisgrid.app", "name": "Bilal Shah", "role": "VICTIM"},
    {"email": "civilian5@crisisgrid.app", "name": "Layla Noor", "role": "VICTIM"},
    {"email": "civilian6@crisisgrid.app", "name": "Amir Khan", "role": "VICTIM"},
    {"email": "civilian7@crisisgrid.app", "name": "Zara Imran", "role": "VICTIM"},
    {"email": "civilian8@crisisgrid.app", "name": "Leo Kim", "role": "VICTIM"},
    {"email": "civilian9@crisisgrid.app", "name": "Maya Singh", "role": "VICTIM"},
    {"email": "civilian10@crisisgrid.app", "name": "Hamza Qureshi", "role": "VICTIM"},
    {"email": "civilian11@crisisgrid.app", "name": "Nora Aziz", "role": "VICTIM"},
    {"email": "civilian12@crisisgrid.app", "name": "Imran Yousaf", "role": "VICTIM"},
    {"email": "anonymous@crisisgrid.app", "name": "Anonymous", "role": "VICTIM"},
]

# Collections to DELETE (wipe all documents)
COLLECTIONS_TO_DELETE = [
    "crisisRequests",
    "crisisTasks",
    "chatMessages",
    "safeZones",
    "activityLogs",
    "coverageGaps",
    "notifications",
    "shifts",
    "volunteerLocations",
    "volunteerAvailabilities",
]

# ─── Helpers ──────────────────────────────────────────────────────────────────

def delete_collection(coll_ref, batch_size=100):
    """Delete all documents in a collection."""
    docs = coll_ref.limit(batch_size).stream()
    deleted = 0
    for doc in docs:
        doc.reference.delete()
        deleted += 1
    if deleted >= batch_size:
        return delete_collection(coll_ref, batch_size)
    return deleted


def main():
    try:
        from firebase_admin import credentials, firestore, initialize_app, get_app
    except ImportError:
        print("ERROR: firebase-admin not installed.")
        print("Run:  pip install firebase-admin")
        sys.exit(1)

    # Initialize Firebase
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print(f"ERROR: Service account key not found at:\n  {SERVICE_ACCOUNT_PATH}")
        sys.exit(1)

    try:
        get_app()
    except Exception:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        initialize_app(cred)

    db = firestore.client()
    print("=" * 60)
    print("FIREBASE DATABASE RESET")
    print("=" * 60)

    # Step 1: Wipe non-user collections
    print("\n[1] Wiping data collections...")
    for coll_name in COLLECTIONS_TO_DELETE:
        coll_ref = db.collection(coll_name)
        count = delete_collection(coll_ref)
        print(f"   [OK] {coll_name}: deleted {count} documents")

    # Step 2: Wipe existing users
    print("\n[2] Wiping existing users...")
    users_ref = db.collection("users")
    count = delete_collection(users_ref)
    print(f"   [OK] users: deleted {count} documents")

    # Step 3: Create seed users
    print(f"\n[3] Creating {len(SEED_USERS)} seed users...")
    batch = db.batch()
    for i, user in enumerate(SEED_USERS):
        doc_ref = users_ref.document()
        batch.set(doc_ref, {
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "passwordHash": hash_password(DEFAULT_PASSWORD),
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "isActive": True,
            "twoFAEnabled": False,
            "phoneNumber": None,
            "emergencyContact": None,
            "fcmToken": None,
        })
        if (i + 1) % 500 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()

    for user in SEED_USERS:
        print(f"   [OK] {user['role']:12s} | {user['email']:35s} | {user['name']}")

    print("\n" + "=" * 60)
    print("DONE! Database reset complete.")
    print(f"All passwords set to: {DEFAULT_PASSWORD}")
    print("=" * 60)


if __name__ == "__main__":
    main()
