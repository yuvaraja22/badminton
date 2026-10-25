import { teamName } from '../teamColors';
import type { GameRecord, HistorySession, MatchKind, PlayerId, TeamKey, Tournament, TournamentMatch } from '../types';
import { rallySummary, type RallyGame, type RallySummary } from './rally';
import { buildReport, type SessionReport } from './report';
import { maxPointsFor, type Side } from './scoring';

/**
 * Team tournaments: two teams, matches set up by hand (doubles and singles), each one game to 21,
 * won by 2 and capped at 30, scored live point by point. Once finished, its matches count in the stats like a session's.
 */

export const DEFAULT_TOURNAMENT_NAME = 'Team Tournament';

export { addPoint, gameState, maxPointsFor, rallyState, scoresOf, undoPoint, validFinalScore, type GameState, type Side } from './scoring';

export const sideKey = (s: Side): TeamKey => (s === 'A' ? 'a' : 'b');

/** Matches in schedule order. */
export function tournamentMatches(t: Pick<Tournament, 'matches'>): TournamentMatch[] {
  return Object.values(t.matches).sort((x, y) => x.order - y.order || x.id.localeCompare(y.id));
}

export function liveMatch(t: Pick<Tournament, 'matches'>): TournamentMatch | null {
  return tournamentMatches(t).find((m) => m.status === 'live') ?? null;
}

/** The first match not played yet. */
export function nextMatch(t: Pick<Tournament, 'matches'>): TournamentMatch | null {
  return tournamentMatches(t).find((m) => m.status === 'scheduled') ?? null;
}

// ---------------------------------------------------------------- scoring

/** A match's target and cap: its own when changed (e.g. cut to 15), else the tournament's. */
export function rulesFor(t: Pick<Tournament, 'pointsToWin' | 'maxPoints'>, m: Pick<TournamentMatch, 'pointsToWin' | 'maxPoints'>): { pointsToWin: number; maxPoints: number } {
  if (!m.pointsToWin) return { pointsToWin: t.pointsToWin, maxPoints: t.maxPoints };
  return { pointsToWin: m.pointsToWin, maxPoints: m.maxPoints ?? maxPointsFor(m.pointsToWin) };
}

/** A tournament match as the rally stats see it, with its own target and cap. */
export function rallyGameOf(t: Pick<Tournament, 'pointsToWin' | 'maxPoints'>, m: TournamentMatch): RallyGame {
  return { ...m, ...rulesFor(t, m) };
}

/** Point-by-point stats for every finished match, in schedule order. */
export function tournamentRally(t: Tournament): RallySummary {
  return rallySummary(tournamentMatches(t).map((m) => rallyGameOf(t, m)));
}

// ---------------------------------------------------------------- results

