import { describe, expect, it } from 'vitest';
import type { HistorySession } from '../types';
import { awards, monthOf, periodFromKey, seasonOf } from './seasons';

const game = (n: number, a: string[], b: string[], sa: number, sb: number) => ({ n, a, b, sa, sb });
const session = (date: string, m: HistorySession['m']): HistorySession => ({
  date,
  title: 'S',
  pointsToWin: 21,
  players: [...new Set(m.flatMap((g) => [...g.a, ...g.b]))],
  levels: {},
  m,
});

describe('seasons and months', () => {
  it('are calendar quarters and months', () => {
    expect(seasonOf('2026-11-15')).toEqual({ kind: 'season', key: '2026-Q4', label: 'Oct–Dec 2026', from: '2026-10-01', to: '2026-12-31' });
    expect(seasonOf('2026-02-28')).toMatchObject({ key: '2026-Q1', from: '2026-01-01', to: '2026-03-31' });
    expect(monthOf('2028-02-10')).toEqual({ kind: 'month', key: '2028-02', label: 'February 2028', from: '2028-02-01', to: '2028-02-29' });
    expect(periodFromKey('2026-Q3')).toMatchObject({ from: '2026-07-01', to: '2026-09-30' });
    expect(periodFromKey('2026-10')).toMatchObject({ label: 'October 2026' });
    expect(periodFromKey('nonsense')).toBeNull();
  });

  it('crown the top of each period’s table, newest first; the current one is “so far”', () => {
    const history: Record<string, HistorySession> = {
      s1: session('2026-09-06', [game(1, ['vik', 'anu'], ['yuv', 'sri'], 21, 15), game(2, ['vik', 'yuv'], ['anu', 'sri'], 21, 18), game(3, ['vik', 'sri'], ['anu', 'yuv'], 21, 19)]),
      s2: session('2026-10-04', [game(1, ['anu', 'yuv'], ['vik', 'sri'], 21, 12), game(2, ['anu', 'sri'], ['vik', 'yuv'], 21, 16), game(3, ['anu', 'vik'], ['yuv', 'sri'], 21, 14)]),
    };
    const months = awards(history, (id) => id, 'month', '2026-10-25');
    expect(months.map((a) => [a.period.key, a.winner.playerId, a.final])).toEqual([
      ['2026-10', 'anu', false],
      ['2026-09', 'vik', true],
    ]);
    const seasons = awards(history, (id) => id, 'season', '2026-10-25');
    expect(seasons.map((a) => [a.period.key, a.winner.playerId])).toEqual([
      ['2026-Q4', 'anu'],
      ['2026-Q3', 'vik'],
    ]);
    // Guests can't win; the next qualified player does.
    expect(awards(history, (id) => id, 'month', '2026-10-25', (id) => id !== 'anu')[0].winner.playerId).not.toBe('anu');
  });
});
