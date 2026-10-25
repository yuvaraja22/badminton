import { describe, expect, it } from 'vitest';
import type { GameRecord, HistorySession } from '../types';
import { playerProfile, summarizeHistory } from './alltime';
import { partnerOf } from './games';
import { computeRatings } from './rating';
import { computePartnerships, computeStandings, headToHead, opponentsOf, partnersOf } from './stats';

// Tournament matches can be singles: one player a side. Player ids are their names here.
const nameOf = (id: string) => id;

function game(n: number, teamA: string[], scoreA: number, scoreB: number, teamB: string[]): GameRecord {
  return { sessionId: 's', date: '2026-10-25', number: n, teamA, teamB, scoreA, scoreB, status: 'completed' };
}

const games = [game(1, ['Vikram', 'Anu'], 21, 15, ['Yuva', 'Hardesh']), game(2, ['Vikram'], 21, 18, ['Yuva']), game(3, ['Anu'], 12, 21, ['Hardesh'])];

describe('singles in the stats', () => {
  it('count for each player like doubles', () => {
    const lines = new Map(computeStandings(games, nameOf, { minGames: 0 }).map((l) => [l.playerId, l]));
    expect(lines.get('Vikram')).toMatchObject({ played: 2, won: 2, lost: 0, pointsFor: 42, pointsAgainst: 33 });
    expect(lines.get('Hardesh')).toMatchObject({ played: 2, won: 1, lost: 1 });
  });

  it('have no partner, so partnerships only use doubles', () => {
    expect(partnerOf(games[1], 'Vikram')).toBeNull();
    expect(computePartnerships(games, nameOf).map((p) => p.pair.join(' & '))).toEqual(['Anu & Vikram', 'Hardesh & Yuva']);
    expect(partnersOf(games, 'Vikram')).toEqual([expect.objectContaining({ otherId: 'Anu', played: 1 })]);
  });

  it('count against the opponent and in head-to-head', () => {
    expect(opponentsOf(games, 'Vikram').find((r) => r.otherId === 'Yuva')).toMatchObject({ played: 2, won: 2 });
    expect(headToHead(games, 'Vikram', 'Yuva').against).toEqual({ played: 2, p1Won: 2, p2Won: 0, diff: 9 });
  });
});

describe('a finished tournament in the history', () => {
  const history: Record<string, HistorySession> = {
    s1: { date: '2026-10-11', title: 'Sunday Badminton', pointsToWin: 21, players: ['Vikram', 'Anu', 'Yuva', 'Hardesh'], levels: {}, m: [{ n: 1, a: ['Vikram', 'Anu'], b: ['Yuva', 'Hardesh'], sa: 21, sb: 19 }] },
    t1: {
      kind: 'tournament',
      date: '2026-10-25',
      title: 'Diwali Cup',
      pointsToWin: 21,
      players: ['Vikram', 'Anu', 'Yuva', 'Hardesh'],
      levels: {},
      m: [
        { n: 1, a: ['Vikram'], b: ['Yuva'], sa: 21, sb: 18 },
        { n: 2, a: ['Anu'], b: ['Hardesh'], sa: 10, sb: 15, p: 15 },
      ],
    },
  };

  it('shows on profiles next to sessions, tagged as a tournament', () => {
    const p = playerProfile(history, nameOf, 'Vikram');
    expect(p.line).toMatchObject({ played: 2, won: 2 });
    expect(p.sessions.map((s) => [s.title, s.kind])).toEqual([
      ['Diwali Cup', 'tournament'],
      ['Sunday Badminton', 'session'],
    ]);
    expect(summarizeHistory(history, nameOf)[0]).toMatchObject({ id: 't1', kind: 'tournament' });
  });

  it('moves skill ratings, singles included', () => {
    const without = computeRatings({ s1: history.s1 }).ratings;
    const withT = computeRatings(history).ratings;
    expect(withT.get('Vikram')!.games).toBe(2);
    expect(withT.get('Vikram')!.level).toBeGreaterThan(without.get('Vikram')!.level);
    expect(withT.get('Anu')!.level).toBeLessThan(without.get('Anu')!.level);
  });
});
