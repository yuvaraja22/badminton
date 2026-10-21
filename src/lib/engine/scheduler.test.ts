import { describe, expect, it } from 'vitest';
import type { Attendee, Match, PlayerId } from '../types';
import { pairKey } from './games';
import { planQueue, type SchedulerInput } from './scheduler';

function attendee(level = 3, extra: Partial<Attendee> = {}): Attendee {
  return { level, status: 'available', since: 0, catchUp: [], order: 0, ...extra };
}

function session(levels: Record<PlayerId, number>): SchedulerInput {
  return {
    sessionId: 'test-session',
    attendees: Object.fromEntries(Object.entries(levels).map(([id, level], i) => [id, attendee(level, { order: i })])),
    matches: [],
    nextPick: null,
    shuffle: 0,
  };
}

function equalLevels(n: number, level = 3): Record<PlayerId, number> {
  return Object.fromEntries(Array.from({ length: n }, (_, i) => [`P${i + 1}`, level]));
}

function availableIds(input: SchedulerInput): PlayerId[] {
  return Object.entries(input.attendees)
    .filter(([, a]) => a.status === 'available')
    .map(([id]) => id);
}

/** Start the suggested next match and record a result. */
function playNext(input: SchedulerInput): Match {
  const next = planQueue(input, 1).upcoming[0];
  const m: Match = {
    id: `m${next.number}`,
    number: next.number,
    teamA: next.teamA,
    teamB: next.teamB,
    scoreA: 21,
    scoreB: 17,
    status: 'completed',
    available: availableIds(input),
  };
  input.matches.push(m);
  input.nextPick = null;
  input.shuffle = 0;
  return m;
}

function playedCounts(input: SchedulerInput): Record<PlayerId, number> {
  const counts: Record<PlayerId, number> = Object.fromEntries(Object.keys(input.attendees).map((id) => [id, 0]));
  for (const m of input.matches) for (const p of [...m.teamA, ...m.teamB]) counts[p] += 1;
  return counts;
}

