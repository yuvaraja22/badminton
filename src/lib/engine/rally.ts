import type { PlayerId, TeamKey } from '../types';
import { matchCode } from '../format';
import { gameState, scoresOf, type Side } from './scoring';

/**
 * Point-by-point stats from the live scorer's log (one letter per point), for tournament matches and
 * session matches alike. Matches whose score was typed in have no log and are left out.
 */

/** A game as the rally stats see it: a tournament match or a session match, with its own rules. */
export interface RallyGame {
  id: string;
  /** Its number in the schedule or the session (shown as M01…). */
  order: number;
  a: PlayerId[];
  b: PlayerId[];
  log: string;
  typedPoints: number;
  scoreA: number;
  scoreB: number;
  /** Only 'completed' games count. */
  status: string;
  pointsToWin: number;
  maxPoints: number;
}

/** What each side is called: a tournament's team names, or Team 1 / Team 2 in a session. */
export type SideName = (k: TeamKey) => string;

/** A score as [Team A, Team B]. */
export type Score = [number, number];

export interface Run {
  team: TeamKey;
  length: number;
  from: Score;
  to: Score;
}

export interface MatchFlow {
  match: RallyGame;
  /** Team A's lead at 0–0 and after every point (negative while Team B is ahead). */
  leads: number[];
  winner: TeamKey | null;
  longestRun: Run | null;
  /** Each team's biggest lead, and the score when they had it. */
  maxLead: Record<TeamKey, { lead: number; at: Score }>;
  /** How often the lead passed from one team to the other. */
  leadChanges: number;
  /** How often the score was level after 0–0. */
  ties: number;
  /** The winner's biggest deficit (null when they were never behind). */
  comeback: { down: number; at: Score } | null;
  /** Game points each team saved: the other side was one point from winning and lost the rally. */
  saved: Record<TeamKey, number>;
  deuce: boolean;
  /** Who reached the halfway mark (11 in a game to 21) first, and the score then. */
  firstToHalf: TeamKey | null;
  halfAt: Score | null;
  /** Each team's runs of 3 or more points in a row. */
  runs: Record<TeamKey, number>;
}

/** A run worth counting: this many points in a row or more. */
export const RUN_MIN = 3;

const key = (s: Side): TeamKey => (s === 'A' ? 'a' : 'b');
const other = (k: TeamKey): TeamKey => (k === 'a' ? 'b' : 'a');

/** Whether a match has a complete point-by-point log. */
export function hasRallyLog(m: Pick<RallyGame, 'log' | 'typedPoints' | 'scoreA' | 'scoreB'>): boolean {
  if (!m.log || m.typedPoints > 0) return false;
  const { a, b } = scoresOf(m.log);
  return a === m.scoreA && b === m.scoreB;
}