export function matchWinner(m: Pick<TournamentMatch, 'status' | 'scoreA' | 'scoreB'>): TeamKey | null {
  if (m.status !== 'completed' || m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? 'a' : 'b';
}

export interface TeamScore {
  /** Matches won by each team (finished matches only). */
  won: Record<TeamKey, number>;
  /** Points scored by each team in finished matches. */
  points: Record<TeamKey, number>;
  played: number;
  remaining: number;
  /** Ahead on matches won, then on points; null when level. */
  leader: TeamKey | null;
}

/** Most matches won wins; total points break a tie (e.g. when matches go unplayed). */
export function teamScore(t: Pick<Tournament, 'matches'>): TeamScore {
  const won = { a: 0, b: 0 };
  const points = { a: 0, b: 0 };
  let played = 0;
  let remaining = 0;
  for (const m of Object.values(t.matches)) {
    if (m.status !== 'completed') {
      remaining += 1;
      continue;
    }
    played += 1;
    points.a += m.scoreA;
    points.b += m.scoreB;
    const w = matchWinner(m);
    if (w) won[w] += 1;
  }
  const leader = won.a !== won.b ? (won.a > won.b ? 'a' : 'b') : points.a !== points.b ? (points.a > points.b ? 'a' : 'b') : null;
  return { won, points, played, remaining, leader };
}

/** "Smashers win 9–6", "Team B lead 3–2", "Level at 4–4", or who leads on points when the matches are level. */
export function resultLine(t: Tournament): string {
  const s = teamScore(t);
  if (s.played === 0) return 'No matches played yet.';
  const done = t.status === 'completed';
  if (s.leader === null) return done ? `A draw: ${s.won.a}–${s.won.b} on matches and level on points` : `Level at ${s.won.a}–${s.won.b}`;
  const name = teamName(t, s.leader);
  const [hi, lo] = [s.won[s.leader], s.won[s.leader === 'a' ? 'b' : 'a']];
  if (hi === lo) return `${name} ${done ? 'win' : 'lead'} on points (${hi}–${lo} on matches)`;
  return `${name} ${done ? 'win' : 'lead'} ${hi}–${lo}`;
}

/** Which team a player is listed on: one of them, both (the common player), or none. */
export function playerTeam(t: Pick<Tournament, 'teams'>, id: PlayerId): TeamKey | 'both' | null {
  const a = t.teams.a.players.includes(id);
  const b = t.teams.b.players.includes(id);
  return a && b ? 'both' : a ? 'a' : b ? 'b' : null;
}

export interface TournamentPlayerLine {
  playerId: PlayerId;
  team: TeamKey | 'both';
  /** Matches in the schedule, by type. */
  doubles: number;
  singles: number;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
}

/** Every listed player's schedule and record: best record first. */
export function playerRecords(t: Pick<Tournament, 'teams' | 'matches'>): TournamentPlayerLine[] {
  const lines = new Map<PlayerId, TournamentPlayerLine>();
  for (const id of new Set([...t.teams.a.players, ...t.teams.b.players])) {
    lines.set(id, { playerId: id, team: playerTeam(t, id)!, doubles: 0, singles: 0, played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0 });
  }
  for (const m of Object.values(t.matches)) {
    const winner = matchWinner(m);
    for (const side of ['a', 'b'] as const) {
      for (const id of m[side]) {
        const line = lines.get(id);
        if (!line) continue;
        line[m.kind] += 1;
        if (m.status !== 'completed') continue;
        line.played += 1;
        const [f, a] = side === 'a' ? [m.scoreA, m.scoreB] : [m.scoreB, m.scoreA];
        line.pointsFor += f;
        line.pointsAgainst += a;
        if (winner === side) line.won += 1;
        else if (winner) line.lost += 1;
      }
    }
  }
  return [...lines.values()].sort(
    (x, y) => y.won - x.won || y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst) || x.lost - y.lost || (x.playerId < y.playerId ? -1 : 1),
  );
}

// ---------------------------------------------------------------- setting up matches

export const sideSize = (kind: MatchKind): number => (kind === 'doubles' ? 2 : 1);

/**
 * Why a lineup can't be used, or null when it can: the right number of players per side, each side
 * from its own team's list (the common player is on both), and nobody on both sides.
 */
export function checkMatch(t: Pick<Tournament, 'teams'>, kind: MatchKind, a: PlayerId[], b: PlayerId[], nameOf: (id: PlayerId) => string = (id) => id): string | null {
  const n = sideSize(kind);
  if (a.length !== n || b.length !== n) return `Pick ${n === 2 ? 'two players' : 'one player'} for each side.`;
  if (new Set(a).size !== a.length || new Set(b).size !== b.length) return 'Pick different players.';
  const both = a.find((id) => b.includes(id));
  if (both) return `${nameOf(both)} can't play on both sides.`;
  const outA = a.find((id) => !t.teams.a.players.includes(id));
  if (outA) return `${nameOf(outA)} isn't on the first team.`;
  const outB = b.find((id) => !t.teams.b.players.includes(id));
  if (outB) return `${nameOf(outB)} isn't on the second team.`;
  return null;
}

