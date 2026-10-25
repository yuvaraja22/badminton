import { deleteDoc, doc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import type { AppConfig, LinkClaim, PlayerId, TrashEntry } from '../../types';
import { toHistory, toSession, toTrash } from '../convert';
import { adminsCol, claimsCol, configRef, historyRef, linksCol, putHistory, run, sessionsCol, tournamentsCol, tracked, trashCol } from './core';

export function saveConfig(config: AppConfig) {
  run(setDoc(configRef, config, { merge: true }), 'Saving settings');
}

export async function listAdmins(): Promise<string[]> {
  const snap = await getDocs(adminsCol);
  return snap.docs.map((d) => d.id).sort();
}

export async function addAdmin(email: string) {
  await tracked(setDoc(doc(adminsCol, email.trim().toLowerCase()), { addedAt: Date.now() }));
}

export async function removeAdmin(email: string) {
  await tracked(deleteDoc(doc(adminsCol, email)));
}

/** Recompute meta/history from every completed session (repairs the all-time stats cache). */
export async function rebuildHistory(): Promise<number> {
  const snap = await getDocs(query(sessionsCol, where('status', '==', 'completed')));
  const sessions = Object.fromEntries(snap.docs.map((d) => [d.id, toHistory(toSession(d.id, d.data()))]));
  await tracked(setDoc(historyRef, { sessions }));
  return snap.size;
}

// ---------------------------------------------------------------- recently deleted

/** How long deleted sessions and tournaments can be restored. */
export const TRASH_DAYS = 30;

/** Recently deleted, newest first. Anything older than TRASH_DAYS is removed for good on the way. */
export async function listTrash(): Promise<TrashEntry[]> {
  const snap = await getDocs(trashCol);
  const cutoff = Date.now() - TRASH_DAYS * 86_400_000;
  const all = snap.docs.map((d) => toTrash(d.id, d.data()));
  for (const e of all) if (e.deletedAt < cutoff) run(deleteDoc(doc(trashCol, e.id)), 'Clearing old deleted items');
  return all.filter((e) => e.deletedAt >= cutoff).sort((a, b) => b.deletedAt - a.deletedAt);
}

/** Put a deleted session or tournament back exactly as it was (a finished session rejoins the stats). */
export async function restoreFromTrash(e: TrashEntry) {
  const batch = writeBatch(db);
  if (e.kind === 'session') {
    batch.set(doc(sessionsCol, e.id), e.data);
    const s = toSession(e.id, e.data);
    if (s.status === 'completed') putHistory(batch, s);
  } else {
    batch.set(doc(tournamentsCol, e.id), e.data);
  }
  batch.delete(doc(trashCol, e.id));
  await tracked(batch.commit());
}

export async function deleteForever(id: string) {
  await tracked(deleteDoc(doc(trashCol, id)));
}

// ---------------------------------------------------------------- "This is me" requests

/** Ask an admin to link the signed-in Google account to this player profile. */
export async function requestLink(email: string, playerId: PlayerId, name: string) {
  await tracked(setDoc(doc(claimsCol, email.toLowerCase()), { playerId, name: name.trim().slice(0, 60), at: Date.now() }));
}

export async function cancelLinkRequest(email: string) {
  await tracked(deleteDoc(doc(claimsCol, email.toLowerCase())));
}

/** Link the account to the player it asked for (replacing that player's older link, if any). */
export async function approveClaim(claim: LinkClaim, previous: string | null) {
  const batch = writeBatch(db);
  if (previous && previous !== claim.email) batch.delete(doc(linksCol, previous));
  batch.set(doc(linksCol, claim.email), { playerId: claim.playerId, addedAt: Date.now() });
  batch.delete(doc(claimsCol, claim.email));
  await tracked(batch.commit());
}

export function declineClaim(email: string) {
  run(deleteDoc(doc(claimsCol, email)), 'Declining the request');
}