export function matchFlow(m: RallyGame): MatchFlow | null {
  if (!hasRallyLog(m)) return null;
  const { pointsToWin, maxPoints } = m;
  const half = Math.ceil(pointsToWin / 2);
  let a = 0;
  let b = 0;
  const leads = [0];
  const maxLead: MatchFlow['maxLead'] = { a: { lead: 0, at: [0, 0] }, b: { lead: 0, at: [0, 0] } };
  const saved = { a: 0, b: 0 };
  let longestRun: Run | null = null;
  let runTeam: TeamKey | null = null;
  let runLength = 0;
  let runFrom: Score = [0, 0];
  let leader: TeamKey | null = null;
  let leadChanges = 0;
  let ties = 0;
  let deuce = false;
  let firstToHalf: TeamKey | null = null;
  let halfAt: Score | null = null;
  const runs = { a: 0, b: 0 };

  for (const c of m.log) {
    const side = c as Side;
    const won = key(side);
    // A game point the other side had and lost.
    if (gameState(a, b, pointsToWin, maxPoints).gamePoint.some((s) => key(s) !== won)) saved[won] += 1;
    if (side === 'A') a += 1;
    else b += 1;
    const score: Score = [a, b];
    leads.push(a - b);

    if (runTeam === won) runLength += 1;
    else [runTeam, runLength, runFrom] = [won, 1, won === 'a' ? [a - 1, b] : [a, b - 1]];
    if (runLength === RUN_MIN) runs[won] += 1;
    if (!longestRun || runLength > longestRun.length) longestRun = { team: won, length: runLength, from: runFrom, to: score };

    const now: TeamKey | null = a > b ? 'a' : b > a ? 'b' : null;
    if (now === null) ties += 1;
    else {
      if (leader && now !== leader) leadChanges += 1;
      leader = now;
      if (Math.abs(a - b) > maxLead[now].lead) maxLead[now] = { lead: Math.abs(a - b), at: score };
    }
    if (gameState(a, b, pointsToWin, maxPoints).deuce) deuce = true;
    if (!firstToHalf && (a === half || b === half)) {
      firstToHalf = a === half ? 'a' : 'b';
      halfAt = score;
    }
  }

  const winner: TeamKey | null = m.status === 'completed' && a !== b ? (a > b ? 'a' : 'b') : null;
  const behind = winner ? maxLead[other(winner)] : null;
  return {
    match: m,
    leads,
    winner,
    longestRun,
    maxLead,
    leadChanges,
    ties,
    comeback: behind && behind.lead > 0 ? { down: behind.lead, at: behind.at } : null,
    saved,
    deuce,
    firstToHalf,
    halfAt,
    runs,
  };
}

export interface TeamRally {
  points: number;
  longestRun: number;
  biggestLead: number;
  gamePointsSaved: number;
  /** Matches won after trailing by 3 or more. */
  comebackWins: number;
  /** Matches where this team reached the halfway mark first, and how many of those it won. */
  firstToHalf: number;
  firstToHalfWon: number;
}

export interface RallySummary {
  /** Finished matches with a point-by-point log, in schedule order. */
  flows: MatchFlow[];
  /** Finished matches whose score was typed in (no point-by-point data). */
  typedIn: RallyGame[];
  teams: Record<TeamKey, TeamRally>;
}

export const COMEBACK_MIN = 3;

/** Every finished game's flow, in the order given (schedule or match order). */
export function rallySummary(games: RallyGame[]): RallySummary {
  const done = games.filter((m) => m.status === 'completed');
  const flows: MatchFlow[] = [];
  const typedIn: RallyGame[] = [];
  for (const m of done) {
    const f = matchFlow(m);
    if (f) flows.push(f);
    else typedIn.push(m);
  }
  const blank = (): TeamRally => ({ points: 0, longestRun: 0, biggestLead: 0, gamePointsSaved: 0, comebackWins: 0, firstToHalf: 0, firstToHalfWon: 0 });
  const teams = { a: blank(), b: blank() };
  for (const f of flows) {
    for (const k of ['a', 'b'] as const) {
      const tr = teams[k];
      tr.points += k === 'a' ? f.match.scoreA : f.match.scoreB;
      tr.biggestLead = Math.max(tr.biggestLead, f.maxLead[k].lead);
      tr.gamePointsSaved += f.saved[k];
    }
    for (const k of ['a', 'b'] as const) teams[k].longestRun = Math.max(teams[k].longestRun, longestRunOf(f, k));
    if (f.winner && f.comeback && f.comeback.down >= COMEBACK_MIN) teams[f.winner].comebackWins += 1;
    if (f.firstToHalf) {
      teams[f.firstToHalf].firstToHalf += 1;
      if (f.winner === f.firstToHalf) teams[f.firstToHalf].firstToHalfWon += 1;
    }
  }
  return { flows, typedIn, teams };
}

