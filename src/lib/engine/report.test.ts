import { describe, expect, it } from 'vitest';
import type { GameRecord } from '../types';
import { oneDecimal, pct } from '../format';
import { PAST_SESSIONS, type PastSessionFixture } from './fixtures/pastSessions';
import { buildReport } from './report';

// In these tests player ids are simply their names.
const nameOf = (id: string) => id;

function gamesOf(f: PastSessionFixture): GameRecord[] {
  return f.matches.map((m, i) => ({
    sessionId: f.key,
    date: f.knownDate ?? '2026-10-03',
    number: i + 1,
    teamA: m.t1,
    teamB: m.t2,
    scoreA: m.s1,
    scoreB: m.s2,
    status: m.unfinished ? 'unfinished' : 'completed',
  }));
}

function reportOf(key: string) {
  const f = PAST_SESSIONS.find((s) => s.key === key)!;
  return buildReport({ title: 'Test', date: f.knownDate ?? '2026-10-03', pointsToWin: f.pointsToWin, games: gamesOf(f), nameOf });
}

type Row = [name: string, played: number, won: number, lost: number, winRate: string, pf: number, pa: number, diff: number, ppg: string];

function standingRows(key: string): Row[] {
  return reportOf(key).standings.map((s) => [s.name, s.played, s.won, s.lost, pct(s.winRate), s.pointsFor, s.pointsAgainst, s.diff, oneDecimal(s.ppg)]);
}

function pairRows(key: string): [string, number, number, number][] {
  return reportOf(key).partnerships.map((p) => [p.label, p.won, p.lost, p.diff]);
}

