import { describe, expect, it } from 'vitest';
import type { HistoryMatch, HistorySession, PlayerId } from '../types';
import { PAST_SESSIONS } from './fixtures/pastSessions';
import { PROVISIONAL_GAMES, SEED_SIGMA, computeRatings, levelToMu, marginWeight, muToLevel, ratingStandings, sessionSkills } from './rating';

type Game = [a: [PlayerId, PlayerId], sa: number, sb: number, b: [PlayerId, PlayerId], unfinished?: boolean];

function session(date: string, games: Game[], levels: Record<PlayerId, number> = {}, pointsToWin = 21): HistorySession {
  const m: HistoryMatch[] = games.map(([a, sa, sb, b, u], i) => ({ n: i + 1, a, b, sa, sb, ...(u ? { u: true } : {}) }));
  const players = [...new Set(games.flatMap(([a, , , b]) => [...a, ...b]))];
  return { date, title: date, pointsToWin, players, levels: Object.fromEntries(players.map((p) => [p, levels[p] ?? 3])), m };
}

describe('level ↔ μ', () => {
  it('maps the level scale onto μ and back', () => {
    expect(levelToMu(3)).toBe(25);
    expect(levelToMu(1)).toBe(9);
    expect(levelToMu(5.5)).toBe(45);
    expect(muToLevel(levelToMu(4.5))).toBeCloseTo(4.5);
    expect(muToLevel(-100)).toBe(1);
    expect(muToLevel(100)).toBe(5.5);
  });

  it('weights updates by margin, relative to the game length', () => {
    expect(marginWeight(23, 21, 21)).toBe(0.6);
    expect(marginWeight(21, 14, 21)).toBeCloseTo(1);
    expect(marginWeight(21, 3, 21)).toBe(1.4);
    // 15-10 in a game to 15 is as decisive as 21-14 in a game to 21
    expect(marginWeight(15, 10, 15)).toBeCloseTo(1);
  });
});

