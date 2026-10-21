import {
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { newId } from '../ids';
import { toast } from '../toast';
import type { AppConfig, Attendee, AttendeeStatus, Lineup, Match, OwnProfileFields, Player, PlayerId, RsvpStatus, Session } from '../types';
import { sortedMatches } from '../engine/games';
import { sessionData, toHistory, toSession } from './convert';

/**
 * All writes are admin-only (enforced by firestore.rules). They are applied to the local cache
 * immediately, so the UI updates at once even offline; we never block on the server round-trip.
 */

const playersCol = collection(db, 'players');
const sessionsCol = collection(db, 'sessions');
const historyRef = doc(db, 'meta', 'history');
const configRef = doc(db, 'meta', 'config');

function describe(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === 'permission-denied') return 'only admins can make changes';
  return (e as Error)?.message ?? String(e);
}

function run(p: Promise<unknown>, what: string) {
  p.catch((e) => toast(`${what} failed: ${describe(e)}`, 'error'));
}

function lastNumber(session: Session): number {
  return sortedMatches(session).at(-1)?.number ?? 0;
}

function availableIds(session: Session): PlayerId[] {
  return Object.entries(session.attendees)
    .filter(([, a]) => a.status === 'available')
    .map(([id]) => id);
}

function putHistory(batch: WriteBatch, session: Session) {
  batch.set(historyRef, { sessions: { [session.id]: toHistory(session) } }, { mergeFields: [new FieldPath('sessions', session.id)] });
}

// ---------------------------------------------------------------- players

export function createPlayer(input: { name: string; level: number } & Partial<OwnProfileFields>): PlayerId {
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
      createdAt: Date.now(),
    }),
    'Adding player',
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

const linksCol = collection(db, 'links');

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
  await batch.commit();
}

// ---------------------------------------------------------------- planned sessions (RSVP)

const eventsCol = collection(db, 'events');

export function planSession(input: { date: string; time: string | null; note: string | null }): string {
  const ref = doc(eventsCol);
  run(
    setDoc(ref, { ...input, status: 'planned', sessionId: null, rsvps: {}, createdAt: Date.now() }),
    'Planning the session',
  );
  return ref.id;
}

export function updatePlannedSession(id: string, patch: { date: string; time: string | null; note: string | null }) {
  run(updateDoc(doc(eventsCol, id), patch), 'Saving the session');
}

export function cancelPlannedSession(id: string) {
  run(deleteDoc(doc(eventsCol, id)), 'Cancelling the session');
}

/** "I'm in" / "Can't make it" (null clears the answer). */
export function setRsvp(eventId: string, playerId: PlayerId, status: RsvpStatus | null) {
  run(
    updateDoc(doc(eventsCol, eventId), { [`rsvps.${playerId}`]: status ? { status, at: Date.now() } : deleteField() }),
    'Saving your answer',
  );
}

export function markPlannedStarted(eventId: string, sessionId: string) {
  run(updateDoc(doc(eventsCol, eventId), { status: 'started', sessionId }), 'Updating the planned session');
}

// ---------------------------------------------------------------- sessions

