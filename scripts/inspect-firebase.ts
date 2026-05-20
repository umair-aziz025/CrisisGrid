import { initializeApp, cert, getApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const serviceAccountPath = 'c:/Users/stxrdust/Downloads/crisisgrid-fe615-firebase-adminsdk-fbsvc-fd59787998.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account file not found at:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function checkUsers() {
  console.log('--- Checking Collections ---');
  const collections = await db.listCollections();
  console.log('Collections found:', collections.map(c => c.id).join(', '));

  console.log('\n--- Checking Users Collection ---');
  const snapshot = await db.collection('users').get();
  console.log('Total user documents:', snapshot.size);

  if (snapshot.empty) {
    console.log('No user documents found in "users" collection.');
    return;
  }

  const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  console.log('\n--- Role Distribution ---');
  const roles = users.reduce((acc: any, u: any) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});
  console.log(roles);

  console.log('\n--- Potential Issues (Missing "banned" or "email") ---');
  users.forEach((u: any) => {
    const issues = [];
    if (u.email === undefined || u.email === null) issues.push('MISSING_EMAIL');
    if (u.banned === undefined || u.banned === null) issues.push('MISSING_BANNED_FIELD');
    if (u.role !== u.role?.toUpperCase()) issues.push('LOWERCASE_ROLE (' + u.role + ')');

    if (issues.length > 0 && (['STAFF', 'ADMIN', 'SUPERADMIN', 'VOLUNTEER'].includes(u.role?.toUpperCase()))) {
      console.log(`User ${u.id} (${u.name || 'No Name'}, ${u.role}): ${issues.join(', ')}`);
    }
  });

  console.log('\n--- Sample Staff/Admin/Volunteer Records ---');
  const privileged = users.filter((u: any) => ['STAFF', 'ADMIN', 'SUPERADMIN', 'VOLUNTEER'].includes(u.role?.toUpperCase())).slice(0, 5);
  privileged.forEach((u: any) => {
    console.log(JSON.stringify(u, null, 2));
  });
}

checkUsers().catch(console.error);
