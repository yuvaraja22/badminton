import { doc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import type { OwnProfileFields, Player, PlayerId } from '../../types';
import { linksCol, playersCol, run, tracked } from './core';

export function createPlayer(input: { name: string; level: number; guest?: boolean } & Partial<OwnProfileFields>): PlayerId {
  const ref = doc(playersCol);
  run(
    setDoc(ref, {
      name: input.name.trim(),
      level: input.level,
      active: true,
      photo: input.photo ?? null,
      bio: input.bio ?? null,
      hand: input.hand ?? null,
      position: input.position ?? null,
      racket: input.racket ?? null,
      ...(input.guest ? { guest: true } : {}),
      createdAt: Date.now(),
    }),
    input.guest ? 'Adding the guest' : 'Adding player',
  );
  return ref.id;
}

export function updatePlayer(id: PlayerId, patch: Partial<Omit<Player, 'id'>>) {
  run(updateDoc(doc(playersCol, id), patch), 'Saving player');
}

/** A linked player editing their own profile (the rules only allow these fields). */
export function updateOwnProfile(id: PlayerId, patch: Partial<OwnProfileFields>) {
  run(updateDoc(doc(playersCol, id), patch), 'Saving your profile');
}

// ---------------------------------------------------------------- player accounts

/** Admin view of which Google account is linked to which player: playerId → email. */
export async function listPlayerLinks(): Promise<Record<PlayerId, string>> {
  const snap = await getDocs(linksCol);
  const out: Record<PlayerId, string> = {};
  for (const d of snap.docs) {
    const pid = d.data().playerId;
    if (typeof pid === 'string') out[pid] = d.id;
  }
  return out;
}

/** Link (or unlink, with email = null) a player's profile to a Google account. */
export async function setPlayerLink(playerId: PlayerId, email: string | null, previous: string | null) {
  const batch = writeBatch(db);
  if (previous) batch.delete(doc(linksCol, previous));
  if (email) batch.set(doc(linksCol, email.trim().toLowerCase()), { playerId, addedAt: Date.now() });
  await tracked(batch.commit());
}