describe('computeRatings', () => {
  it('seeds players from their first session level', () => {
    const { ratings } = computeRatings({ s1: session('2026-01-03', [[['A', 'B'], 21, 19, ['C', 'D']]], { A: 4.5, B: 2, C: 3, D: 3 }) });
    expect(ratings.get('A')!.seedLevel).toBe(4.5);
    expect(ratings.get('B')!.seedLevel).toBe(2);
    expect(ratings.get('A')!.level).toBeGreaterThan(4);
  });

  it('moves winners up and losers down, more for a bigger margin', () => {
    const close = computeRatings({ s: session('2026-01-03', [[['A', 'B'], 23, 21, ['C', 'D']]]) }).ratings;
    const blowout = computeRatings({ s: session('2026-01-03', [[['A', 'B'], 21, 5, ['C', 'D']]]) }).ratings;
    expect(close.get('A')!.level).toBeGreaterThan(3);
    expect(close.get('C')!.level).toBeLessThan(3);
    expect(blowout.get('A')!.level - 3).toBeGreaterThan(2 * (close.get('A')!.level - 3));
    expect(blowout.get('A')!.sigma).toBeLessThan(SEED_SIGMA);
  });

  it('ignores unfinished games', () => {
    const { ratings, predictions } = computeRatings({
      s: session('2026-01-03', [
        [['A', 'B'], 20, 17, ['C', 'D'], true],
        [['A', 'C'], 21, 15, ['B', 'D']],
      ]),
    });
    expect(predictions).toHaveLength(1);
    expect(ratings.get('A')!.games).toBe(1);
  });

  it('replays sessions in date order regardless of how they are stored', () => {
    const s1 = session('2026-01-03', [[['A', 'B'], 21, 10, ['C', 'D']]]);
    const s2 = session('2026-01-10', [[['A', 'C'], 15, 21, ['B', 'D']]]);
    const x = computeRatings({ s1, s2 }).ratings;
    const y = computeRatings({ s2, s1 }).ratings;
    for (const p of ['A', 'B', 'C', 'D']) expect(y.get(p)).toEqual(x.get(p));
  });

  it('becomes less certain while a player is away', () => {
    const games: Game[] = [
      [['A', 'B'], 21, 15, ['C', 'D']],
      [['A', 'C'], 21, 15, ['B', 'D']],
      [['A', 'D'], 21, 15, ['B', 'C']],
    ];
    const away = (date: string) => computeRatings({ s1: session('2026-01-03', games), s2: session(date, [[['A', 'B'], 21, 19, ['C', 'D']]]) });
    const before = computeRatings({ s1: session('2026-01-03', games) }).ratings.get('A')!.sigma;
    const soon = away('2026-01-10').ratings.get('A')!;
    const late = away('2026-06-06').ratings.get('A')!;
    // Same win, but after five months away it moves the rating further.
    expect(late.mu).toBeGreaterThan(soon.mu);
    expect(late.sigma).toBeGreaterThan(soon.sigma);
    expect(late.sigma).toBeLessThanOrEqual(SEED_SIGMA);
    expect(before).toBeLessThan(SEED_SIGMA);
  });

  it('marks players provisional until they have played enough games', () => {
    const games: Game[] = Array.from({ length: PROVISIONAL_GAMES }, () => [['A', 'B'], 21, 18, ['C', 'D']]);
    const { ratings } = computeRatings({ s: session('2026-01-03', games.slice(0, -1)) });
    expect(ratings.get('A')!.provisional).toBe(true);
    expect(computeRatings({ s: session('2026-01-03', games) }).ratings.get('A')!.provisional).toBe(false);
  });

  it('lifts a player who keeps winning with different partners above everyone else', () => {
    const others = ['B', 'C', 'D', 'E', 'F'];
    const games: Game[] = [];
    for (let i = 0; i < 20; i++) {
      const [p, x, y, z] = [0, 1, 2, 3].map((k) => others[(i + k) % others.length]);
      games.push([['S', p], 21, 16, [x, y]]);
      games.push([[x, z], 21, 18, [p, y]]);
    }
    const { ratings } = computeRatings({ s: session('2026-01-03', games) });
    const board = ratingStandings(ratings);
    expect(board[0].playerId).toBe('S');
    expect(board[0].level).toBeGreaterThan(Math.max(...others.map((o) => ratings.get(o)!.level)) + 0.5);
  });

  it('predicts the PDF sessions better than a coin flip once it has warmed up', () => {
    const history: Record<string, HistorySession> = {};
    PAST_SESSIONS.forEach((f, i) => {
      history[f.key] = session(
        f.knownDate ?? `2026-09-${String(5 + i * 7).padStart(2, '0')}`,
        f.matches.map((m) => [m.t1, m.s1, m.s2, m.t2, m.unfinished]),
        {},
        f.pointsToWin,
      );
    });
    const { predictions } = computeRatings(history);
    const later = predictions.slice(12);
    const logLoss = later.reduce((s, p) => s - Math.log(p.aWon ? p.pA : 1 - p.pA), 0) / later.length;
    expect(later.length).toBeGreaterThan(20);
    expect(logLoss).toBeLessThan(Math.log(2));
  });
});

describe('sessionSkills', () => {
  const ratings = computeRatings({
    s: session(
      '2026-01-03',
      Array.from({ length: PROVISIONAL_GAMES }, (): Game => [['A', 'B'], 21, 10, ['C', 'D']]),
    ),
  }).ratings;
  ratings.set('N', { ...ratings.get('A')!, playerId: 'N', games: 2, provisional: true, level: 5 });
  const profiles = new Map([
    ['A', { level: 3 }],
    ['B', { level: 3 }],
    ['N', { level: 2 }],
  ]);

  it('uses an established rating, keeps a session override, and falls back to the session level', () => {
    const skills = sessionSkills({ A: { level: 3 }, B: { level: 4 }, N: { level: 2 }, X: { level: 3.5 } }, ratings, profiles);
    expect(skills.A).toBeCloseTo(ratings.get('A')!.level, 2); // established rating, rounded
    expect(skills.A).toBe(Math.round(skills.A * 100) / 100);
    expect(skills.A).toBeGreaterThan(3);
    expect(skills.B).toBe(4); // admin changed B's level for this session
    expect(skills.N).toBe(2); // provisional rating
    expect(skills.X).toBe(3.5); // never rated
  });
});
