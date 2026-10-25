import { arrayUnion, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { matchCode } from '../../format';
import { newId } from '../../ids';
import { addMinutes, fillTimes, maxPointsFor, minutesBetween, nextTime, scoresOf, tournamentMatches } from '../../engine/tournament';
import type { GeneratedMatch } from '../../engine/autoMatches';
import { DEFAULT_TEAM_COLORS } from '../../teamColors';
import type { EditEntry, MatchKind, PlayerId, ScorerInfo, ServeSide, TeamKey, Tournament, TournamentMatch, TournamentTeam } from '../../types';
import { editEntry, editor, run, tournamentsCol, trashCol, under } from './core';

function saveTournament(id: string, fields: Record<string, unknown>, what: string, edits: EditEntry[] = []) {
  run(updateDoc(doc(tournamentsCol, id), { ...fields, ...(edits.length ? { edits: arrayUnion(...edits) } : {}), updatedAt: Date.now() }), what);
}

const scoreOf = (m: Pick<TournamentMatch, 'scoreA' | 'scoreB'>) => `${m.scoreA}–${m.scoreB}`;

/** A new tournament with two empty teams (blue vs orange). Returns its id. */
export function createTournament(input: { name: string; date: string; invited?: PlayerId[] }): string {
  const ref = doc(tournamentsCol);
  const now = Date.now();
  const data: Omit<Tournament, 'id'> = {
    name: input.name.trim(),
    date: input.date,
    status: 'upcoming',
    pointsToWin: 21,
    maxPoints: 30,
    teams: {
      a: { name: null, color: DEFAULT_TEAM_COLORS.a, players: [] },
      b: { name: null, color: DEFAULT_TEAM_COLORS.b, players: [] },
    },
    schedule: { start: null, minutes: 15 },
    matches: {},
    invited: input.invited ?? [],
    edits: [],
    createdAt: now,
    updatedAt: now,
  };
  run(setDoc(ref, data), 'Creating the tournament');
  return ref.id;
}

export function updateTournament(id: string, patch: Partial<Pick<Tournament, 'name' | 'date' | 'status'>>) {
  const edits = patch.status === 'completed' ? [editEntry(null, 'Finished the tournament')] : patch.status ? [editEntry(null, 'Reopened the tournament')] : [];
  saveTournament(id, patch, 'Saving the tournament', edits);
}

/** Move the tournament to Recently deleted (Admin page) for 30 days; it leaves the stats straight away. */
export function deleteTournament(t: Tournament) {
  const { id, ...data } = t;
  const batch = writeBatch(db);
  batch.set(doc(trashCol, id), { kind: 'tournament', title: t.name, date: t.date, data, deletedAt: Date.now(), deletedBy: editor().name });
  batch.delete(doc(tournamentsCol, id));
  run(batch.commit(), 'Deleting the tournament');
}

/** Both teams (names, colours, players; the common player is in both lists) in one write. */
export function saveTeams(id: string, teams: Record<TeamKey, TournamentTeam>) {
  saveTournament(id, { teams }, 'Saving the teams');
}

function newMatch(input: { kind: MatchKind; a: PlayerId[]; b: PlayerId[]; time: string | null }, order: number): TournamentMatch {
  return {
    id: newId(),
    order,
    ...input,
    status: 'scheduled',
    scoreA: 0,
    scoreB: 0,
    log: '',
    typedPoints: 0,
    scorer: null,
    pointsToWin: null,
    maxPoints: null,
    firstServe: null,
    startedAt: null,
    completedAt: null,
  };
}

export function addTournamentMatch(t: Tournament, input: { kind: MatchKind; a: PlayerId[]; b: PlayerId[]; time: string | null }): string {
  const match = newMatch(input, Math.max(0, ...Object.values(t.matches).map((m) => m.order)) + 1);
  saveTournament(t.id, { [`matches.${match.id}`]: match }, 'Adding the match');
  return match.id;
}

/**
 * Add a whole list of matches (from "Create matches"), after the current ones or in place of the
 * ones not played yet. Times continue from the schedule's start time, when there is one.
 */
export function addGeneratedMatches(t: Tournament, list: GeneratedMatch[], replaceUnplayed: boolean) {
  const fields: Record<string, unknown> = {};
  const kept = tournamentMatches(t).filter((m) => !replaceUnplayed || m.status !== 'scheduled');
  if (replaceUnplayed) {
    for (const m of tournamentMatches(t)) if (m.status === 'scheduled') fields[`matches.${m.id}`] = deleteField();
    // Close any gaps the removed matches leave in the order.
    kept.forEach((m, i) => {
      if (m.order !== i + 1) fields[`matches.${m.id}.order`] = i + 1;
    });
  }
  const start = nextTime({ ...t, matches: Object.fromEntries(kept.map((m) => [m.id, m])) });
  const times = start ? fillTimes(start, t.schedule.minutes, list.length) : list.map(() => null);
  list.forEach((g, i) => {
    const m = newMatch({ kind: g.kind, a: g.a, b: g.b, time: times[i] }, kept.length + i + 1);
    fields[`matches.${m.id}`] = m;
  });
  const what = `Created ${list.length} match${list.length === 1 ? '' : 'es'}${replaceUnplayed ? ' (replacing the ones not played yet)' : ''}`;
  saveTournament(t.id, fields, 'Creating the matches', [editEntry(null, what)]);
}

export function editTournamentMatch(t: Tournament, matchId: string, patch: Partial<Pick<TournamentMatch, 'kind' | 'a' | 'b' | 'time'>>) {
  const m = t.matches[matchId];
  const players = m && (patch.a || patch.b) && ((patch.a ?? m.a).join() !== m.a.join() || (patch.b ?? m.b).join() !== m.b.join());
  saveTournament(t.id, under(`matches.${matchId}`, patch), 'Saving the match', players && m.status !== 'scheduled' ? [editEntry(m.order, `${matchCode(m.order)}: players changed`)] : []);
}

/** Remove a match and close the gap in the order. */
export function deleteTournamentMatch(t: Tournament, matchId: string) {
  const target = t.matches[matchId];
  if (!target) return;
  const fields: Record<string, unknown> = { [`matches.${matchId}`]: deleteField() };
  for (const m of Object.values(t.matches)) if (m.order > target.order) fields[`matches.${m.id}.order`] = m.order - 1;
  const what = `Deleted ${matchCode(target.order)}${target.status === 'completed' ? ` (${scoreOf(target)})` : ''}`;
  saveTournament(t.id, fields, 'Deleting the match', [editEntry(target.order, what)]);
}

/** Swap a match with the one before (-1) or after (+1). Times belong to the slots, so they stay put. */
export function moveTournamentMatch(t: Tournament, matchId: string, dir: -1 | 1) {
  const list = tournamentMatches(t);
  const i = list.findIndex((m) => m.id === matchId);
  const other = list[i + dir];
  if (i < 0 || !other) return;
  const m = list[i];
  saveTournament(
    t.id,
    { [`matches.${m.id}.order`]: other.order, [`matches.${other.id}.order`]: m.order, [`matches.${m.id}.time`]: other.time, [`matches.${other.id}.time`]: m.time },
    'Moving the match',
  );
}

/** Set one match's time, optionally moving every later match by the same amount. */
export function setTournamentMatchTime(t: Tournament, matchId: string, time: string | null, shiftLater: boolean) {
  const target = t.matches[matchId];
  if (!target) return;
  const fields: Record<string, unknown> = { [`matches.${matchId}.time`]: time };
  if (shiftLater && time && target.time) {
    const delta = minutesBetween(target.time, time);
    for (const m of tournamentMatches(t)) if (m.order > target.order && m.time) fields[`matches.${m.id}.time`] = addMinutes(m.time, delta);
  }
  saveTournament(t.id, fields, 'Saving the time');
}

/** Every match's time from a start time, `minutes` apart, in schedule order. */
export function fillTournamentTimes(t: Tournament, start: string, minutes: number) {
  const list = tournamentMatches(t);
  const times = fillTimes(start, minutes, list.length);
  const fields: Record<string, unknown> = { schedule: { start, minutes } };
  list.forEach((m, i) => (fields[`matches.${m.id}.time`] = times[i]));
  saveTournament(t.id, fields, 'Filling in the times');
}

export function startTournamentMatch(t: Tournament, matchId: string, scorer: ScorerInfo) {
  const now = Date.now();
  saveTournament(
    t.id,
    {
      ...under(`matches.${matchId}`, { status: 'live', startedAt: now, completedAt: null, scorer: { ...scorer, at: now } }),
      ...(t.status === 'upcoming' ? { status: 'live' } : {}),
    },
    'Starting the match',
  );
}

/** Save the point-by-point log after a point or an undo; the scores follow from it. */
export function scoreTournamentMatch(t: Tournament, matchId: string, log: string, scorer: ScorerInfo) {
  const { a, b } = scoresOf(log);
  saveTournament(t.id, under(`matches.${matchId}`, { log, scoreA: a, scoreB: b, scorer: { ...scorer, at: Date.now() } }), 'Saving the score');
}

/** Score on this phone from now on (the other phone sees who took over). */
export function claimTournamentScorer(t: Tournament, matchId: string, scorer: ScorerInfo) {
  saveTournament(t.id, { [`matches.${matchId}.scorer`]: { ...scorer, at: Date.now() } }, 'Taking over the scoring');
}

/** Who serves first (for the serve indicator), or null to clear it. */
export function setTournamentFirstServe(t: Tournament, matchId: string, side: ServeSide | null) {
  saveTournament(t.id, { [`matches.${matchId}.firstServe`]: side }, 'Saving who serves');
}

export function finishTournamentMatch(t: Tournament, matchId: string) {
  const m = t.matches[matchId];
  const by = m?.scorer?.name;
  saveTournament(
    t.id,
    under(`matches.${matchId}`, { status: 'completed', completedAt: Date.now(), scorer: null }),
    'Finishing the match',
    m ? [editEntry(m.order, `${matchCode(m.order)} result: ${scoreOf(m)} (scored live${by ? ` by ${by}` : ''})`)] : [],
  );
}

/** Carry on scoring a finished match (e.g. a point was missed). A typed-in score gets a log to build on. */
export function resumeTournamentMatch(t: Tournament, matchId: string, scorer: ScorerInfo) {
  const m = t.matches[matchId];
  if (!m) return;
  const log = m.log || 'A'.repeat(m.scoreA) + 'B'.repeat(m.scoreB);
  // A made-up log isn't real point-by-point play: the rally stats leave this match out.
  const typedPoints = m.log ? m.typedPoints : log.length;
  saveTournament(
    t.id,
    under(`matches.${matchId}`, { status: 'live', completedAt: null, log, typedPoints, scorer: { ...scorer, at: Date.now() } }),
    'Reopening the match',
    [editEntry(m.order, `${matchCode(m.order)} reopened for scoring (was ${scoreOf(m)})`)],
  );
}

/** A match's target and cap fields: cleared (back to the tournament's 21) or e.g. 15 → 21, 10 → 14. */
function targetFields(t: Tournament, pointsToWin: number): { pointsToWin: number | null; maxPoints: number | null } {
  return pointsToWin === t.pointsToWin ? { pointsToWin: null, maxPoints: null } : { pointsToWin, maxPoints: maxPointsFor(pointsToWin) };
}

/** Play this match to a different target (e.g. cut to 15 or 10 when time is short). */
export function setMatchTarget(t: Tournament, matchId: string, pointsToWin: number) {
  saveTournament(t.id, under(`matches.${matchId}`, targetFields(t, pointsToWin)), 'Changing the target');
}

/** Type in a final score (a match scored on paper, or a correction), and the target it was played to. */
export function setTournamentMatchScore(t: Tournament, matchId: string, scoreA: number, scoreB: number, pointsToWin = t.pointsToWin) {
  const now = Date.now();
  const m = t.matches[matchId];
  const code = m ? matchCode(m.order) : 'A match';
  const what = m?.status === 'completed' ? `${code}: ${scoreOf(m)} → ${scoreA}–${scoreB}` : `${code} result: ${scoreA}–${scoreB} (typed in)`;
  saveTournament(
    t.id,
    {
      ...under(`matches.${matchId}`, {
        status: 'completed',
        scoreA,
        scoreB,
        log: '',
        typedPoints: 0,
        scorer: null,
        startedAt: m?.startedAt ?? now,
        completedAt: now,
        ...targetFields(t, pointsToWin),
      }),
      ...(t.status === 'upcoming' ? { status: 'live' } : {}),
    },
    'Saving the score',
    m ? [editEntry(m.order, what)] : [],
  );
}

/** Back to not played: clears the score. */
export function resetTournamentMatch(t: Tournament, matchId: string) {
  const m = t.matches[matchId];
  saveTournament(
    t.id,
    under(`matches.${matchId}`, { status: 'scheduled', scoreA: 0, scoreB: 0, log: '', typedPoints: 0, scorer: null, firstServe: null, startedAt: null, completedAt: null }),
    'Resetting the match',
    m && m.status !== 'scheduled' ? [editEntry(m.order, `${matchCode(m.order)} reset to not played (was ${scoreOf(m)})`)] : [],
  );
}
