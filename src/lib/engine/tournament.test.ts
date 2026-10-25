import { describe, expect, it } from 'vitest';
import type { MatchKind, Tournament, TournamentMatch } from '../types';
import {
  addMinutes,
  addPoint,
  backToBack,
  checkMatch,
  fillTimes,
  gameState,
  maxPointsFor,
  minutesBetween,
  nextTime,
  playerRecords,
  playerTeam,
  rallyState,
  rulesFor,
  scoresOf,
  teamScore,
  tournamentHistory,
  undoPoint,
  validFinalScore,
} from './tournament';

// Seven players: Vikram, Sridhar, Anu on one side, Yuva, Shashwin, Hardesh on the other, Vino on both.
function tournament(matches: Partial<TournamentMatch>[] = []): Tournament {
  return {
    id: 't1',
    name: 'Cup',
    date: '2026-10-25',
    status: 'upcoming',
    pointsToWin: 21,
    maxPoints: 30,
    teams: {
      a: { name: 'Smashers', color: 'blue', players: ['Vikram', 'Sridhar', 'Anu', 'Vino'] },
      b: { name: null, color: 'orange', players: ['Yuva', 'Shashwin', 'Hardesh', 'Vino'] },
    },
    schedule: { start: '07:00', minutes: 15 },
    matches: Object.fromEntries(
      matches.map((m, i) => {
        const id = m.id ?? `m${i + 1}`;
        const match: TournamentMatch = {
          id,
          order: i + 1,
          kind: 'doubles' as MatchKind,
          a: [],
          b: [],
          time: null,
          status: 'scheduled',
          scoreA: 0,
          scoreB: 0,
          log: '',
          scorer: null,
          pointsToWin: null,
          maxPoints: null,
          startedAt: null,
          completedAt: null,
          ...m,
        };
        return [id, match];
      }),
    ),
  };
}

describe('scoring a game to 21 (win by 2, capped at 30)', () => {
  it('knows when a game is over', () => {
    expect(gameState(21, 19)).toMatchObject({ over: true, winner: 'A' });
    expect(gameState(17, 21)).toMatchObject({ over: true, winner: 'B' });
    expect(gameState(21, 20)).toMatchObject({ over: false, winner: null, gamePoint: ['A'] });
    expect(gameState(22, 20)).toMatchObject({ over: true, winner: 'A' });
    expect(gameState(30, 29)).toMatchObject({ over: true, winner: 'A' });
  });

  it('calls game point, deuce and the golden point at 29–29', () => {
    expect(gameState(20, 15).gamePoint).toEqual(['A']);
    expect(gameState(20, 20)).toMatchObject({ deuce: true, gamePoint: [] });
    expect(gameState(29, 29)).toMatchObject({ deuce: true, gamePoint: ['A', 'B'] });
    expect(gameState(10, 4)).toMatchObject({ deuce: false, gamePoint: [] });
  });

  it('says to change ends when a side first reaches 11', () => {
    const tenFive = 'A'.repeat(10) + 'B'.repeat(5);
    expect(rallyState(tenFive + 'A').changeEnds).toBe(true);
    expect(rallyState(tenFive + 'AB').changeEnds).toBe(false); // 11–6: already changed
    expect(rallyState(tenFive + 'B').changeEnds).toBe(false); // 10–6
  });

  it('adds points, undoes them, and stops once the game is won', () => {
    let log = '';
    for (let i = 0; i < 21; i++) log = addPoint(log, 'B');
    expect(scoresOf(log)).toEqual({ a: 0, b: 21 });
    expect(addPoint(log, 'A')).toBe(log); // game over: no more points
    expect(scoresOf(undoPoint(log))).toEqual({ a: 0, b: 20 });
    expect(undoPoint('')).toBe('');
  });

  it('accepts typed-in scores only if a game could finish that way', () => {
    for (const [a, b] of [
      [21, 19],
      [21, 0],
      [24, 22],
      [30, 29],
      [30, 28],
      [15, 21],
    ]) {
      expect(validFinalScore(a, b), `${a}-${b}`).toBe(true);
    }
    for (const [a, b] of [
      [21, 20],
      [23, 19],
      [30, 25],
      [31, 29],
      [18, 15],
      [21, 21],
      [-1, 21],
      [21.5, 3],
    ]) {
      expect(validFinalScore(a, b), `${a}-${b}`).toBe(false);
    }
  });
});

