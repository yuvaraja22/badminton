import { describe, expect, it } from 'vitest';
import type { HistorySession } from '../types';
import { calibration, pairSynergy } from './insights';

const history: Record<string, HistorySession> = {
  s1: {
    date: '2026-10-04',
    title: 'S',
    pointsToWin: 21,
    players: ['a', 'b', 'c', 'd'],
    levels: {},
    m: [
      { n: 1, a: ['a', 'b'], b: ['c', 'd'], sa: 21, sb: 15 },
      { n: 2, a: ['a', 'c'], b: ['b', 'd'], sa: 21, sb: 18 },
      { n: 3, a: ['a', 'b'], b: ['c', 'd'], sa: 12, sb: 21 },
    ],
  },
};
const predictions = [
  { sessionId: 's1', number: 1, pA: 0.8, aWon: true },
  { sessionId: 's1', number: 2, pA: 0.4, aWon: true },
  { sessionId: 's1', number: 3, pA: 0.55, aWon: false },
];

describe('how good the win chances are', () => {
  it('counts how often the favourite won, by how big a favourite', () => {
    const c = calibration(predictions, history);
    expect(c.games).toBe(3);
    expect(c.favouriteWon).toBe(1);
    expect(c.buckets.map((b) => [b.label, b.games, b.won])).toEqual([
      ['Even match', 1, 0],
      ['Slight edge', 1, 0],
      ['One team stronger', 1, 1],
    ]);
    expect(calibration(predictions, history, { from: '2026-11-01' }).games).toBe(0);
  });
});

describe('partnerships against the odds', () => {
  it('compares wins with the chances the ratings gave', () => {
    const s = pairSynergy(predictions, history);
    const ab = s.get('a|b')!;
    expect(ab).toMatchObject({ played: 2, won: 1 });
    expect(ab.expected).toBeCloseTo(0.8 + 0.55);
    expect(ab.above).toBeCloseTo(1 - 1.35);
    // a & c were the underdogs (40%) and won.
    expect(s.get('a|c')!.above).toBeCloseTo(0.6);
  });
});
