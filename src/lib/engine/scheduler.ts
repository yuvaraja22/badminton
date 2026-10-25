import type { Attendee, Lineup, Match, PlayerId, Team } from '../types';
import { hash32 } from '../rng';
import { pairKey } from './games';

/**
 * "Next match" scheduler (one court, doubles).
 *
 * planQueue() is a pure function of the session: every device re-runs it on each change, so any
 * edit (scores, swaps, levels, attendance, past matches) immediately re-plans what follows.
 *
 * 1. Fairness first: every available player earns an equal share of the 4 court slots per match
 *    (4 / N). owed = share − games played. The most-owed players must play; among equally-owed
 *    players, whoever has waited longest goes first. Resting players earn nothing; "catch up"
 *    windows credit a player for matches they missed as if they had been there.
 * 2. Then team quality: among the remaining equally-entitled players, every combination and all
 *    three possible team splits are scored, and the lowest cost wins (skill gap, repeat partners,
 *    repeat opponents, exact rematches, partners from recent sessions). Skill is the session level,
 *    or the player's rating when the caller passes `skills` (see sessionSkills in rating.ts).
 * 3. Deterministic tie-breaks (seeded by session + match number) so all phones agree.
 */

export interface PlannedMatch extends Lineup {
  number: number;
  levelA: number;
  levelB: number;
  /** true when this is the admin's manual lineup. */
  pinned: boolean;
}

export interface QueuePlan {
  upcoming: PlannedMatch[];
  /** First future point where everyone available is even (has had their fair share). */
  checkpoint: { afterMatch: number; games: number | null } | null;
  /** Everyone available is even right now. */
  evenNow: boolean;
  /** Why no match can be planned (e.g. fewer than 4 available players). */
  blocked: string | null;
  available: PlayerId[];
  /** Games played this session (including live and unfinished matches). */
  played: Record<PlayerId, number>;
  /** False when a manual lineup exists but no longer fits (someone is resting or left). */
  nextPickValid: boolean;
  /** How many alternatives "Shuffle" cycles through for the next match. */
  alternatives: number;
  /** Skill used for balancing each attendee (input.skills, else the session level). */
  skills: Record<PlayerId, number>;
}

export interface SchedulerInput {
  sessionId: string;
  attendees: Record<PlayerId, Attendee>;
  matches: Match[];
  nextPick: Lineup | null;
  shuffle: number;
  /** Partner counts from recent sessions (pairKey → games together), to vary pairs week to week. */
  recentPartners?: Record<string, number>;
  /** Skill on the level scale used for team balancing; defaults to each attendee's session level. */
  skills?: Record<PlayerId, number>;
}

/** Tuned with simulations of 5–9 player rosters (see scheduler.test.ts). */
const WEIGHTS = {
  /** Per match of waiting skipped: choosing someone who just played over someone who sat out. */
  wait: 20,
  /** Team level gap g costs levelGap·g + levelGapSq·g², so lopsided matches get expensive fast. */
  levelGap: 4,
  levelGapSq: 8,
  /** Repeat partners / opponents cost weight · (1 + 2 + … + times already together). */
  partner: 5,
  opponent: 1.5,
  rematch: 6,
  /** Per game the pair played together in the last few sessions: a gentle nudge toward new pairs. */
  recentPartner: 0.3,
};

/** Owed values closer than half a game are treated as equal. */
const TIE = 0.5 - 1e-6;
const SHUFFLE_POOL = 8;
/**
 * One-match lookahead: the best candidates are re-scored by what they leave for the next match.
 * As many candidates as fit the evaluation budget are re-scored (at least LOOKAHEAD_MIN).
 */
const LOOKAHEAD_MIN = 10;
const LOOKAHEAD_BUDGET = 40000;
const LOOKAHEAD_WEIGHT = 0.8;

interface State {
  share: Map<PlayerId, number>;
  played: Map<PlayerId, number>;
  lastPlayed: Map<PlayerId, number>;
  partner: Map<string, number>;
  opponent: Map<string, number>;
  matchups: Set<string>;
  lastNumber: number;
}

interface Candidate {
  teamA: Team;
  teamB: Team;
  cost: number;
  tie: number;
}