/** Players of a match who also play the match right before it in the schedule. */
export function backToBack(t: Pick<Tournament, 'matches'>, order: number, players: PlayerId[]): PlayerId[] {
  const before = tournamentMatches(t).filter((m) => m.order < order).at(-1);
  if (!before) return [];
  const prev = new Set([...before.a, ...before.b]);
  return players.filter((id) => prev.has(id));
}

/** Scheduled matches a player is in for a given team (blocks taking them off that team). */
export function matchesFor(t: Pick<Tournament, 'matches'>, id: PlayerId, team: TeamKey): TournamentMatch[] {
  return tournamentMatches(t).filter((m) => m[team].includes(id));
}

// ---------------------------------------------------------------- times

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** "19:45" + 30 → "20:15" (wraps past midnight). */
export function addMinutes(hhmm: string, minutes: number): string {
  const total = (((toMinutes(hhmm) + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Minutes from one time to another, e.g. "19:00" → "19:20" is 20. */
export function minutesBetween(from: string, to: string): number {
  return toMinutes(to) - toMinutes(from);
}

/** Times for `count` matches from a start time, `minutes` apart. */
export function fillTimes(start: string, minutes: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMinutes(start, i * minutes));
}

/** A sensible time for a match added at the end: after the last timed match, or the start time. */
export function nextTime(t: Pick<Tournament, 'matches' | 'schedule'>): string | null {
  const last = tournamentMatches(t)
    .filter((m) => m.time)
    .at(-1);
  if (last?.time) return addMinutes(last.time, t.schedule.minutes);
  return t.schedule.start;
}

// ---------------------------------------------------------------- stats

/**
 * A finished tournament in the same compact form as a session in meta/history, so its matches count
 * in the leaderboard, profiles, partnerships and ratings exactly like session matches (singles too).
 * Null until the tournament is finished or when nothing was played.
 */
export function tournamentHistory(t: Tournament): HistorySession | null {
  if (t.status !== 'completed') return null;
  const played = tournamentMatches(t).filter((m) => m.status === 'completed' && m.scoreA !== m.scoreB);
  if (!played.length) return null;
  return {
    kind: 'tournament',
    date: t.date,
    title: t.name,
    pointsToWin: t.pointsToWin,
    players: [...new Set(played.flatMap((m) => [...m.a, ...m.b]))],
    levels: {},
    m: played.map((m) => ({
      n: m.order,
      a: m.a,
      b: m.b,
      sa: m.scoreA,
      sb: m.scoreB,
      ...(m.pointsToWin && m.pointsToWin !== t.pointsToWin ? { p: m.pointsToWin } : {}),
    })),
  };
}

/** The tournament's matches as game records (finished and on court), for the session-style report. */
export function tournamentGames(t: Tournament): GameRecord[] {
  return tournamentMatches(t)
    .filter((m) => m.status !== 'scheduled')
    .map((m) => ({
      sessionId: t.id,
      date: t.date,
      number: m.order,
      teamA: m.a,
      teamB: m.b,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      status: m.status === 'live' ? 'live' : m.scoreA === m.scoreB ? 'unfinished' : 'completed',
      ...(m.pointsToWin && m.pointsToWin !== t.pointsToWin ? { pointsToWin: m.pointsToWin } : {}),
    }));
}

/** The same report a session gets (MVP, standings, partnerships, takeaways, match log), for a tournament. */
export function tournamentReport(t: Tournament, nameOf: (id: PlayerId) => string): SessionReport {
  return buildReport({
    kind: 'tournament',
    title: t.name,
    date: t.date,
    pointsToWin: t.pointsToWin,
    games: tournamentGames(t),
    nameOf,
    sides: [teamName(t, 'a'), teamName(t, 'b')],
  });
}

/** A match's own page (the live scorer while it's on court, its summary once finished), by schedule number. */
export function matchPath(t: Pick<Tournament, 'id' | 'matches'>, order: number): string | null {
  const m = Object.values(t.matches).find((x) => x.order === order);
  return m ? `/tournaments/${t.id}/matches/${m.id}` : null;
}
