// Saves every collection as one JSON file in out/, in the same format as Admin → Download backup,
// so it can be restored from the app (Admin → Restore from backup).
//
// Needs a service account key with read access, as JSON, in FIREBASE_SERVICE_ACCOUNT (or a key file
// path in GOOGLE_APPLICATION_CREDENTIALS). See the README, "Nightly backups".
import { mkdirSync, writeFileSync } from 'node:fs';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const key = process.env.FIREBASE_SERVICE_ACCOUNT;
initializeApp({ credential: key ? cert(JSON.parse(key)) : applicationDefault() });
const db = getFirestore();

const COLLECTIONS = ['players', 'sessions', 'events', 'tournaments', 'meta', 'admins', 'links', 'claims', 'trash'];
const collections = {};
for (const name of COLLECTIONS) {
  const snap = await db.collection(name).get();
  collections[name] = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
}

const exportedAt = new Date().toISOString();
mkdirSync('out', { recursive: true });
const file = `out/badminton-backup-${exportedAt.slice(0, 10)}.json`;
writeFileSync(file, JSON.stringify({ app: 'badminton-stats', version: 2, exportedAt, collections }, null, 2));
console.log(`Saved ${file}: ${COLLECTIONS.map((c) => `${Object.keys(collections[c]).length} ${c}`).join(', ')}`);
