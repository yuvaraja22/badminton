import { arrayUnion, deleteField, doc, increment, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { matchCode } from '../../format';
import { newId } from '../../ids';
import { sortedMatches } from '../../engine/games';
import { scoresOf, typedLog } from '../../engine/scoring';
import { matchChange, scoreText } from '../../edits';
import type { Attendee, AttendeeStatus, EditEntry, Lineup, Match, PlayerId, ScorerInfo, ServeSide, Session } from '../../types';
import { sessionData } from '../convert';
import { editEntry, editor, historyRef, putHistory, run, sessionsCol, trashCol, under } from './core';

function lastNumber(session: Session): number {
  return sortedMatches(session).at(-1)?.number ?? 0;
}

function availableIds(session: Session): PlayerId[] {
  return Object.entries(session.attendees)
    .filter(([, a]) => a.status === 'available')
    .map(([id]) => id);
}

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
    edits: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  run(setDoc(ref, sessionData(session)), 'Creating session');
  return ref.id;
}

// ---------------------------------------------------------------- matches

/**
 * Write changed / removed matches. Live sessions update single fields (safe with two admins);
 * completed sessions rewrite their match map and keep meta/history in sync in the same batch.
 */
function writeMatches(session: Session, changed: Match[], removed: string[] = [], extra: Record<string, unknown> = {}, edits: EditEntry[] = []) {
  const ref = doc(sessionsCol, session.id);
  const now = Date.now();
  const history = edits.length ? { edits: arrayUnion(...edits) } : {};
  if (session.status === 'completed') {
    const matches = { ...session.matches };
    for (const id of removed) delete matches[id];
    for (const m of changed) matches[m.id] = m;
    const batch = writeBatch(db);
    batch.update(ref, { matches, ...extra, ...history, updatedAt: now });
    putHistory(batch, { ...session, ...extra, matches });
    run(batch.commit(), 'Saving');
    return;
  }
  const updates: Record<string, unknown> = { ...extra, ...history, updatedAt: now };
  for (const m of changed) updates[`matches.${m.id}`] = m;
  for (const id of removed) updates[`matches.${id}`] = deleteField();
  run(updateDoc(ref, updates), 'Saving');
}

/** Put a lineup on court as the next match (scored live on this phone when `scorer` is given). Returns its id. */
export function startMatch(session: Session, lineup: Lineup, scorer?: ScorerInfo): string {
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
    ...(scorer ? { scorer: { ...scorer, at: Date.now() } } : {}),
    createdAt: Date.now(),
    completedAt: null,
  };
  writeMatches(session, [match], [], { nextPick: null, shuffle: 0 });
  return id;
}

/**
 * Save a match's result (or any edit to it). A typed-in score that differs from the live log replaces
 * it (the rally stats then leave the match out).
 */
export function saveMatch(session: Session, match: Match) {
  const before = session.matches[match.id];
  const available = new Set([...match.available, ...match.teamA, ...match.teamB]);
  const done = match.status !== 'live';
  const fromLog = match.log ? scoresOf(match.log) : null;
  const logStale = fromLog !== null && (fromLog.a !== match.scoreA || fromLog.b !== match.scoreB);
  const next: Match = {
    ...match,
    ...(logStale ? { log: '', typedPoints: 0 } : {}),
    available: [...available],
    scorer: done ? null : (match.scorer ?? null),
    completedAt: done ? (match.completedAt ?? Date.now()) : null,
  };
  const change = matchChange(before, next);
  writeMatches(session, [next], [], {}, change ? [editEntry(next.number, change)] : []);
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
  const note = later.length ? `; ${matchCode(later[0].number + 1)} onwards renumbered` : '';
  writeMatches(session, later, [matchId], extra, [editEntry(target.number, `Deleted ${matchCode(target.number)} (${scoreText(target)})${note}`)]);
}

export function setNextPick(session: Session, lineup: Lineup | null) {
  run(updateDoc(doc(sessionsCol, session.id), { nextPick: lineup, shuffle: 0, updatedAt: Date.now() }), 'Saving lineup');
}