function emptyState(): State {
  return {
    share: new Map(),
    played: new Map(),
    lastPlayed: new Map(),
    partner: new Map(),
    opponent: new Map(),
    matchups: new Set(),
    lastNumber: 0,
  };
}

function cloneState(s: State): State {
  return {
    share: new Map(s.share),
    played: new Map(s.played),
    lastPlayed: new Map(s.lastPlayed),
    partner: new Map(s.partner),
    opponent: new Map(s.opponent),
    matchups: new Set(s.matchups),
    lastNumber: s.lastNumber,
  };
}

function bump<K>(map: Map<K, number>, key: K, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function matchupKey(a: Team, b: Team): string {
  const x = pairKey(a[0], a[1]);
  const y = pairKey(b[0], b[1]);
  return x < y ? `${x}~${y}` : `${y}~${x}`;
}

function poolOf(teamA: Team, teamB: Team, available: Iterable<PlayerId>): Set<PlayerId> {
  const pool = new Set(available);
  for (const p of [...teamA, ...teamB]) pool.add(p);
  return pool;
}

function applyMatch(state: State, teamA: Team, teamB: Team, number: number, pool: Set<PlayerId>) {
  for (const p of pool) bump(state.share, p, 4 / pool.size);
  for (const p of [...teamA, ...teamB]) {
    bump(state.played, p);
    state.lastPlayed.set(p, Math.max(state.lastPlayed.get(p) ?? 0, number));
  }
  bump(state.partner, pairKey(teamA[0], teamA[1]));
  bump(state.partner, pairKey(teamB[0], teamB[1]));
  for (const a of teamA) for (const b of teamB) bump(state.opponent, pairKey(a, b));
  state.matchups.add(matchupKey(teamA, teamB));
  state.lastNumber = Math.max(state.lastNumber, number);
}

function buildState(input: SchedulerInput): State {
  const state = emptyState();
  const sorted = [...input.matches].sort((a, b) => a.number - b.number);
  for (const m of sorted) {
    const pool = poolOf(m.teamA, m.teamB, m.available ?? []);
    // "Catch up": credit absent players for this match as if they had been in the pool.
    for (const [pid, att] of Object.entries(input.attendees)) {
      if (pool.has(pid)) continue;
      if (att.catchUp?.some((w) => m.number >= w.from && m.number <= w.to)) {
        bump(state.share, pid, 4 / (pool.size + 1));
      }
    }
    applyMatch(state, m.teamA, m.teamB, m.number, pool);
  }
  return state;
}

const tri = (n: number) => (n * (n + 1)) / 2;

function teamLevel(team: Team, levels: Record<PlayerId, number>): number {
  return (levels[team[0]] ?? 3) + (levels[team[1]] ?? 3);
}

function lineupCost(
  state: State,
  teamA: Team,
  teamB: Team,
  levels: Record<PlayerId, number>,
  recent: Record<string, number> | undefined,
): number {
  const gap = Math.abs(teamLevel(teamA, levels) - teamLevel(teamB, levels));
  let cost = WEIGHTS.levelGap * gap + WEIGHTS.levelGapSq * gap * gap;
  const ka = pairKey(teamA[0], teamA[1]);
  const kb = pairKey(teamB[0], teamB[1]);
  cost += WEIGHTS.partner * (tri(state.partner.get(ka) ?? 0) + tri(state.partner.get(kb) ?? 0));
  for (const a of teamA) for (const b of teamB) cost += WEIGHTS.opponent * tri(state.opponent.get(pairKey(a, b)) ?? 0);
  if (state.matchups.has(matchupKey(teamA, teamB))) cost += WEIGHTS.rematch;
  if (recent) cost += WEIGHTS.recentPartner * ((recent[ka] ?? 0) + (recent[kb] ?? 0));
  return cost;
}

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const pick: T[] = [];
  const walk = (start: number) => {
    if (pick.length === k) {
      out.push([...pick]);
      return;
    }
    for (let i = start; i <= items.length - (k - pick.length); i++) {
      pick.push(items[i]);
      walk(i + 1);
      pick.pop();
    }
  };
  walk(0);
  return out;
}

