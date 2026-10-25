import type { HistorySession, PlayerId } from '../types';
import { historyGames, pairKey } from './games';
import type { GamePrediction } from './rating';

/**
 * How good the win chances are, and which partnerships beat them. Both use the chance the ratings
 * gave each game just before it was played (computeRatings' predictions).
 */

export interface CalibrationBucket {
  /** As worded next to a match: "Even match", "Slight edge", "One team stronger". */
  label: string;
  games: number;
  /** Games the favourite won. */
  won: number;
  /** The average chance the favourite was given. */
  expected: number;
}

export interface Calibration {
  games: number;
  favouriteWon: number;
  buckets: CalibrationBucket[];
}

/** Win chances as shown (whole percentages): up to 57% even, 70% or more one team stronger (see levels.ts). */
const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: 'Even match', min: 50.5, max: 57.5 },
  { label: 'Slight edge', min: 57.5, max: 69.5 },
  { label: 'One team stronger', min: 69.5, max: 101 },
];

type Range = { from?: string; to?: string };
const inRange = (date: string | undefined, r: Range) => !!date && (!r.from || date >= r.from) && (!r.to || date <= r.to);

/** How often the team the ratings favoured actually won, overall and by how big a favourite it was. */
export function calibration(predictions: GamePrediction[], history: Record<string, HistorySession>, range: Range = {}): Calibration {
  const buckets = BUCKETS.map((b) => ({ ...b, games: 0, won: 0, sum: 0 }));
  let games = 0;
  let favouriteWon = 0;
  for (const p of predictions) {
    if (!inRange(history[p.sessionId]?.date, range)) continue;
    const fav = Math.max(p.pA, 1 - p.pA) * 100;
    const b = buckets.find((x) => fav >= x.min && fav < x.max);
    if (!b) continue; // a dead heat: nobody was favoured
    const won = p.pA > 0.5 ? p.aWon : !p.aWon;
    games += 1;
    b.games += 1;
    b.sum += fav / 100;
    if (won) {
      favouriteWon += 1;
      b.won += 1;
    }
  }
  return {
    games,
    favouriteWon,
    buckets: buckets.map(({ label, games: n, won, sum }) => ({ label, games: n, won, expected: n ? sum / n : 0 })),
  };
}

export interface PairSynergy {
  pair: [PlayerId, PlayerId];
  played: number;
  won: number;
  /** Wins the ratings expected from the games they played together (sum of their win chances). */
  expected: number;
  /** won − expected: above zero, they did better together than their ratings said. */
  above: number;
}

/** Each doubles pair's wins against what the ratings expected for those games (pairKey → synergy). */
export function pairSynergy(predictions: GamePrediction[], history: Record<string, HistorySession>, range: Range = {}): Map<string, PairSynergy> {
  const games = new Map<string, { a: PlayerId[]; b: PlayerId[] }>();
  const gameOf = (sessionId: string, n: number) => {
    const key = `${sessionId}#${n}`;
    if (!games.has(key)) {
      const h = history[sessionId];
      for (const g of h ? historyGames(sessionId, h) : []) games.set(`${sessionId}#${g.number}`, { a: g.teamA, b: g.teamB });
    }
    return games.get(key);
  };
  const out = new Map<string, PairSynergy>();
  const add = (team: PlayerId[], chance: number, won: boolean) => {
    if (team.length !== 2) return;
    const key = pairKey(team[0], team[1]);
    const s = out.get(key) ?? { pair: [...team].sort() as [PlayerId, PlayerId], played: 0, won: 0, expected: 0, above: 0 };
    s.played += 1;
    s.expected += chance;
    if (won) s.won += 1;
    s.above = s.won - s.expected;
    out.set(key, s);
  };
  for (const p of predictions) {
    if (!inRange(history[p.sessionId]?.date, range)) continue;
    const g = gameOf(p.sessionId, p.number);
    if (!g) continue;
    add(g.a, p.pA, p.aWon);
    add(g.b, 1 - p.pA, !p.aWon);
  }
  return out;
}