describe('session report reproduces the original PDFs', () => {
  it('Sat_Badminton_Report_New (5 players, 1 unfinished)', () => {
    const r = reportOf('sat-new');
    expect(r.matchCount).toBe(10);
    expect(r.totalPoints).toBe(371);
    expect(r.unfinishedCount).toBe(1);
    expect(standingRows('sat-new')).toEqual([
      ['Vikram', 9, 8, 1, '88.9%', 191, 145, 46, '21.2'],
      ['Yuva', 8, 5, 3, '62.5%', 159, 133, 26, '19.9'],
      ['Shashwin', 8, 4, 4, '50.0%', 144, 157, -13, '18.0'],
      ['Anu', 7, 2, 5, '28.6%', 129, 141, -12, '18.4'],
      ['Sridhar', 8, 1, 7, '12.5%', 119, 166, -47, '14.9'],
    ]);
    expect(pairRows('sat-new')).toEqual([
      ['Vikram & Yuva', 3, 0, 30],
      ['Shashwin & Vikram', 4, 0, 15],
      ['Anu & Vikram', 1, 1, 1],
      ['Sridhar & Yuva', 1, 1, -5],
      ['Anu & Yuva', 1, 2, 1],
      ['Anu & Sridhar', 0, 2, -14],
      ['Shashwin & Sridhar', 0, 4, -28],
    ]);
    expect(r.mvp).toMatchObject({ name: 'Vikram', won: 8, lost: 1, line: '88.9% win rate (+46 diff)' });
    expect(r.bestPair).toEqual({ label: 'Vikram & Yuva', line: '3 wins / 0 losses (+30 diff)' });
    expect(r.tightest).toEqual({ score: '25 - 23', line: 'Vikram & Shashwin beat Yuva & Anu (M9)' });
    expect(r.log.map((l) => l.context)).toEqual([
      'Solid win (+5)',
      'Close contest (+3)',
      "Vikram's only defeat (+2)",
      'Solid finish (+4)',
      'Decisive victory (+7)',
      'Decisive victory (+7)',
      'High-pressure finish (+2)',
      'Blowout win (+12)',
      'Deuce thriller (+2)',
      'Blowout win (+13)',
      'Unfinished: Yuva & Sridhar led 20-17',
    ]);
    expect(r.log[10]).toMatchObject({ code: 'M11', winner: null, status: 'unfinished' });
  });

  it('Sunday_Badminton_Report_Oct11 (6 players)', () => {
    const r = reportOf('sunday-oct11');
    expect(r.matchCount).toBe(12);
    expect(r.totalPoints).toBe(452);
    expect(r.playerCount).toBe(6);
    expect(standingRows('sunday-oct11')).toEqual([
      ['Sridhar', 8, 7, 1, '87.5%', 169, 143, 26, '21.1'],
      ['Vikram', 9, 7, 2, '77.8%', 188, 156, 32, '20.9'],
      ['Anu', 8, 5, 3, '62.5%', 151, 137, 14, '18.9'],
      ['Shashwin', 7, 2, 5, '28.6%', 116, 137, -21, '16.6'],
      ['Hardesh', 8, 2, 6, '25.0%', 135, 167, -32, '16.9'],
      ['Yuva', 8, 1, 7, '12.5%', 145, 164, -19, '18.1'],
    ]);
    expect(pairRows('sunday-oct11')).toEqual([
      ['Anu & Vikram', 3, 0, 16],
      ['Anu & Sridhar', 2, 0, 15],
      ['Shashwin & Vikram', 1, 0, 7],
      ['Sridhar & Vikram', 2, 0, 6],
      ['Hardesh & Sridhar', 2, 0, 4],
      ['Shashwin & Sridhar', 1, 1, 1],
      ['Vikram & Yuva', 1, 2, 3],
      ['Hardesh & Yuva', 0, 2, -6],
      ['Shashwin & Yuva', 0, 1, -6],
      ['Anu & Hardesh', 0, 1, -7],
      ['Anu & Yuva', 0, 2, -10],
      ['Hardesh & Shashwin', 0, 3, -23],
    ]);
    expect(r.mvp).toMatchObject({ name: 'Sridhar', won: 7, lost: 1, line: '87.5% win rate (+26 diff)' });
    expect(r.bestPair).toEqual({ label: 'Anu & Vikram', line: '3 wins / 0 losses (+16 diff)' });
    expect(r.tightest).toEqual({ score: '23 - 21', line: 'Sridhar & Hardesh beat Vikram & Yuva (M8)' });
    expect(r.log.map((l) => l.context)).toEqual([
      'Decisive victory (+7)',
      'Solid finish (+4)',
      'Close contest (+3)',
      'Solid finish (+4)',
      'High-pressure finish (+2)',
      'Decisive victory (+9)',
      'Decisive victory (+7)',
      'Deuce thriller (+2)',
      'Blowout win (+10)',
      'Solid win (+6)',
      'Deuce thriller (+2)',
      // The PDF said "High-pressure finish" here; the app calls out the top performer's only loss.
      "Sridhar's only defeat (+2)",
    ]);
  });

  it('Saturday_Badminton_Report (7 players)', () => {
    const r = reportOf('saturday');
    expect(r.matchCount).toBe(12);
    // The PDF printed 434, but its own match log adds up to 445 (every standings row agrees with 445).
    expect(r.totalPoints).toBe(445);
    expect(standingRows('saturday')).toEqual([
      ['Vikram', 7, 5, 2, '71.4%', 143, 121, 22, '20.4'],
      ['Vino', 7, 5, 2, '71.4%', 139, 118, 21, '19.9'],
      ['Yuva', 7, 3, 4, '42.9%', 129, 135, -6, '18.4'],
      ['Sridhar', 7, 3, 4, '42.9%', 131, 138, -7, '18.7'],
      ['Arul', 7, 3, 4, '42.9%', 125, 135, -10, '17.9'],
      ['Anu', 7, 3, 4, '42.9%', 119, 131, -12, '17.0'],
      ['Shashwin', 6, 2, 4, '33.3%', 104, 112, -8, '17.3'],
    ]);
    const pairs = pairRows('saturday');
    for (const row of [
      ['Arul & Vikram', 2, 0, 10],
      ['Vikram & Vino', 2, 1, 6],
      ['Sridhar & Yuva', 2, 1, 7],
      ['Shashwin & Vino', 1, 0, 11],
    ]) {
      expect(pairs).toContainEqual(row);
    }
    expect(r.bestPair?.label).toBe('Arul & Vikram');
    expect(r.tightest).toEqual({ score: '23 - 22', line: 'Arul & Vikram beat Yuva & Sridhar (M7)' });
  });

  it('Sunday_Badminton_Report (7 players, one with few games)', () => {
    const r = reportOf('sunday');
    expect(r.matchCount).toBe(11);
    // The PDF printed 390, but its own match log adds up to 401.
    expect(r.totalPoints).toBe(401);
    expect(standingRows('sunday')).toEqual([
      ['Vikram', 8, 8, 0, '100.0%', 168, 117, 51, '21.0'],
      ['Shashwin', 7, 4, 3, '57.1%', 136, 133, 3, '19.4'],
      ['Yuva', 7, 4, 3, '57.1%', 126, 131, -5, '18.0'],
      ['Anu', 6, 3, 3, '50.0%', 107, 109, -2, '17.8'],
      ['Uppli', 5, 2, 3, '40.0%', 93, 87, 6, '18.6'],
      ['Sridhar', 8, 1, 7, '12.5%', 131, 162, -31, '16.4'],
      ['Vino', 3, 0, 3, '0.0%', 41, 63, -22, '13.7'],
    ]);
    expect(r.standings.find((s) => s.name === 'Vino')?.qualified).toBe(false);
    const pairs = pairRows('sunday');
    for (const row of [
      ['Uppli & Vikram', 2, 0, 19],
      ['Anu & Vikram', 2, 0, 14],
      ['Vikram & Yuva', 2, 0, 11],
      ['Shashwin & Vikram', 2, 0, 7],
      ['Shashwin & Sridhar', 1, 3, -6],
    ]) {
      expect(pairs).toContainEqual(row);
    }
    expect(r.mvp).toMatchObject({ name: 'Vikram', undefeated: true, line: '100.0% win rate (+51 diff)' });
    expect(r.bestPair).toEqual({ label: 'Uppli & Vikram', line: '2 wins / 0 losses (+19 diff)' });
    expect(r.tightest).toEqual({ score: '22 - 20', line: 'Yuva & Shashwin beat Anu & Uppli (M6)' });
  });

  it('ranks a player with too few games below everyone who qualified', () => {
    const f = PAST_SESSIONS.find((s) => s.key === 'sat-new')!;
    const games = gamesOf(f);
    // A guest who won the only two games they played would otherwise top the table.
    games.push(
      { ...games[0], number: 12, teamA: ['Guest', 'Sridhar'], teamB: ['Anu', 'Yuva'], scoreA: 21, scoreB: 10, status: 'completed' },
      { ...games[0], number: 13, teamA: ['Guest', 'Anu'], teamB: ['Sridhar', 'Yuva'], scoreA: 21, scoreB: 12, status: 'completed' },
    );
    const r = buildReport({ title: 'T', date: '2026-10-03', pointsToWin: 21, games, nameOf });
    expect(r.standings[0].name).toBe('Vikram');
    expect(r.standings.at(-1)?.name).toBe('Guest');
  });
});

