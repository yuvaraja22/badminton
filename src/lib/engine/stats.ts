import type { GameRecord, PlayerId } from '../types';
import { isCounted, margin, pairKey, partnerOf, scoreFor, sideOf, teamOf, otherSide, totalPoints, winnerSide } from './games';

export type NameOf = (id: PlayerId) => string;

export interface PlayerLine {
  playerId: PlayerId;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  winRate: number;
  /** Points scored per game. */
  ppg: number;
  /** Points conceded per game. */
  papg: number;
  /** Played enough games to be ranked among the leaders. */
  qualified: boolean;
}

export interface PairLine {
  /** Sorted alphabetically by display name. */
  pair: [PlayerId, PlayerId];
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  winRate: number;
}

export interface RelationLine {
  otherId: PlayerId;
  played: number;
  won: number;
  lost: number;
  diff: number;
  winRate: number;
}

interface Tally {
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
}

function emptyTally(): Tally {
  return { played: 0, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0 };
}

function addResult(t: Tally, won: boolean, pf: number, pa: number) {
  t.played += 1;
  if (won) t.won += 1;
  else t.lost += 1;
  t.pointsFor += pf;
  t.pointsAgainst += pa;
}

const byName = (nameOf: NameOf) => (a: PlayerId, b: PlayerId) =>
  nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: 'base' }) || a.localeCompare(b);

/**
 * Player standings. Ranked by win rate, then point difference, then wins, then name
 * (this reproduces the ordering in the original PDF reports). Players below `minGames`
 * (default: half the games of the busiest player) are listed after everyone who qualified.
 */
export function computeStandings(games: GameRecord[], nameOf: NameOf, opts: { minGames?: number } = {}): PlayerLine[] {
  const tallies = new Map<PlayerId, Tally>();
  const get = (p: PlayerId) => {
    let t = tallies.get(p);
    if (!t) tallies.set(p, (t = emptyTally()));
    return t;
  };
  for (const g of games) {
    if (!isCounted(g)) continue;
    const w = winnerSide(g);
    for (const side of ['A', 'B'] as const) {
      const [pf, pa] = scoreFor(g, side);
      for (const p of teamOf(g, side)) addResult(get(p), w === side, pf, pa);
    }
  }
  const lines: PlayerLine[] = [...tallies.entries()].map(([playerId, t]) => ({
    playerId,
    ...t,
    diff: t.pointsFor - t.pointsAgainst,
    winRate: t.played ? t.won / t.played : 0,
    ppg: t.played ? t.pointsFor / t.played : 0,
    papg: t.played ? t.pointsAgainst / t.played : 0,
    qualified: false,
  }));
  const maxPlayed = lines.reduce((m, l) => Math.max(m, l.played), 0);
  const minGames = opts.minGames ?? Math.ceil(maxPlayed / 2);
  for (const l of lines) l.qualified = l.played >= minGames;
  const names = byName(nameOf);
  lines.sort(
    (a, b) =>
      Number(b.qualified) - Number(a.qualified) ||
      b.winRate - a.winRate ||
      b.diff - a.diff ||
      b.won - a.won ||
      names(a.playerId, b.playerId),
  );
  return lines;
}

/** Partnership records, ranked by win rate, then point difference, then games played. */
export function computePartnerships(games: GameRecord[], nameOf: NameOf): PairLine[] {
  const tallies = new Map<string, { pair: [PlayerId, PlayerId]; t: Tally }>();
  const names = byName(nameOf);
  for (const g of games) {
    if (!isCounted(g)) continue;
    const w = winnerSide(g);
    for (const side of ['A', 'B'] as const) {
      const team = teamOf(g, side);
      if (team.length !== 2) continue; // singles have no partnership
      const key = pairKey(team[0], team[1]);
      let entry = tallies.get(key);
      if (!entry) {
        const pair = [...team].sort(names) as [PlayerId, PlayerId];
        tallies.set(key, (entry = { pair, t: emptyTally() }));
      }
      const [pf, pa] = scoreFor(g, side);
      addResult(entry.t, w === side, pf, pa);
    }
  }
  const lines: PairLine[] = [...tallies.values()].map(({ pair, t }) => ({
    pair,
    ...t,
    diff: t.pointsFor - t.pointsAgainst,
    winRate: t.played ? t.won / t.played : 0,
  }));
  const label = (l: PairLine) => `${nameOf(l.pair[0])} & ${nameOf(l.pair[1])}`;
  lines.sort((a, b) => b.winRate - a.winRate || b.diff - a.diff || b.played - a.played || label(a).localeCompare(label(b)));
  return lines;
}

