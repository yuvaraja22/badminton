import { describe, expect, it } from 'vitest';
import { generateMatches, mixIn, pairOrder, type GeneratedMatch } from './autoMatches';

const A = ['A1', 'A2', 'A3', 'A4'];
const B = ['B1', 'B2', 'B3', 'B4'];
const label = (m: GeneratedMatch) => `${m.a.join('&')} v ${m.b.join('&')}`;

describe('doubles pairs by rank', () => {
  it('opens with the top pair, then #1 with #3, then keeps everyone even', () => {
    // The order agreed for four players a side.
    expect(pairOrder(4, 6)).toEqual([
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
      [0, 3],
      [1, 2],
    ]);
  });

  it('never lets anyone get two games ahead once the opening is done', () => {
    for (const n of [3, 4, 5, 6, 7]) {
      const games = new Array(n).fill(0);
      pairOrder(n, n * 3).forEach(([i, j], k) => {
        games[i] += 1;
        games[j] += 1;
        if (k >= 2) expect(Math.max(...games) - Math.min(...games)).toBeLessThanOrEqual(2);
      });
    }
  });

  it('uses every pair once before repeating any', () => {
    const pairs = pairOrder(5, 10).map(([i, j]) => `${i}-${j}`);
    expect(new Set(pairs).size).toBe(10);
    expect(pairOrder(3, 4)).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
  });

  it('copes with tiny teams', () => {
    expect(pairOrder(1, 3)).toEqual([]);
    expect(pairOrder(2, 2)).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });
});

describe('the whole list', () => {
  it('matches the same ranks on both sides and mixes singles in', () => {
    const list = generateMatches(A, B, 4, 4);
    expect(list.map(label)).toEqual([
      'A1&A2 v B1&B2',
      'A4 v B4',
      'A1&A3 v B1&B3',
      'A3 v B3',
      'A2&A4 v B2&B4',
      'A1 v B1',
      'A3&A4 v B3&B4',
      'A2 v B2',
    ]);
    // Everyone plays 3 (two doubles, one singles). M02 and M03 between them use all eight players, so
    // one singles has to follow a doubles its players were in: A3 and B3 (M03, M04) are the only repeat.
    const games = new Map<string, number>();
    const twice: string[] = [];
    list.forEach((m, i) => {
      for (const p of [...m.a, ...m.b]) games.set(p, (games.get(p) ?? 0) + 1);
      if (i > 0) twice.push(...[...m.a, ...m.b].filter((p) => [...list[i - 1].a, ...list[i - 1].b].includes(p)));
    });
    expect(new Set(games.values())).toEqual(new Set([3]));
    expect(twice).toEqual(['A3', 'B3']);
  });

  it('puts all doubles first when there are no singles, and singles alone when there are no doubles', () => {
    expect(generateMatches(A, B, 2, 0).map(label)).toEqual(['A1&A2 v B1&B2', 'A1&A3 v B1&B3']);
    expect(generateMatches(A, B, 0, 3).map(label)).toEqual(['A1 v B1', 'A2 v B2', 'A3 v B3']);
  });

  it('shifts singles by one in a second round', () => {
    expect(generateMatches(['A1', 'A2'], ['B1', 'B2'], 0, 4).map(label)).toEqual(['A1 v B1', 'A2 v B2', 'A1 v B2', 'A2 v B1']);
  });

  it('never puts a player who is on both teams on both sides of one match', () => {
    const list = generateMatches(['A1', 'X', 'A3'], ['X', 'B2', 'B3'], 3, 3);
    for (const m of list) expect(m.a.some((p) => m.b.includes(p))).toBe(false);
  });

  it('handles teams of different sizes', () => {
    const list = generateMatches(['A1', 'A2', 'A3', 'A4', 'A5'], ['B1', 'B2', 'B3'], 3, 3);
    expect(list).toHaveLength(6);
    expect(list[0]).toEqual({ kind: 'doubles', a: ['A1', 'A2'], b: ['B1', 'B2'] });
  });
});

describe('mixing singles in', () => {
  it('places singles where the fewest players play twice in a row, closest to rank order on a tie', () => {
    const d: GeneratedMatch[] = [
      { kind: 'doubles', a: ['A1', 'A2'], b: ['B1', 'B2'] },
      { kind: 'doubles', a: ['A1', 'A3'], b: ['B1', 'B3'] },
    ];
    const s: GeneratedMatch[] = [
      { kind: 'singles', a: ['A1'], b: ['B1'] },
      { kind: 'singles', a: ['A3'], b: ['B3'] },
      { kind: 'singles', a: ['A4'], b: ['B4'] },
    ];
    // Only A4 v B4 avoids both doubles, but putting it first still leaves one clash later; this way
    // A3 and B3 play twice in a row (the least possible), and the singles stay nearest rank order.
    expect(mixIn(d, s).map(label)).toEqual(['A1&A2 v B1&B2', 'A3 v B3', 'A1&A3 v B1&B3', 'A4 v B4', 'A1 v B1']);
  });
});