describe('takeaways', () => {
  it('Oct 11 matches the original wording where the facts line up', () => {
    const t = reportOf('sunday-oct11').autoTakeaways;
    expect(t).toHaveLength(6);
    expect(t[0]).toBe(
      "Near-Flawless Display: Sridhar went 7-1 across 8 games, partnering 4 different teammates. Sridhar's only loss was M12 (19-21) alongside Shashwin.",
    );
    expect(t).toContain('Unbeaten Pairs: Anu & Vikram went 3-0 (+16), and four other pairings finished unbeaten, led by Anu & Sridhar (2-0, +15).');
    expect(t).toContain('Nail-Biters: Four games were decided by 2 points (M5, M8, M11, M12). M8 (23-21) and M11 (22-20) both went past 21.');
    expect(t).toContain('Close Calls for Yuva: Yuva finished 1-7, but 3 of those losses were by just 2 points (M5, M8, M11).');
    expect(t).toContain(
      "Vikram's Consistency: Vikram went 7-2 and posted the best point difference at +32. Both of Vikram's losses came alongside Yuva, by 2 points each.",
    );
    expect(t).toContain("Hardesh's Two Sides: Hardesh & Shashwin lost all 3 games as a pair (-23), while Hardesh won both games alongside Sridhar.");
  });

  it('Sat (new) covers the pairs, the climb and the unfinished game last', () => {
    const t = reportOf('sat-new').autoTakeaways;
    expect(t.length).toBeLessThanOrEqual(6);
    expect(t).toContain("Shashwin's Two Sides: Shashwin & Sridhar lost all 4 games as a pair (-28), while Shashwin won all 4 games alongside Vikram.");
    expect(t).toContain("Yuva's Climb: Yuva finished second at 5-3 (+26), winning with 3 different partners.");
    expect(t).toContain(
      'Unbeaten Pairs: Vikram & Yuva (3-0, +30) and Shashwin & Vikram (4-0, +15) won every game they played together.',
    );
    expect(t.at(-1)).toBe('Unfinished: M11 was stopped with Yuva & Sridhar leading Anu & Vikram 20-17 and is not counted in the standings.');
  });

  it('mentions a debut and an undefeated run', () => {
    const f = PAST_SESSIONS.find((s) => s.key === 'sunday')!;
    const r = buildReport({ title: 'T', date: '2026-10-04', pointsToWin: 21, games: gamesOf(f), nameOf, newPlayers: new Set(['Uppli']) });
    expect(r.autoTakeaways[0]).toBe('Flawless Display: Vikram went 8-0, partnering 4 different teammates and winning every game.');
    expect(r.autoTakeaways).toContain('Debut Impact: Uppli made a strong debut, going 2-3 with a +6 point difference.');
    expect(r.standings.find((s) => s.name === 'Uppli')?.isNew).toBe(true);
  });
});
