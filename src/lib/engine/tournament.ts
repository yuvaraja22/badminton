import { teamName } from '../teamColors';
import type { MatchKind, PlayerId, TeamKey, Tournament, TournamentMatch } from '../types';

/**
 * Team tournaments: two teams, matches set up by hand (doubles and singles), each one game to 21,
 * won by 2 and capped at 30, scored live point by point. Results stay separate from session stats.
 */

/** A point for Team A or Team B, as written in a match's log. */
export type Side = 'A' | 'B';

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

export function scoresOf(log: string): { a: number; b: number } {
  let a = 0;
  for (const c of log) if (c === 'A') a += 1;
  return { a, b: log.length - a };
}

export interface GameState {
  a: number;
  b: number;
  over: boolean;
  winner: Side | null;
  /** Sides one point from winning (both at 29–29 in a game capped at 30). */
  gamePoint: Side[];
  /** Level at pointsToWin − 1 or more (20–20 in a game to 21). */
  deuce: boolean;
  /** The last point took a side to the halfway mark (11) first: players change ends. */
  changeEnds: boolean;
}

function isOver(a: number, b: number, pointsToWin: number, maxPoints: number): boolean {
  const hi = Math.max(a, b);
  return hi >= maxPoints || (hi >= pointsToWin && Math.abs(a - b) >= 2);
}

/** Where a game stands, from its scores (and the last point, for changing ends). */
export function gameState(a: number, b: number, pointsToWin = 21, maxPoints = 30, last: Side | null = null): GameState {
  const over = isOver(a, b, pointsToWin, maxPoints);
  const gamePoint: Side[] = over ? [] : ([isOver(a + 1, b, pointsToWin, maxPoints) && 'A', isOver(a, b + 1, pointsToWin, maxPoints) && 'B'].filter(Boolean) as Side[]);
  const mid = Math.ceil(pointsToWin / 2);
  const [mine, theirs] = last === 'A' ? [a, b] : [b, a];
  return {
    a,
    b,
    over,
    winner: over ? (a > b ? 'A' : 'B') : null,
    gamePoint,
    deuce: !over && a === b && a >= pointsToWin - 1,
    changeEnds: last !== null && !over && mine === mid && theirs < mid,
  };
}

/** Where a live-scored game stands, from its log. */
export function rallyState(log: string, pointsToWin = 21, maxPoints = 30): GameState {
  const { a, b } = scoresOf(log);
  const last = log.length ? (log[log.length - 1] as Side) : null;
  return gameState(a, b, pointsToWin, maxPoints, last);
}

/** The log after a point for `side`; unchanged once the game is over. */
export function addPoint(log: string, side: Side, pointsToWin = 21, maxPoints = 30): string {
  return rallyState(log, pointsToWin, maxPoints).over ? log : log + side;
}

export function undoPoint(log: string): string {
  return log.slice(0, -1);
}

/** Whether typed-in scores are a game that could have finished that way (21–19, 24–22, 30–29…). */
export function validFinalScore(a: number, b: number, pointsToWin = 21, maxPoints = 30): boolean {
  if (![a, b].every((x) => Number.isInteger(x) && x >= 0)) return false;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === pointsToWin) return lo <= pointsToWin - 2;
  if (hi > pointsToWin && hi < maxPoints) return hi - lo === 2;
  if (hi === maxPoints) return lo >= maxPoints - 2;
  return false;
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
