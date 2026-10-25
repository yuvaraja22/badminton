import { collection, doc, FieldPath, type WriteBatch } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { trackWrite } from '../../sync';
import { toast } from '../../toast';
import type { EditEntry, ScorerInfo, Session } from '../../types';
import { toHistory } from '../convert';

/**
 * Writes are admin-only (enforced by firestore.rules), apart from a linked player's own profile and RSVP
 * and a signed-in person's request to be linked. They are applied to the local cache immediately, so
 * the UI updates at once even offline; we never block on the server round-trip. Each one is counted
 * until the server confirms it, for the Offline / Saving… indicator (see sync.ts).
 */

export const playersCol = collection(db, 'players');
export const sessionsCol = collection(db, 'sessions');
export const eventsCol = collection(db, 'events');
export const tournamentsCol = collection(db, 'tournaments');
export const linksCol = collection(db, 'links');
export const claimsCol = collection(db, 'claims');
export const trashCol = collection(db, 'trash');
export const adminsCol = collection(db, 'admins');
export const historyRef = doc(db, 'meta', 'history');
export const configRef = doc(db, 'meta', 'config');

export function describe(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === 'permission-denied') return 'only admins can make changes';
  return (e as Error)?.message ?? String(e);
}

/** Send a write without waiting for it; if the server refuses it, say so. */
export function run(p: Promise<unknown>, what: string) {
  trackWrite(p).catch((e) => toast(`${what} failed: ${describe(e)}`, 'error'));
}

/** A write the screen waits for (it still counts towards the Saving… indicator). */
export function tracked<T>(p: Promise<T>): Promise<T> {
  return trackWrite(p);
}

/**
 * The signed-in admin as shown on the scorer and in change histories: account id and first name.
 * No email, since sessions and tournaments can be read by anyone.
 */
export function editor(): ScorerInfo {
  const u = auth.currentUser;
  return { id: u?.uid ?? '', name: u?.displayName?.trim().split(/\s+/)[0] || 'an admin' };
}

/** A line for a change history, signed by the signed-in admin. */
export function editEntry(match: number | null, text: string): EditEntry {
  const me = editor();
  return { at: Date.now(), by: me.name, uid: me.id, match, text };
}

/** Keep a completed session's compact copy in meta/history in step with the session (same batch). */
export function putHistory(batch: WriteBatch, session: Session) {
  batch.set(historyRef, { sessions: { [session.id]: toHistory(session) } }, { mergeFields: [new FieldPath('sessions', session.id)] });
}

/** `{ a: 1 }` → `{ 'matches.x.a': 1 }`, so only those fields change. */
export function under(path: string, patch: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(patch).map(([k, v]) => [`${path}.${k}`, v]));
}