export function createSession(input: {
  date: string;
  title: string;
  pointsToWin: number;
  /** levelOverride: the admin changed this level for the session (balance by it, not the rating). */
  players: { id: PlayerId; level: number; levelOverride?: boolean }[];
}): string {
  const ref = doc(sessionsCol);
  const now = Date.now();
  const attendees: Record<PlayerId, Attendee> = {};
  input.players.forEach((p, i) => {
    attendees[p.id] = { level: p.level, status: 'available', since: 0, catchUp: [], order: i, levelOverride: p.levelOverride === true };
  });
  const session: Session = {
    id: ref.id,
    date: input.date,
    title: input.title.trim(),
    status: 'live',
    pointsToWin: input.pointsToWin,
    attendees,
    matches: {},
    nextPick: null,
    shuffle: 0,
    takeaways: null,
    playerIds: input.players.map((p) => p.id),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  run(setDoc(ref, sessionData(session)), 'Creating session');
  return ref.id;
}

/**
 * Write changed / removed matches. Live sessions update single fields (safe with two admins);
 * completed sessions rewrite their match map and keep meta/history in sync in the same batch.
 */
function writeMatches(session: Session, changed: Match[], removed: string[] = [], extra: Record<string, unknown> = {}) {
  const ref = doc(sessionsCol, session.id);
  const now = Date.now();
  if (session.status === 'completed') {
    const matches = { ...session.matches };
    for (const id of removed) delete matches[id];
    for (const m of changed) matches[m.id] = m;
    const batch = writeBatch(db);
    batch.update(ref, { matches, ...extra, updatedAt: now });
    putHistory(batch, { ...session, ...extra, matches });
    run(batch.commit(), 'Saving');
    return;
  }
  const updates: Record<string, unknown> = { ...extra, updatedAt: now };
  for (const m of changed) updates[`matches.${m.id}`] = m;
  for (const id of removed) updates[`matches.${id}`] = deleteField();
  run(updateDoc(ref, updates), 'Saving');
}

/** Put a lineup on court as the next match. */
export function startMatch(session: Session, lineup: Lineup) {
  const id = newId();
  const available = new Set([...availableIds(session), ...lineup.teamA, ...lineup.teamB]);
  const match: Match = {
    id,
    number: lastNumber(session) + 1,
    teamA: lineup.teamA,
    teamB: lineup.teamB,
    scoreA: null,
    scoreB: null,
    status: 'live',
    available: [...available],
    createdAt: Date.now(),
    completedAt: null,
  };
  writeMatches(session, [match], [], { nextPick: null, shuffle: 0 });
}

export function saveMatch(session: Session, match: Match) {
  const available = new Set([...match.available, ...match.teamA, ...match.teamB]);
  const done = match.status !== 'live';
  writeMatches(session, [{ ...match, available: [...available], completedAt: done ? (match.completedAt ?? Date.now()) : null }]);
}

/** Delete a match and renumber the ones after it (catch-up windows shift with them). */
export function deleteMatch(session: Session, matchId: string) {
  const target = session.matches[matchId];
  if (!target) return;
  const later = sortedMatches(session)
    .filter((m) => m.number > target.number)
    .map((m) => ({ ...m, number: m.number - 1 }));
  const shift = (n: number) => (n > target.number ? n - 1 : n);
  const extra: Record<string, unknown> = {};
  for (const [pid, a] of Object.entries(session.attendees)) {
    if (!a.catchUp.length && a.since <= target.number) continue;
    const windows = a.catchUp.map((w) => ({ from: shift(w.from), to: shift(w.to) })).filter((w) => w.from <= w.to);
    if (session.status === 'completed') continue;
    extra[`attendees.${pid}`] = { ...a, since: shift(a.since), catchUp: windows };
  }
  writeMatches(session, later, [matchId], extra);
}

export function setNextPick(session: Session, lineup: Lineup | null) {
  run(updateDoc(doc(sessionsCol, session.id), { nextPick: lineup, shuffle: 0, updatedAt: Date.now() }), 'Saving lineup');
}

export function shuffleNext(session: Session) {
  run(updateDoc(doc(sessionsCol, session.id), { nextPick: null, shuffle: increment(1), updatedAt: Date.now() }), 'Shuffling');
}

export type JoinMode = 'fair' | 'catchUp';

/** Add someone to a running session (late arrival). */
export function addAttendee(session: Session, playerId: PlayerId, level: number, mode: JoinMode, levelOverride = false) {
  const last = lastNumber(session);
  const order = Math.max(-1, ...Object.values(session.attendees).map((a) => a.order)) + 1;
  const attendee: Attendee = {
    level,
    status: 'available',
    since: last,
    catchUp: mode === 'catchUp' && last > 0 ? [{ from: 1, to: last }] : [],
    order,
    levelOverride,
  };
  run(
    updateDoc(doc(sessionsCol, session.id), {
      [`attendees.${playerId}`]: attendee,
      playerIds: arrayUnion(playerId),
      updatedAt: Date.now(),
    }),
    'Adding player',
  );
}

/** Rest / leave / come back. Coming back with "catch up" credits the matches missed while away. */
export function setAttendeeStatus(session: Session, playerId: PlayerId, status: AttendeeStatus, mode: JoinMode = 'fair') {
  const a = session.attendees[playerId];
  if (!a) return;
  const last = lastNumber(session);
  let catchUp = a.catchUp;
  if (status === 'available' && a.status !== 'available' && mode === 'catchUp' && last > a.since) {
    catchUp = [...catchUp, { from: a.since + 1, to: last }];
  }
  run(
    updateDoc(doc(sessionsCol, session.id), {
      [`attendees.${playerId}`]: { ...a, status, since: last, catchUp },
      updatedAt: Date.now(),
    }),
    'Updating player',
  );
}

/** Set the level a player is balanced by for this session (levelOverride), or go back to their rating. */
export function setAttendeeLevel(session: Session, playerId: PlayerId, level: number, levelOverride = true) {
  const a = session.attendees[playerId];
  if (!a) return;
  run(
    updateDoc(doc(sessionsCol, session.id), {
      [`attendees.${playerId}.level`]: level,
      [`attendees.${playerId}.levelOverride`]: levelOverride,
      updatedAt: Date.now(),
    }),
    'Updating level',
  );
}

/** End the session: matches still on court become unfinished; the session joins the all-time stats. */
export function completeSession(session: Session, takeaways: string[]) {
  const matches: Record<string, Match> = {};
  for (const m of Object.values(session.matches)) matches[m.id] = m.status === 'live' ? { ...m, status: 'unfinished' } : m;
  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(doc(sessionsCol, session.id), {
    matches,
    status: 'completed',
    takeaways,
    nextPick: null,
    completedAt: now,
    updatedAt: now,
  });
  putHistory(batch, { ...session, matches, status: 'completed' });
  run(batch.commit(), 'Ending session');
}

/** Back to live (e.g. ended by mistake). It leaves the all-time stats until ended again. */
export function reopenSession(session: Session) {
  const batch = writeBatch(db);
  batch.update(doc(sessionsCol, session.id), { status: 'live', completedAt: null, updatedAt: Date.now() });
  batch.set(historyRef, { sessions: { [session.id]: deleteField() } }, { merge: true });
  run(batch.commit(), 'Reopening session');
}

export function updateSessionDetails(session: Session, patch: { date: string; title: string; pointsToWin: number }) {
  if (session.status === 'completed') {
    const batch = writeBatch(db);
    batch.update(doc(sessionsCol, session.id), { ...patch, updatedAt: Date.now() });
    putHistory(batch, { ...session, ...patch });
    run(batch.commit(), 'Saving session');
  } else {
    run(updateDoc(doc(sessionsCol, session.id), { ...patch, updatedAt: Date.now() }), 'Saving session');
  }
}

export function updateTakeaways(session: Session, takeaways: string[] | null) {
  run(updateDoc(doc(sessionsCol, session.id), { takeaways, updatedAt: Date.now() }), 'Saving takeaways');
}

export function deleteSession(session: Session) {
  const batch = writeBatch(db);
  batch.delete(doc(sessionsCol, session.id));
  batch.set(historyRef, { sessions: { [session.id]: deleteField() } }, { merge: true });
  run(batch.commit(), 'Deleting session');
}

// ---------------------------------------------------------------- admin

export function saveConfig(config: AppConfig) {
  run(setDoc(configRef, config, { merge: true }), 'Saving settings');
}

export async function listAdmins(): Promise<string[]> {
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs.map((d) => d.id).sort();
}

export async function addAdmin(email: string) {
  await setDoc(doc(db, 'admins', email.trim().toLowerCase()), { addedAt: Date.now() });
}

export async function removeAdmin(email: string) {
  await deleteDoc(doc(db, 'admins', email));
}

/** Recompute meta/history from every completed session (repairs the all-time stats cache). */
export async function rebuildHistory(): Promise<number> {
  const snap = await getDocs(query(sessionsCol, where('status', '==', 'completed')));
  const sessions = Object.fromEntries(snap.docs.map((d) => [d.id, toHistory(toSession(d.id, d.data()))]));
  await setDoc(historyRef, { sessions });
  return snap.size;
}