describe('results', () => {
  const played = tournament([
    { kind: 'doubles', a: ['Vikram', 'Sridhar'], b: ['Yuva', 'Shashwin'], status: 'completed', scoreA: 21, scoreB: 17 },
    { kind: 'doubles', a: ['Anu', 'Vino'], b: ['Hardesh', 'Yuva'], status: 'completed', scoreA: 19, scoreB: 21 },
    { kind: 'singles', a: ['Vikram'], b: ['Vino'], status: 'completed', scoreA: 21, scoreB: 10 },
    { kind: 'singles', a: ['Anu'], b: ['Hardesh'], status: 'live', scoreA: 5, scoreB: 3 },
    { kind: 'doubles', a: ['Sridhar', 'Anu'], b: ['Shashwin', 'Hardesh'] },
  ]);

  it('counts matches won and points from finished matches only', () => {
    expect(teamScore(played)).toEqual({ won: { a: 2, b: 1 }, points: { a: 61, b: 48 }, played: 3, remaining: 2, leader: 'a' });
  });

  it('breaks a tie on matches with total points, and calls it level when those match too', () => {
    const tied = tournament([
      { a: ['Vikram', 'Sridhar'], b: ['Yuva', 'Shashwin'], status: 'completed', scoreA: 21, scoreB: 19 },
      { a: ['Anu', 'Vino'], b: ['Hardesh', 'Yuva'], status: 'completed', scoreA: 10, scoreB: 21 },
    ]);
    expect(teamScore(tied).leader).toBe('b'); // 1–1 on matches, 31–40 on points
    const level = tournament([
      { a: ['Vikram', 'Sridhar'], b: ['Yuva', 'Shashwin'], status: 'completed', scoreA: 21, scoreB: 19 },
      { a: ['Anu', 'Vino'], b: ['Hardesh', 'Yuva'], status: 'completed', scoreA: 19, scoreB: 21 },
    ]);
    expect(teamScore(level).leader).toBeNull();
    expect(teamScore(tournament()).leader).toBeNull();
  });

  it('credits the common player to whichever side they played for', () => {
    const lines = new Map(playerRecords(played).map((l) => [l.playerId, l]));
    expect(playerTeam(played, 'Vino')).toBe('both');
    // Lost for the first team (19–21), lost for the second team in singles (10–21).
    expect(lines.get('Vino')).toMatchObject({ team: 'both', played: 2, won: 0, lost: 2, pointsFor: 29, pointsAgainst: 42, doubles: 1, singles: 1 });
    expect(lines.get('Vikram')).toMatchObject({ team: 'a', played: 2, won: 2, lost: 0, doubles: 1, singles: 1 });
    // The live and scheduled matches count towards the schedule but not the record.
    expect(lines.get('Anu')).toMatchObject({ played: 1, won: 0, lost: 1, doubles: 2, singles: 1 });
    expect(playerRecords(played)[0].playerId).toBe('Vikram');
  });
});

