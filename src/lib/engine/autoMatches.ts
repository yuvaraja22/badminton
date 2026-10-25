import type { MatchKind, PlayerId } from '../types';

/**
 * "Create matches" for a team tournament. Each team's players are ranked (best first) and matches pit
 * the same ranks against each other: A1 & A2 vs B1 & B2, A1 & A3 vs B1 & B3, then always the pair
 * that has played least (higher-ranked pairs first), so everyone's games stay level as the list goes on.
 * Singles are A1 vs B1, A2 vs B2… and are mixed in between the doubles so nobody plays twice in a row
 * where that can be avoided.
 */

export interface GeneratedMatch {
  kind: MatchKind;
  a: PlayerId[];
  b: PlayerId[];
}

type Pair = [number, number];

const pairKey = ([i, j]: Pair) => `${i}-${j}`;

/**
 * Doubles pairs for one team, by rank (0 = top): (0,1) and (0,2) open, then the unused pair whose two
 * players have played least, then the higher-ranked pair. When every pair has played, a new round starts.
 */
export function pairOrder(n: number, count: number): Pair[] {
  if (n < 2 || count <= 0) return [];
  const all: Pair[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) all.push([i, j]);
  const games = new Array<number>(n).fill(0);
  const out: Pair[] = [];
  let used = new Set<string>();
  while (out.length < count) {
    if (used.size === all.length) used = new Set();
    const opening: Pair | null = out.length === 0 ? [0, 1] : out.length === 1 && n >= 3 ? [0, 2] : null;
    const pick =
      opening && !used.has(pairKey(opening))
        ? opening
        : all
            .filter((p) => !used.has(pairKey(p)))
            .sort((x, y) => games[x[0]] + games[x[1]] - (games[y[0]] + games[y[1]]) || x[0] + x[1] - (y[0] + y[1]) || x[0] - y[0])[0];
    out.push(pick);
    used.add(pairKey(pick));
    games[pick[0]] += 1;
    games[pick[1]] += 1;
  }
  return out;
}

/** Singles by rank: A1 v B1, A2 v B2…, then the next round shifted by one (A1 v B2…). */
function singlesOrder(nA: number, nB: number, count: number): Pair[] {
  if (!nA || !nB) return [];
  return Array.from({ length: count }, (_, k) => {
    const round = Math.floor(k / nA);
    return [k % nA, (k + round) % nB] as Pair;
  });
}

/** Players in both games, so the next one can avoid them. */
const playersOf = (m: GeneratedMatch | undefined) => new Set(m ? [...m.a, ...m.b] : []);
const clashes = (m: GeneratedMatch, busy: Set<PlayerId>) => [...m.a, ...m.b].some((p) => busy.has(p));

/**
 * A player on both teams can't be on both sides of one match: swap in the least-used player from the
 * other side's list who isn't on court yet.
 */
function untangle(m: GeneratedMatch, teamB: PlayerId[], used: Map<PlayerId, number>): GeneratedMatch {
  if (!m.a.some((p) => m.b.includes(p))) return m;
  const b = [...m.b];
  for (let i = 0; i < b.length; i++) {
    if (!m.a.includes(b[i])) continue;
    const spare = teamB
      .filter((p) => !m.a.includes(p) && !b.includes(p))
      .sort((x, y) => (used.get(x) ?? 0) - (used.get(y) ?? 0) || teamB.indexOf(x) - teamB.indexOf(y))[0];
    if (spare) b[i] = spare;
  }
  return { ...m, b };
}

/**
 * The matches for two ranked teams: `doubles` doubles and `singles` singles, doubles first in each
 * pair of slots (M1 is always the top pairs' doubles when there are any).
 */
