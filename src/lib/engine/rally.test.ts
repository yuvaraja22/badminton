import { describe, expect, it } from 'vitest';
import { tournament } from './fixtures/tournament';
import { hasRallyLog, matchFlow, rallyHighlights, rallySummary } from './rally';
import { tournamentReport } from './tournament';

const short = { pointsToWin: 5, maxPoints: 7 };
const done = (log: string, extra = {}) => {
  const a = [...log].filter((c) => c === 'A').length;
  return { status: 'completed' as const, log, scoreA: a, scoreB: log.length - a, ...short, ...extra };
};

describe('point-by-point stats for one match', () => {
  it('finds the run, the comeback and the lead change', () => {
    const t = tournament([{ ...done('BBBAAAAA'), a: ['Vikram'], b: ['Yuva'], kind: 'singles' }]);
    const f = matchFlow(t, t.matches.m1)!;
    expect(f.leads).toEqual([0, -1, -2, -3, -2, -1, 0, 1, 2]);
    expect(f.winner).toBe('a');
    expect(f.longestRun).toEqual({ team: 'a', length: 5, from: [0, 3], to: [5, 3] });
    expect(f.comeback).toEqual({ down: 3, at: [0, 3] });
    expect(f.maxLead.b).toEqual({ lead: 3, at: [0, 3] });
    // B led, then A: one change of lead, through one tie at 3–3.
    expect(f.leadChanges).toBe(1);
    expect(f.ties).toBe(1);
    expect(f.firstToHalf).toBe('b');
    expect(f.deuce).toBe(false);
  });

  it('counts game points saved and deuce', () => {
    const t = tournament([done('AAAABBBBAA')]);
    const f = matchFlow(t, t.matches.m1)!;
    expect(f.saved).toEqual({ a: 0, b: 4 });
    expect(f.deuce).toBe(true);
    expect(f.comeback).toBeNull();
    expect(f.winner).toBe('a');
  });

  it('leaves out typed-in scores', () => {
    const t = tournament([
      { status: 'completed', scoreA: 21, scoreB: 15, log: '' },
      { status: 'completed', scoreA: 21, scoreB: 15, log: 'A'.repeat(21) + 'B'.repeat(15), typedPoints: 36 },
      { status: 'completed', scoreA: 21, scoreB: 16, log: 'A'.repeat(21) + 'B'.repeat(15) },
    ]);
    expect(Object.values(t.matches).map(hasRallyLog)).toEqual([false, false, false]);
    const r = rallySummary(t);
    expect(r.flows).toHaveLength(0);
    expect(r.typedIn.map((m) => m.order)).toEqual([1, 2, 3]);
    expect(rallyHighlights(t, r, (id) => id)).toEqual([]);
  });
});

describe('tournament summary', () => {
  const t = tournament([
    { ...done('BBBAAAAA'), a: ['Vikram'], b: ['Yuva'], kind: 'singles' },
    { ...done('AAAABBBBAA'), a: ['Vikram', 'Anu'], b: ['Yuva', 'Hardesh'] },
    { ...done('BBBBB'), a: ['Sridhar'], b: ['Shashwin'], kind: 'singles' },
  ]);
  const r = rallySummary(t);

  it('adds up each team', () => {
    expect(r.teams.a).toMatchObject({ points: 5 + 6 + 0, longestRun: 5, biggestLead: 4, gamePointsSaved: 0, comebackWins: 1 });
    expect(r.teams.b).toMatchObject({ points: 3 + 4 + 5, longestRun: 5, biggestLead: 5, gamePointsSaved: 4, comebackWins: 0 });
  });

  it('words the highlights with team and player names', () => {
    const h = rallyHighlights(t, r, (id) => id);
    expect(h.find((x) => x.label === 'Longest run')).toEqual({
      label: 'Longest run',
      value: '5 points in a row',
      detail: 'Smashers (Vikram) in M01, 0–3 to 5–3',
    });
    expect(h.find((x) => x.label === 'Biggest comeback')?.detail).toBe('Smashers (Vikram) trailed 0–3 and won M01 5–3');
    expect(h.find((x) => x.label === 'Game points saved')?.detail).toBe('Team B (Yuva & Hardesh) in M02');
    expect(h.find((x) => x.label === 'First to 3')?.value).toBe('Won 2 of 3');
    expect(h.find((x) => x.label === 'Deuce games')?.detail).toBe('M02 6–4');
  });
});

describe('tournament report', () => {
  it('uses team names for the winner and each game’s own target', () => {
    const t = tournament([
      { status: 'completed', scoreA: 15, scoreB: 13, a: ['Vikram', 'Anu'], b: ['Yuva', 'Hardesh'], pointsToWin: 15, maxPoints: 21 },
      { status: 'completed', scoreA: 12, scoreB: 21, a: ['Sridhar'], b: ['Shashwin'], kind: 'singles' },
      { status: 'scheduled', a: ['Vino'], b: ['Yuva'], kind: 'singles' },
    ]);
    const report = tournamentReport(t, (id) => id);
    expect(report.kind).toBe('tournament');
    expect(report.matchCount).toBe(2);
    expect(report.log.map((l) => l.winnerLabel)).toEqual(['Smashers', 'Team B']);
    expect(report.log[0].context).toBe('High-pressure finish (+2)');
    expect(report.subtitle).toContain('Smashers vs Team B');
    // Singles count in the standings; partnerships are doubles only.
    expect(report.standings.map((s) => s.playerId)).toContain('Shashwin');
    expect(report.partnerships.map((p) => p.label)).toEqual(['Anu & Vikram', 'Hardesh & Yuva']);
  });
});