function splits(four: PlayerId[]): [Team, Team][] {
  const [a, b, c, d] = four;
  return [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ];
}

/**
 * Fairness: players clearly owed more than the rest must play; the remaining slots are filled from
 * the equally-owed pool. Waiting longest is a strong preference within the pool (see WEIGHTS.wait)
 * rather than a hard rule, so that e.g. eight players don't lock into two fixed groups of four.
 */
function eligible(
  state: State,
  avail: PlayerId[],
  number: number,
): { fixed: PlayerId[]; pool: PlayerId[]; need: number; waited: Map<PlayerId, number> } {
  const accrual = 4 / avail.length;
  const info = avail.map((p) => ({
    p,
    owed: (state.share.get(p) ?? 0) + accrual - (state.played.get(p) ?? 0),
    waited: number - 1 - (state.lastPlayed.get(p) ?? 0),
  }));
  info.sort((x, y) => y.owed - x.owed || y.waited - x.waited || (x.p < y.p ? -1 : 1));
  const threshold = info[3].owed;
  const fixed = info.filter((x) => x.owed > threshold + TIE).map((x) => x.p);
  const pool = info.filter((x) => x.owed <= threshold + TIE && x.owed >= threshold - TIE).map((x) => x.p);
  return { fixed, pool, need: 4 - fixed.length, waited: new Map(info.map((x) => [x.p, x.waited])) };
}

function rankCandidates(
  state: State,
  avail: PlayerId[],
  levels: Record<PlayerId, number>,
  number: number,
  input: SchedulerInput,
): Candidate[] {
  const { fixed, pool, need, waited } = eligible(state, avail, number);
  // Penalty for picking players who have waited less than the longest-waiting ones.
  const bestWaitSum = pool
    .map((p) => waited.get(p) ?? 0)
    .sort((a, b) => b - a)
    .slice(0, need)
    .reduce((s, w) => s + w, 0);
  const candidates: Candidate[] = [];
  for (const combo of combinations(pool, need)) {
    const waitPenalty = WEIGHTS.wait * (bestWaitSum - combo.reduce((s, p) => s + (waited.get(p) ?? 0), 0));
    for (const [teamA, teamB] of splits([...fixed, ...combo])) {
      candidates.push({
        teamA,
        teamB,
        cost: waitPenalty + lineupCost(state, teamA, teamB, levels, input.recentPartners),
        tie: hash32(`${input.sessionId}:${number}:${matchupKey(teamA, teamB)}`),
      });
    }
  }
  candidates.sort((x, y) => x.cost - y.cost || x.tie - y.tie);
  return candidates;
}

/**
 * Greedy choices can leave a lopsided match for later (e.g. with 8 players the four who sit out
 * are forced to play next). Re-score the best few candidates by what they leave behind.
 */
function chooseCandidates(
  state: State,
  avail: PlayerId[],
  levels: Record<PlayerId, number>,
  number: number,
  input: SchedulerInput,
): Candidate[] {
  const ranked = rankCandidates(state, avail, levels, number, input);
  let k = LOOKAHEAD_MIN;
  const head: (Candidate & { total: number })[] = [];
  for (let i = 0; i < ranked.length && i < k; i++) {
    const c = ranked[i];
    const next = cloneState(state);
    applyMatch(next, c.teamA, c.teamB, number, poolOf(c.teamA, c.teamB, avail));
    const follow = rankCandidates(next, avail, levels, number + 1, input);
    if (i === 0) k = Math.max(LOOKAHEAD_MIN, Math.floor(LOOKAHEAD_BUDGET / Math.max(1, follow.length)));
    head.push({ ...c, total: c.cost + LOOKAHEAD_WEIGHT * (follow[0]?.cost ?? 0) });
  }
  head.sort((x, y) => x.total - y.total || x.tie - y.tie);
  return [...head, ...ranked.slice(head.length)];
}

function orderTeam(team: Team, levels: Record<PlayerId, number>): Team {
  const [a, b] = team;
  return (levels[b] ?? 0) > (levels[a] ?? 0) ? [b, a] : [a, b];
}