export function shuffleNext(session: Session) {
  run(updateDoc(doc(sessionsCol, session.id), { nextPick: null, shuffle: increment(1), updatedAt: Date.now() }), 'Shuffling');
}

// ---------------------------------------------------------------- live scoring

/** Score this match point by point on this phone. A score typed in so far becomes the start of the log. */
export function startLiveScoring(session: Session, matchId: string, scorer: ScorerInfo) {
  const m = session.matches[matchId];
  if (!m) return;
  const typed = m.log ? null : typedLog(m.scoreA ?? 0, m.scoreB ?? 0);
  const fields: Record<string, unknown> = {
    scorer: { ...scorer, at: Date.now() },
    ...(typed !== null ? { log: typed, typedPoints: typed.length, scoreA: m.scoreA ?? 0, scoreB: m.scoreB ?? 0 } : {}),
  };
  run(updateDoc(doc(sessionsCol, session.id), { ...under(`matches.${matchId}`, fields), updatedAt: Date.now() }), 'Starting the live score');
}

/**
 * Save the point-by-point log after a point or an undo; the scores follow from it. `typedPoints` is
 * passed when live scoring carries on from a score that was typed in (the start of the log).
 */
export function scoreSessionMatch(session: Session, matchId: string, log: string, scorer: ScorerInfo, typedPoints?: number) {
  const { a, b } = scoresOf(log);
  const fields = { log, scoreA: a, scoreB: b, scorer: { ...scorer, at: Date.now() }, ...(typedPoints !== undefined ? { typedPoints } : {}) };
  run(updateDoc(doc(sessionsCol, session.id), { ...under(`matches.${matchId}`, fields), updatedAt: Date.now() }), 'Saving the score');
}

/** Score on this phone from now on (the other phone sees who took over). */
export function claimSessionScorer(session: Session, matchId: string, scorer: ScorerInfo) {
  run(updateDoc(doc(sessionsCol, session.id), { [`matches.${matchId}.scorer`]: { ...scorer, at: Date.now() } }), 'Taking over the scoring');
}

/** Who serves first (for the serve indicator), or null to clear it. */
export function setSessionFirstServe(session: Session, matchId: string, side: ServeSide | null) {
  run(updateDoc(doc(sessionsCol, session.id), { [`matches.${matchId}.firstServe`]: side }), 'Saving who serves');
}

// ---------------------------------------------------------------- attendance

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

// ---------------------------------------------------------------- the whole session

/** End the session: matches still on court become unfinished; the session joins the all-time stats. */
export function completeSession(session: Session, takeaways: string[]) {
  const matches: Record<string, Match> = {};
  for (const m of Object.values(session.matches)) matches[m.id] = m.status === 'live' ? { ...m, status: 'unfinished', scorer: null } : m;
  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(doc(sessionsCol, session.id), {
    matches,
    status: 'completed',
    takeaways,
    nextPick: null,
    completedAt: now,
    updatedAt: now,
    edits: arrayUnion(editEntry(null, 'Ended the session')),
  });
  putHistory(batch, { ...session, matches, status: 'completed' });
  run(batch.commit(), 'Ending session');
}

/** Back to live (e.g. ended by mistake). It leaves the all-time stats until ended again. */
export function reopenSession(session: Session) {
  const batch = writeBatch(db);
  batch.update(doc(sessionsCol, session.id), { status: 'live', completedAt: null, updatedAt: Date.now(), edits: arrayUnion(editEntry(null, 'Reopened the session')) });
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

/** Move the session to Recently deleted (Admin page) for 30 days; it leaves the stats straight away. */
export function deleteSession(session: Session) {
  const batch = writeBatch(db);
  batch.set(doc(trashCol, session.id), {
    kind: 'session',
    title: session.title,
    date: session.date,
    data: sessionData(session),
    deletedAt: Date.now(),
    deletedBy: editor().name,
  });
  batch.delete(doc(sessionsCol, session.id));
  batch.set(historyRef, { sessions: { [session.id]: deleteField() } }, { merge: true });
  run(batch.commit(), 'Deleting session');
}