export function generateMatches(teamA: PlayerId[], teamB: PlayerId[], doubles: number, singles: number): GeneratedMatch[] {
  const used = new Map<PlayerId, number>();
  const count = (m: GeneratedMatch) => {
    for (const p of [...m.a, ...m.b]) used.set(p, (used.get(p) ?? 0) + 1);
    return m;
  };
  const pairsA = pairOrder(teamA.length, doubles);
  const pairsB = pairOrder(teamB.length, doubles);
  const d: GeneratedMatch[] = [];
  for (let k = 0; k < Math.min(pairsA.length, pairsB.length); k++) {
    const m = { kind: 'doubles' as const, a: pairsA[k].map((i) => teamA[i]), b: pairsB[k].map((i) => teamB[i]) };
    d.push(count(untangle(m, teamB, used)));
  }
  const s: GeneratedMatch[] = singlesOrder(teamA.length, teamB.length, singles).map(([i, j]) => count(untangle({ kind: 'singles', a: [teamA[i]], b: [teamB[j]] }, teamB, used)));
  return mixIn(d, s);
}

/** Players who'd play two matches in a row if `x` came right before `y`. */
function shared(x: GeneratedMatch | undefined, y: GeneratedMatch | undefined): number {
  if (!x || !y) return 0;
  const busy = playersOf(x);
  return [...y.a, ...y.b].filter((p) => busy.has(p)).length;
}

/** With this many singles or fewer, try every way of placing them; beyond it, place them one by one. */
const SEARCH_LIMIT = 9;

/**
 * Doubles in their order, alternating with singles (doubles first; whatever is left over goes at the
 * end). The singles go into their slots so that as few players as possible play twice in a row, and
 * otherwise in rank order.
 */
export function mixIn(doubles: GeneratedMatch[], singles: GeneratedMatch[]): GeneratedMatch[] {
  // The shape: D S D S … with the leftovers of either kind at the end.
  const slots: ('d' | 's')[] = [];
  for (let i = 0; i < Math.max(doubles.length, singles.length); i++) {
    if (i < doubles.length) slots.push('d');
    if (i < singles.length) slots.push('s');
  }
  const out: (GeneratedMatch | undefined)[] = [];
  let d = 0;
  for (const slot of slots) out.push(slot === 'd' ? doubles[d++] : undefined);
  const free = slots.flatMap((slot, i) => (slot === 's' ? [i] : []));

  if (singles.length <= SEARCH_LIMIT) {
    // Depth-first over the singles slots, keeping the arrangement with the fewest back-to-back players.
    let best: { cost: number; pick: number[] } | null = null;
    const used = new Array<boolean>(singles.length).fill(false);
    const pick: number[] = [];
    const walk = (k: number, cost: number) => {
      if (best && cost >= best.cost) return;
      if (k === free.length) {
        best = { cost, pick: [...pick] };
        return;
      }
      const at = free[k];
      for (let j = 0; j < singles.length; j++) {
        if (used[j]) continue;
        // Before it is a doubles or an already placed singles; after it, only a doubles is known yet.
        const after = slots[at + 1] === 'd' ? out[at + 1] : undefined;
        const c = shared(out[at - 1], singles[j]) + shared(singles[j], after);
        used[j] = true;
        pick.push(j);
        out[at] = singles[j];
        walk(k + 1, cost + c);
        out[at] = undefined;
        pick.pop();
        used[j] = false;
      }
    };
    walk(0, 0);
    const chosen = (best as { cost: number; pick: number[] } | null)?.pick ?? [];
    free.forEach((at, k) => (out[at] = singles[chosen[k]]));
  } else {
    const rest = [...singles];
    for (const at of free) {
      const before = playersOf(out[at - 1]);
      const around = new Set([...before, ...playersOf(slots[at + 1] === 'd' ? out[at + 1] : undefined)]);
      let i = rest.findIndex((m) => !clashes(m, around));
      if (i < 0) i = rest.findIndex((m) => !clashes(m, before));
      out[at] = rest.splice(Math.max(0, i), 1)[0];
    }
  }
  return out as GeneratedMatch[];
}