/** A team's longest run of points in one match. */
export function longestRunOf(f: MatchFlow, team: TeamKey): number {
  let best = 0;
  let cur = 0;
  for (const c of f.match.log) {
    cur = key(c as Side) === team ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

export interface Highlight {
  label: string;
  value: string;
  detail: string;
}

const code = (m: RallyGame) => matchCode(m.order);
const score = (s: Score) => `${s[0]}–${s[1]}`;

/** The headline point-by-point facts, worded for the Results tab and the PDF. */
export function rallyHighlights(r: RallySummary, sideName: SideName, nameOf: (id: PlayerId) => string): Highlight[] {
  const out: Highlight[] = [];
  const { flows } = r;
  if (!flows.length) return out;
  const who = (f: MatchFlow, k: TeamKey) => `${sideName(k)} (${f.match[k].map(nameOf).join(' & ')})`;
  const final = (f: MatchFlow) => `${f.match.scoreA}–${f.match.scoreB}`;

  const run = flows.filter((f) => f.longestRun).sort((x, y) => y.longestRun!.length - x.longestRun!.length)[0];
  if (run?.longestRun) {
    const lr = run.longestRun;
    out.push({ label: 'Longest run', value: `${lr.length} points in a row`, detail: `${who(run, lr.team)} in ${code(run.match)}, ${score(lr.from)} to ${score(lr.to)}` });
  }

  const back = flows.filter((f) => f.comeback).sort((x, y) => y.comeback!.down - x.comeback!.down)[0];
  if (back?.comeback && back.winner) {
    const at = back.comeback.at;
    const [mine, theirs] = back.winner === 'a' ? [at[0], at[1]] : [at[1], at[0]];
    out.push({
      label: 'Biggest comeback',
      value: `From ${back.comeback.down} down`,
      detail: `${who(back, back.winner)} trailed ${mine}–${theirs} and won ${code(back.match)} ${final(back)}`,
    });
  }

  const swing = [...flows].sort((x, y) => y.ties - x.ties || y.leadChanges - x.leadChanges)[0];
  if (swing && swing.ties > 0) {
    out.push({
      label: 'Most back-and-forth',
      value: `Level ${swing.ties} time${swing.ties === 1 ? '' : 's'}`,
      detail: `${code(swing.match)}: the lead changed hands ${swing.leadChanges} time${swing.leadChanges === 1 ? '' : 's'}, finished ${final(swing)}`,
    });
  }

  const savedBest = flows
    .flatMap((f) => (['a', 'b'] as const).map((k) => ({ f, k, n: f.saved[k] })))
    .sort((x, y) => y.n - x.n)[0];
  if (savedBest && savedBest.n > 0) {
    const won = savedBest.f.winner === savedBest.k;
    out.push({
      label: 'Game points saved',
      value: `${savedBest.n} saved`,
      detail: `${who(savedBest.f, savedBest.k)} in ${code(savedBest.f.match)}${won ? ', and went on to win' : ''}`,
    });
  }

  const halves = flows.filter((f) => f.firstToHalf && f.winner);
  if (halves.length >= 3) {
    const targets = new Set(halves.map((f) => f.match.pointsToWin));
    const half = targets.size === 1 ? String(Math.ceil([...targets][0] / 2)) : 'halfway';
    const won = halves.filter((f) => f.winner === f.firstToHalf).length;
    out.push({ label: `First to ${half}`, value: `Won ${won} of ${halves.length}`, detail: `The side that reached ${half} first went on to win ${won} of ${halves.length} matches.` });
  }

  const deuces = flows.filter((f) => f.deuce);
  const longest = [...flows].sort((x, y) => y.match.log.length - x.match.log.length)[0];
  if (deuces.length) {
    out.push({ label: 'Deuce games', value: String(deuces.length), detail: deuces.map((f) => `${code(f.match)} ${final(f)}`).join(', ') });
  } else if (longest) {
    out.push({ label: 'Longest game', value: `${longest.match.log.length} points`, detail: `${code(longest.match)}, ${final(longest)}` });
  }
  return out;
}
