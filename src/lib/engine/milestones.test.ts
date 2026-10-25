import { describe, expect, it } from 'vitest';
import type { HistorySession } from '../types';
import { achievements, recentMilestones } from './milestones';

const session = (date: string, results: [string[], string[], number, number][], kind?: 'tournament'): HistorySession => ({
  ...(kind ? { kind } : {}),
  date,
  title: 'S',
  pointsToWin: 21,
  players: [...new Set(results.flatMap(([a, b]) => [...a, ...b]))],
  levels: {},
  m: results.map(([a, b, sa, sb], i) => ({ n: i + 1, a, b, sa, sb })),
});

const win = (me: string, ...rest: string[]): [string[], string[], number, number] => [[me, rest[0]], [rest[1], rest[2]], 21, 15];
const lose = (me: string, ...rest: string[]): [string[], string[], number, number] => [[me, rest[0]], [rest[1], rest[2]], 15, 21];

describe('streaks and milestones', () => {
  const history: Record<string, HistorySession> = {
    s1: session('2026-09-06', [win('vik', 'anu', 'yuv', 'sri'), win('vik', 'yuv', 'anu', 'sri'), win('vik', 'sri', 'anu', 'yuv'), win('vik', 'anu', 'sri', 'yuv')]),
    s2: session('2026-09-13', [win('vik', 'anu', 'yuv', 'sri'), [['vik', 'yuv'], ['anu', 'sri'], 23, 21], lose('vik', 'sri', 'anu', 'yuv')]),
    s3: session('2026-09-20', [win('anu', 'yuv', 'sri', 'kum')]),
  };
  const a = achievements(history, 'vik', (id) => id);

  it('finds the best run and the current one', () => {
    expect(a.streaks.bestWin).toEqual({ length: 6, date: '2026-09-13' });
    expect(a.streaks.current).toEqual({ result: 'L', length: 1 });
  });

  it('awards unbeaten sessions, runs of wins and a first MVP', () => {
    const labels = a.milestones.map((m) => m.label);
    expect(labels).toContain('Unbeaten session (4-0)');
    expect(labels).toContain('5 wins in a row');
    expect(labels).toContain('First MVP');
    expect(labels).not.toContain('10 wins in a row');
  });

  it('counts attendance from the first session on', () => {
    // Came to s1 and s2, missed the latest (s3).
    expect(a.attendance).toEqual({ attended: 2, possible: 3, rate: 2 / 3, streak: 0 });
    expect(achievements(history, 'kum', (id) => id).attendance).toEqual({ attended: 1, possible: 1, rate: 1, streak: 1 });
  });

  it('lists recent milestones across players, newest first', () => {
    const recent = recentMilestones(history, ['vik', 'anu'], (id) => id, '2026-09-10');
    expect(recent.every((m) => m.date >= '2026-09-10')).toBe(true);
    expect(recent.find((m) => m.label === '5 wins in a row')?.playerId).toBe('vik');
  });
});
