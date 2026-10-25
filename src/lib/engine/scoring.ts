/**
 * Scoring one game point by point (rally scoring): first to pointsToWin, won by 2, capped at maxPoints.
 * Shared by the live scorer for tournament matches and for session matches. A game's log is one letter
 * per point, "A" for the first side (Team A / Team 1) and "B" for the other.
 */

/** A point for side A or side B, as written in a log. */
export type Side = 'A' | 'B';

/**
 * The cap for a game to `pointsToWin`, won by 2: the target plus 40%, rounded up. That gives the
 * official 21 → 30 and 15 → 21, and 11 → 16, 10 → 14 for quicker games.
 */
export function maxPointsFor(pointsToWin: number): number {
  return pointsToWin + Math.ceil(pointsToWin * 0.4);
}

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

/** A log for a score that was typed in (so live scoring can carry on from it): A's points, then B's. */
export function typedLog(scoreA: number, scoreB: number): string {
  return 'A'.repeat(Math.max(0, scoreA)) + 'B'.repeat(Math.max(0, scoreB));
}

export interface ServeState {
  side: Side;
  /** The server's service court: right on an even score, left on an odd one. */
  court: 'right' | 'left';
}

/**
 * Who serves next and from which service court. The side that won the last rally serves, from the
 * right court when its score is even and the left when odd. At 0–0 it's whoever was picked to serve
 * first. Unknown (null) when nobody picked at 0–0, or when every point so far was typed in.
 */
export function serveState(log: string, firstServe: Side | null, typedPoints = 0): ServeState | null {
  const side = log.length > typedPoints ? (log[log.length - 1] as Side) : log.length === 0 ? firstServe : null;
  if (!side) return null;
  const { a, b } = scoresOf(log);
  return { side, court: (side === 'A' ? a : b) % 2 === 0 ? 'right' : 'left' };
}