function toPlanned(lineup: Lineup, number: number, levels: Record<PlayerId, number>, pinned: boolean): PlannedMatch {
  const teamA = pinned ? lineup.teamA : orderTeam(lineup.teamA, levels);
  const teamB = pinned ? lineup.teamB : orderTeam(lineup.teamB, levels);
  return { teamA, teamB, number, pinned, levelA: teamLevel(teamA, levels), levelB: teamLevel(teamB, levels) };
}

function isEven(state: State, avail: PlayerId[]): boolean {
  const owed = avail.map((p) => (state.share.get(p) ?? 0) - (state.played.get(p) ?? 0));
  return Math.max(...owed) - Math.min(...owed) < TIE;
}

function commonPlayed(state: State, avail: PlayerId[]): number | null {
  const counts = new Set(avail.map((p) => state.played.get(p) ?? 0));
  return counts.size === 1 ? [...counts][0] : null;
}

function isValidLineup(lineup: Lineup, allowed: Iterable<PlayerId>): boolean {
  const ids = [...lineup.teamA, ...lineup.teamB];
  const ok = new Set(allowed);
  return new Set(ids).size === 4 && ids.every((id) => ok.has(id));
}

/**
 * The next `count` matches. With `checkpoint` (the default) it also looks further ahead for the next
 * point where everyone is even; without it, it stops after `count` matches (the plan is the same).
 */
export function planQueue(input: SchedulerInput, count = 4, { checkpoint = true }: { checkpoint?: boolean } = {}): QueuePlan {
  const state = buildState(input);
  const available = Object.entries(input.attendees)
    .filter(([, a]) => a.status === 'available')
    .map(([id]) => id)
    .sort();
  const levels: Record<PlayerId, number> = {};
  const played: Record<PlayerId, number> = {};
  for (const [id, a] of Object.entries(input.attendees)) {
    levels[id] = input.skills?.[id] ?? a.level;
    played[id] = state.played.get(id) ?? 0;
  }

  const plan: QueuePlan = {
    upcoming: [],
    checkpoint: null,
    evenNow: false,
    blocked: null,
    available,
    played,
    nextPickValid: input.nextPick ? isValidLineup(input.nextPick, available) : true,
    alternatives: 0,
    skills: levels,
  };
  if (available.length < 4) {
    plan.blocked = `Need at least 4 available players to plan a match (${available.length} available).`;
    return plan;
  }
  plan.evenNow = state.lastNumber > 0 && isEven(state, available);

  const sim = cloneState(state);
  const lookahead = checkpoint ? Math.max(count, Math.min(2 * available.length, 24)) : count;
  let number = state.lastNumber + 1;
  for (let i = 0; i < lookahead; i++) {
    let chosen: PlannedMatch;
    if (i === 0 && input.nextPick && plan.nextPickValid) {
      chosen = toPlanned(input.nextPick, number, levels, true);
    } else {
      const candidates = chooseCandidates(sim, available, levels, number, input);
      let index = 0;
      if (i === 0) {
        plan.alternatives = Math.min(SHUFFLE_POOL, candidates.length);
        index = ((input.shuffle % plan.alternatives) + plan.alternatives) % plan.alternatives;
      }
      chosen = toPlanned(candidates[index], number, levels, false);
    }
    if (i < count) plan.upcoming.push(chosen);
    applyMatch(sim, chosen.teamA, chosen.teamB, number, poolOf(chosen.teamA, chosen.teamB, available));
    if (!plan.checkpoint && isEven(sim, available)) {
      plan.checkpoint = { afterMatch: number, games: commonPlayed(sim, available) };
    }
    if (i >= count - 1 && plan.checkpoint) break;
    number += 1;
  }
  return plan;
}

/** Partner counts from recent sessions, used to vary pairs from week to week. */
export function recentPartnerCounts(sessions: { m: { a: readonly PlayerId[]; b: readonly PlayerId[] }[] }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions) {
    for (const m of s.m) {
      for (const team of [m.a, m.b]) {
        if (team.length !== 2) continue;
        const k = pairKey(team[0], team[1]);
        out[k] = (out[k] ?? 0) + 1;
      }
    }
  }
  return out;
}
