import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { COLLECTIONS, RESTORABLE, type Backup, type ParsedBackup, type Restorable } from '../backupFormat';
import { toSession } from '../convert';
import { putHistory, tracked } from './core';

export { parseBackup, type Backup, type ParsedBackup } from '../backupFormat';

/** Restoring only brings back what is missing (deleted players, sessions, tournaments, plans); it never changes anything that's still there. */

export async function exportBackup(): Promise<Backup> {
  const collections: Backup['collections'] = {};
  for (const name of COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, name));
      collections[name] = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
    } catch {
      // A collection this account can't read (or that the rules don't know yet) is left out.
    }
  }
  return { app: 'badminton-stats', version: 2, exportedAt: new Date().toISOString(), collections };
}

/** Ids in the backup that aren't in the app any more. */
export type Missing = Record<Restorable, string[]>;

export async function findMissing(b: ParsedBackup): Promise<Missing> {
  const missing: Missing = { players: [], sessions: [], tournaments: [], events: [] };
  for (const name of RESTORABLE) {
    const snap = await getDocs(collection(db, name));
    const have = new Set(snap.docs.map((d) => d.id));
    missing[name] = Object.keys(b.docs[name]).filter((id) => !have.has(id));
  }
  return missing;
}

/** Write the missing documents back (finished sessions rejoin the all-time stats). Returns how many. */
export async function restoreMissing(b: ParsedBackup, missing: Missing): Promise<number> {
  const writes: [Restorable, string][] = RESTORABLE.flatMap((name) => missing[name].map((id) => [name, id] as [Restorable, string]));
  // A batch takes up to 500 writes; a finished session takes two (it and its stats copy).
  for (let i = 0; i < writes.length; i += 200) {
    const batch = writeBatch(db);
    for (const [name, id] of writes.slice(i, i + 200)) {
      const data = b.docs[name][id];
      batch.set(doc(db, name, id), data);
      if (name === 'sessions') {
        const s = toSession(id, data);
        if (s.status === 'completed') putHistory(batch, s);
      }
    }
    await tracked(batch.commit());
  }
  return writes.length;
}