function partnerCounts(matches: Match[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of matches) {
    for (const t of [m.teamA, m.teamB]) out.set(pairKey(t[0], t[1]), (out.get(pairKey(t[0], t[1])) ?? 0) + 1);
  }
  return out;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

describe('fair rotation with a fixed roster', () => {
  for (const n of [4, 5, 6, 7, 8, 9, 10]) {
    it(`${n} players: games never differ by more than one, and evens out on schedule`, () => {
      const input = session(equalLevels(n));
      const ids = Object.keys(input.attendees);
      const cycle = n / gcd(n, 4);
      const sitOutStreak: Record<PlayerId, number> = Object.fromEntries(ids.map((id) => [id, 0]));
      let worstStreak = 0;
      for (let k = 1; k <= Math.max(3 * cycle, 12); k++) {
        const m = playNext(input);
        const counts = Object.values(playedCounts(input));
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        if (k % cycle === 0) expect(new Set(counts).size).toBe(1);
        const onCourt = new Set([...m.teamA, ...m.teamB]);
        for (const id of ids) {
          sitOutStreak[id] = onCourt.has(id) ? 0 : sitOutStreak[id] + 1;
          worstStreak = Math.max(worstStreak, sitOutStreak[id]);
        }
      }
      // Up to 7 players nobody ever sits out twice in a row. From 8 players a double sit-out is
      // allowed so the two halves of the group mix instead of alternating as fixed foursomes.
      expect(worstStreak).toBeLessThanOrEqual(n <= 7 ? 1 : 2);
    });
  }

  it('varies partners when everyone has the same level', () => {
    const input = session(equalLevels(5));
    for (let k = 0; k < 10; k++) playNext(input);
    const counts = partnerCounts(input.matches);
    expect(counts.size).toBe(10); // every possible pair partnered at least once
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);

    const six = session(equalLevels(6));
    for (let k = 0; k < 12; k++) playNext(six);
    const sixCounts = partnerCounts(six.matches);
    expect(Math.max(...sixCounts.values())).toBeLessThanOrEqual(2);
    expect(sixCounts.size).toBeGreaterThanOrEqual(12);
  });

  it('balances teams by level', () => {
    const input = session({ Vikram: 5, Sridhar: 4.5, Anu: 4, Shashwin: 3, Hardesh: 3, Yuva: 3.5 });
    let totalGap = 0;
    for (let k = 0; k < 12; k++) {
      const next = planQueue(input, 1).upcoming[0];
      const gap = Math.abs(next.levelA - next.levelB);
      expect(gap).toBeLessThanOrEqual(1.5);
      totalGap += gap;
      playNext(input);
    }
    expect(totalGap / 12).toBeLessThanOrEqual(0.75);
    // The strongest players are not stuck together.
    expect(partnerCounts(input.matches).get(pairKey('Vikram', 'Sridhar')) ?? 0).toBeLessThanOrEqual(1);
  });

  it('balances by rating-based skills when given, instead of session levels', () => {
    const input = session(equalLevels(4));
    input.skills = { P1: 4.6, P2: 4.4, P3: 2.4, P4: 2.6 };
    const next = planQueue(input, 1).upcoming[0];
    // The two strongest are split up, and the reported team strengths use the skills.
    expect(next.teamA.includes('P1')).not.toBe(next.teamA.includes('P2'));
    expect(Math.abs(next.levelA - next.levelB)).toBeLessThanOrEqual(0.4 + 1e-9);
    expect(next.levelA + next.levelB).toBeCloseTo(14);
  });

  it('keeps five mixed-level players reasonably balanced', () => {
    const input = session({ Vikram: 5, Yuva: 4, Shashwin: 3.5, Anu: 3, Sridhar: 3 });
    for (let k = 0; k < 10; k++) {
      const next = planQueue(input, 1).upcoming[0];
      // With Yuva sitting out, 5 + 3.5 + 3 + 3 cannot split better than 8 vs 6.5.
      expect(Math.abs(next.levelA - next.levelB)).toBeLessThanOrEqual(1.5);
      playNext(input);
    }
  });

  it('eight players mix instead of alternating as two fixed foursomes', () => {
    const input = session({ A: 5, B: 4.5, C: 4, D: 3.5, E: 3, F: 2.5, G: 2, H: 1.5 });
    const met = new Set<string>();
    for (let k = 0; k < 16; k++) {
      const next = planQueue(input, 1).upcoming[0];
      expect(Math.abs(next.levelA - next.levelB)).toBeLessThanOrEqual(1);
      const m = playNext(input);
      const four = [...m.teamA, ...m.teamB];
      for (const a of four) for (const b of four) if (a < b) met.add(`${a}|${b}`);
    }
    expect(met.size).toBeGreaterThanOrEqual(24); // of 28 possible pairs of players
  });

  it('is deterministic', () => {
    const a = session(equalLevels(7));
    const b = session(equalLevels(7));
    for (let k = 0; k < 10; k++) {
      expect(playNext(a)).toEqual(playNext(b));
    }
  });

  it('reports the next equal-games checkpoint', () => {
    const five = session(equalLevels(5));
    expect(planQueue(five).checkpoint).toEqual({ afterMatch: 5, games: 4 });
    const six = session(equalLevels(6));
    expect(planQueue(six).checkpoint).toEqual({ afterMatch: 3, games: 2 });
    playNext(six);
    expect(planQueue(six).checkpoint).toEqual({ afterMatch: 3, games: 2 });
    playNext(six);
    playNext(six);
    const plan = planQueue(six);
    expect(plan.evenNow).toBe(true);
    expect(plan.checkpoint).toEqual({ afterMatch: 6, games: 4 });
  });
});