function relationLines(map: Map<PlayerId, Tally>): RelationLine[] {
  return [...map.entries()]
    .map(([otherId, t]) => ({
      otherId,
      played: t.played,
      won: t.won,
      lost: t.lost,
      diff: t.pointsFor - t.pointsAgainst,
      winRate: t.played ? t.won / t.played : 0,
    }))
    .sort((a, b) => b.played - a.played || b.winRate - a.winRate || b.diff - a.diff);
}

/** A player's record alongside each partner. */
export function partnersOf(games: GameRecord[], pid: PlayerId): RelationLine[] {
  const map = new Map<PlayerId, Tally>();
  for (const g of games) {
    if (!isCounted(g)) continue;
    const side = sideOf(g, pid);
    if (!side) continue;
    const partner = partnerOf(g, pid);
    if (!partner) continue; // singles
    const [pf, pa] = scoreFor(g, side);
    if (!map.has(partner)) map.set(partner, emptyTally());
    addResult(map.get(partner)!, winnerSide(g) === side, pf, pa);
  }
  return relationLines(map);
}

/** A player's record against each opponent (both opponents in a game count). */
export function opponentsOf(games: GameRecord[], pid: PlayerId): RelationLine[] {
  const map = new Map<PlayerId, Tally>();
  for (const g of games) {
    if (!isCounted(g)) continue;
    const side = sideOf(g, pid);
    if (!side) continue;
    const [pf, pa] = scoreFor(g, side);
    for (const opp of teamOf(g, otherSide(side))) {
      if (!map.has(opp)) map.set(opp, emptyTally());
      addResult(map.get(opp)!, winnerSide(g) === side, pf, pa);
    }
  }
  return relationLines(map);
}

export interface HeadToHead {
  together: { played: number; won: number; lost: number; diff: number };
  /** From p1's point of view. */
  against: { played: number; p1Won: number; p2Won: number; diff: number };
  meetings: GameRecord[];
}

export function headToHead(games: GameRecord[], p1: PlayerId, p2: PlayerId): HeadToHead {
  const res: HeadToHead = {
    together: { played: 0, won: 0, lost: 0, diff: 0 },
    against: { played: 0, p1Won: 0, p2Won: 0, diff: 0 },
    meetings: [],
  };
  for (const g of games) {
    if (!isCounted(g)) continue;
    const s1 = sideOf(g, p1);
    const s2 = sideOf(g, p2);
    if (!s1 || !s2) continue;
    res.meetings.push(g);
    const [pf, pa] = scoreFor(g, s1);
    const p1Won = winnerSide(g) === s1;
    if (s1 === s2) {
      res.together.played += 1;
      if (p1Won) res.together.won += 1;
      else res.together.lost += 1;
      res.together.diff += pf - pa;
    } else {
      res.against.played += 1;
      if (p1Won) res.against.p1Won += 1;
      else res.against.p2Won += 1;
      res.against.diff += pf - pa;
    }
  }
  return res;
}

/** Closest completed game: smallest margin, then the highest-scoring (deuce) one, then the earliest. */
export function tightestGame(games: GameRecord[]): GameRecord | null {
  let best: GameRecord | null = null;
  for (const g of games) {
    if (!isCounted(g)) continue;
    if (
      !best ||
      margin(g) < margin(best) ||
      (margin(g) === margin(best) && totalPoints(g) > totalPoints(best))
    ) {
      best = g;
    }
  }
  return best;
}

/** Most recent results first ('W' / 'L'). Games must be in chronological order. */
export function recentForm(games: GameRecord[], pid: PlayerId, n = 10): ('W' | 'L')[] {
  const out: ('W' | 'L')[] = [];
  for (let i = games.length - 1; i >= 0 && out.length < n; i--) {
    const g = games[i];
    if (!isCounted(g)) continue;
    const side = sideOf(g, pid);
    if (!side) continue;
    out.push(winnerSide(g) === side ? 'W' : 'L');
  }
  return out;
}