describe('setting up matches', () => {
  const t = tournament([{ a: ['Vikram', 'Sridhar'], b: ['Yuva', 'Shashwin'] }]);

  it('checks the lineup', () => {
    expect(checkMatch(t, 'doubles', ['Vikram', 'Vino'], ['Yuva', 'Hardesh'])).toBeNull();
    expect(checkMatch(t, 'singles', ['Anu'], ['Vino'])).toBeNull(); // the common player can play for either team
    expect(checkMatch(t, 'doubles', ['Vikram'], ['Yuva', 'Hardesh'])).toMatch(/two players/);
    expect(checkMatch(t, 'singles', ['Vino'], ['Vino'])).toMatch(/both sides/);
    expect(checkMatch(t, 'singles', ['Yuva'], ['Hardesh'])).toMatch(/isn't on the first team/);
    expect(checkMatch(t, 'doubles', ['Anu', 'Anu'], ['Yuva', 'Hardesh'])).toMatch(/different/);
  });

  it('spots players who would play back to back', () => {
    expect(backToBack(t, 2, ['Vikram', 'Anu', 'Yuva', 'Hardesh'])).toEqual(['Vikram', 'Yuva']);
    expect(backToBack(t, 1, ['Vikram'])).toEqual([]);
  });
});

describe('times', () => {
  it('adds minutes and fills a schedule', () => {
    expect(addMinutes('19:45', 30)).toBe('20:15');
    expect(addMinutes('23:50', 15)).toBe('00:05');
    expect(addMinutes('07:00', -15)).toBe('06:45');
    expect(minutesBetween('19:00', '19:20')).toBe(20);
    expect(fillTimes('07:00', 15, 4)).toEqual(['07:00', '07:15', '07:30', '07:45']);
  });

  it('suggests the next match time after the last timed one', () => {
    expect(nextTime(tournament())).toBe('07:00');
    expect(nextTime(tournament([{ time: '07:00' }, { time: '07:20' }]))).toBe('07:35');
  });
});

describe('other targets (a game cut to 15, or played to 10)', () => {
  it('caps a game at its target plus 40%: 21 → 30, 15 → 21, 11 → 16, 10 → 14', () => {
    expect([21, 15, 11, 10].map(maxPointsFor)).toEqual([30, 21, 16, 14]);
  });

  it("uses a match's own target when it has one", () => {
    const t = tournament();
    expect(rulesFor(t, { pointsToWin: null, maxPoints: null })).toEqual({ pointsToWin: 21, maxPoints: 30 });
    expect(rulesFor(t, { pointsToWin: 15, maxPoints: null })).toEqual({ pointsToWin: 15, maxPoints: 21 });
    expect(rulesFor(t, { pointsToWin: 10, maxPoints: 14 })).toEqual({ pointsToWin: 10, maxPoints: 14 });
  });

  it('ends a game to 10 at 10–8, goes to deuce at 9–9 and stops at the cap', () => {
    expect(gameState(10, 8, 10, 14)).toMatchObject({ over: true, winner: 'A' });
    expect(gameState(10, 9, 10, 14)).toMatchObject({ over: false, gamePoint: ['A'] });
    expect(gameState(9, 9, 10, 14)).toMatchObject({ deuce: true });
    expect(gameState(14, 13, 10, 14)).toMatchObject({ over: true, winner: 'A' });
    expect(validFinalScore(15, 12, 15, 21)).toBe(true);
    expect(validFinalScore(10, 4, 10, 14)).toBe(true);
    expect(validFinalScore(15, 12)).toBe(false); // not a game to 21
  });
});

describe('finished tournaments count in the stats', () => {
  const t = {
    ...tournament([
      { kind: 'doubles', a: ['Vikram', 'Sridhar'], b: ['Yuva', 'Shashwin'], status: 'completed', scoreA: 21, scoreB: 17 },
      { kind: 'singles', a: ['Anu'], b: ['Vino'], status: 'completed', scoreA: 12, scoreB: 15, pointsToWin: 15, maxPoints: 21 },
      { kind: 'doubles', a: ['Sridhar', 'Anu'], b: ['Hardesh', 'Yuva'], status: 'live', scoreA: 4, scoreB: 2 },
      { kind: 'singles', a: ['Vikram'], b: ['Hardesh'] },
    ]),
    status: 'completed' as const,
  };

  it('turns the finished matches into a history entry (singles and cut games included)', () => {
    const h = tournamentHistory(t)!;
    expect(h).toMatchObject({ kind: 'tournament', date: t.date, title: 'Cup', pointsToWin: 21 });
    expect(h.m).toEqual([
      { n: 1, a: ['Vikram', 'Sridhar'], b: ['Yuva', 'Shashwin'], sa: 21, sb: 17 },
      { n: 2, a: ['Anu'], b: ['Vino'], sa: 12, sb: 15, p: 15 },
    ]);
    expect(h.players.sort()).toEqual(['Anu', 'Shashwin', 'Sridhar', 'Vikram', 'Vino', 'Yuva']);
  });

  it('counts nothing until the tournament is finished', () => {
    expect(tournamentHistory({ ...t, status: 'live' })).toBeNull();
    expect(tournamentHistory({ ...tournament(), status: 'completed' })).toBeNull();
  });
});