describe('roster changes re-plan the queue', () => {
  it('a late arrival who joins fairly gets an equal share from then on (no catch-up streak)', () => {
    const input = session(equalLevels(5));
    for (let k = 0; k < 5; k++) playNext(input);
    input.attendees.NEW = attendee(3, { since: 5 });
    const before = playedCounts(input);
    let firstGame = -1;
    for (let k = 0; k < 6; k++) {
      const m = playNext(input);
      if (firstGame < 0 && [...m.teamA, ...m.teamB].includes('NEW')) firstGame = k;
    }
    const after = playedCounts(input);
    expect(firstGame).toBeGreaterThanOrEqual(0);
    expect(firstGame).toBeLessThanOrEqual(1);
    expect(after.NEW).toBe(4); // 6 matches × 4 slots ÷ 6 players
    for (const id of Object.keys(before)) expect(after[id] - before[id]).toBe(4);
  });

  it('a late arrival who catches up plays straight away until level with the others', () => {
    const input = session(equalLevels(5));
    for (let k = 0; k < 5; k++) playNext(input);
    input.attendees.NEW = attendee(3, { since: 5, catchUp: [{ from: 1, to: 5 }] });
    const streak = [0, 1, 2].map(() => {
      const m = playNext(input);
      return [...m.teamA, ...m.teamB].includes('NEW');
    });
    expect(streak).toEqual([true, true, true]);
  });

  it('resting players are skipped, and returning fairly does not jump the queue', () => {
    const fair = session(equalLevels(6));
    for (let k = 0; k < 3; k++) playNext(fair);
    fair.attendees.P1.status = 'resting';
    for (let k = 0; k < 3; k++) {
      const m = playNext(fair);
      expect([...m.teamA, ...m.teamB]).not.toContain('P1');
    }
    fair.attendees.P1 = { ...fair.attendees.P1, status: 'available', since: 6 };
    const catchUp = structuredClone(fair);
    catchUp.attendees.P1.catchUp = [{ from: 4, to: 6 }];

    const gamesFor = (input: SchedulerInput) => {
      let g = 0;
      for (let k = 0; k < 6; k++) {
        const m = playNext(input);
        if ([...m.teamA, ...m.teamB].includes('P1')) g += 1;
      }
      return g;
    };
    const fairGames = gamesFor(fair);
    const catchUpGames = gamesFor(catchUp);
    expect(catchUpGames).toBeGreaterThan(fairGames);
  });

  it('players who left are never scheduled', () => {
    const input = session(equalLevels(6));
    input.attendees.P3.status = 'left';
    const plan = planQueue(input, 4);
    for (const m of plan.upcoming) expect([...m.teamA, ...m.teamB]).not.toContain('P3');
  });

  it('editing a past match changes who is owed the next game', () => {
    const input = session(equalLevels(5));
    const m1 = playNext(input);
    const sat = Object.keys(input.attendees).find((id) => ![...m1.teamA, ...m1.teamB].includes(id))!;
    const planned = planQueue(input, 1).upcoming[0];
    expect([...planned.teamA, ...planned.teamB]).toContain(sat);

    // Correct M1: the player who "sat out" actually played instead of someone else.
    const swappedOut = m1.teamB[1];
    input.matches[0] = { ...m1, teamB: [m1.teamB[0], sat] };
    const next = planQueue(input, 1).upcoming[0];
    expect([...next.teamA, ...next.teamB]).toContain(swappedOut);
  });

  it('honours a manual lineup and ignores it once someone is unavailable', () => {
    const input = session(equalLevels(6));
    input.nextPick = { teamA: ['P1', 'P2'], teamB: ['P3', 'P4'] };
    const plan = planQueue(input, 3);
    expect(plan.upcoming[0]).toMatchObject({ teamA: ['P1', 'P2'], teamB: ['P3', 'P4'], pinned: true });
    expect(plan.nextPickValid).toBe(true);
    // P5 and P6 sat out the pinned match, so they must be in the one after it.
    expect([...plan.upcoming[1].teamA, ...plan.upcoming[1].teamB]).toEqual(expect.arrayContaining(['P5', 'P6']));

    input.attendees.P2.status = 'resting';
    const after = planQueue(input, 1);
    expect(after.nextPickValid).toBe(false);
    expect(after.upcoming[0].pinned).toBe(false);
  });

  it('shuffle offers a different lineup that is still fair', () => {
    const input = session(equalLevels(5));
    const m1 = playNext(input);
    const sat = Object.keys(input.attendees).find((id) => ![...m1.teamA, ...m1.teamB].includes(id))!;
    const first = planQueue(input, 1);
    input.shuffle = 1;
    const second = planQueue(input, 1);
    expect(first.alternatives).toBeGreaterThan(1);
    expect(second.upcoming[0]).not.toEqual(first.upcoming[0]);
    expect([...second.upcoming[0].teamA, ...second.upcoming[0].teamB]).toContain(sat);
  });

  it('needs at least four available players', () => {
    const input = session(equalLevels(4));
    input.attendees.P4.status = 'resting';
    const plan = planQueue(input);
    expect(plan.blocked).toMatch(/at least 4/);
    expect(plan.upcoming).toEqual([]);
  });
});
