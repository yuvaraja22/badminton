import type { GameRecord, HistorySession, Match, PlayerId, Session } from '../types';
import type { RallyGame } from './rally';
import { maxPointsFor } from './scoring';

/** Anything with two sides of players: a game, a match, a lineup (singles sides have one player). */
type Sides = { teamA: readonly PlayerId[]; teamB: readonly PlayerId[] };

export type Side = 'A' | 'B';

/** A game counts toward stats only when it was completed with a decisive final score. */
export function isCounted(g: GameRecord): boolean {
  return g.status === 'completed' && g.scoreA != null && g.scoreB != null && g.scoreA !== g.scoreB;
}

export function winnerSide(g: GameRecord): Side | null {
  if (g.scoreA == null || g.scoreB == null || g.scoreA === g.scoreB) return null;
  return g.scoreA > g.scoreB ? 'A' : 'B';
}

export function margin(g: GameRecord): number {
  return Math.abs((g.scoreA ?? 0) - (g.scoreB ?? 0));
}

export function topScore(g: GameRecord): number {
  return Math.max(g.scoreA ?? 0, g.scoreB ?? 0);
}

export function totalPoints(g: GameRecord): number {
  return (g.scoreA ?? 0) + (g.scoreB ?? 0);
}

export function playersOf(g: Sides): PlayerId[] {
  return [...g.teamA, ...g.teamB];
}

export function sideOf(g: Sides, pid: PlayerId): Side | null {
  if (g.teamA.includes(pid)) return 'A';
  if (g.teamB.includes(pid)) return 'B';
  return null;
}

export function teamOf(g: Sides, side: Side): readonly PlayerId[] {
  return side === 'A' ? g.teamA : g.teamB;
}

export function otherSide(side: Side): Side {
  return side === 'A' ? 'B' : 'A';
}

/** The player's partner in a doubles game; null in singles. */
export function partnerOf(g: Sides, pid: PlayerId): PlayerId | null {
  const side = sideOf(g, pid);
  if (!side) return null;
  return teamOf(g, side).find((p) => p !== pid) ?? null;
}

/** [points for, points against] from a player's (or side's) perspective. */
export function scoreFor(g: GameRecord, side: Side): [number, number] {
  const a = g.scoreA ?? 0;
  const b = g.scoreB ?? 0;
  return side === 'A' ? [a, b] : [b, a];
}

/** Order-independent key for a pair of players. */
export function pairKey(a: PlayerId, b: PlayerId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function sortedMatches(session: Pick<Session, 'matches'>): Match[] {
  return Object.values(session.matches ?? {}).sort((a, b) => a.number - b.number);
}

export function sessionGames(session: Pick<Session, 'id' | 'date' | 'matches'>): GameRecord[] {
  return sortedMatches(session).map((m) => ({
    sessionId: session.id,
    date: session.date,
    number: m.number,
    teamA: m.teamA,
    teamB: m.teamB,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    status: m.status,
  }));
}

export function historyGames(sessionId: string, h: HistorySession): GameRecord[] {
  return [...h.m]
    .sort((a, b) => a.n - b.n)
    .map((m) => ({
      sessionId,
      date: h.date,
      number: m.n,
      teamA: m.a,
      teamB: m.b,
      scoreA: m.sa,
      scoreB: m.sb,
      status: m.u ? 'unfinished' : 'completed',
      ...(m.p ? { pointsToWin: m.p } : {}),
    }));
}

/** History entries sorted oldest → newest (by date, then id for stability). */
export function sortedHistory(history: Record<string, HistorySession>): [string, HistorySession][] {
  return Object.entries(history).sort(([ia, a], [ib, b]) => a.date.localeCompare(b.date) || ia.localeCompare(ib));
}

/** A session's matches as the rally stats see them (only those scored live have a log). */
export function sessionRallyGames(session: Pick<Session, 'matches' | 'pointsToWin'>): RallyGame[] {
  const maxPoints = maxPointsFor(session.pointsToWin);
  return sortedMatches(session).map((m) => rallyGameOfMatch(m, session.pointsToWin, maxPoints));
}

export function rallyGameOfMatch(m: Match, pointsToWin: number, maxPoints = maxPointsFor(pointsToWin)): RallyGame {
  return {
    id: m.id,
    order: m.number,
    a: m.teamA,
    b: m.teamB,
    log: m.log ?? '',
    typedPoints: m.typedPoints ?? 0,
    scoreA: m.scoreA ?? 0,
    scoreB: m.scoreB ?? 0,
    status: m.status,
    pointsToWin,
    maxPoints,
  };
}
