import { describe, expect, it } from 'vitest';
import { lastEditOf, matchChange } from './edits';
import type { Match } from './types';

const match = (patch: Partial<Match> = {}): Match => ({
  id: 'm1',
  number: 5,
  teamA: ['a', 'b'],
  teamB: ['c', 'd'],
  scoreA: 21,
  scoreB: 17,
  status: 'completed',
  available: [],
  ...patch,
});

describe('change history wording', () => {
  it('records a result, a scored-live result and a correction', () => {
    expect(matchChange(match({ status: 'live', scoreA: null, scoreB: null }), match())).toBe('M05 result: 21–17');
    expect(matchChange(match({ status: 'live' }), match({ log: 'AB' }))).toBe('M05 result: 21–17 (scored live)');
    expect(matchChange(match(), match({ scoreA: 17, scoreB: 21 }))).toBe('M05: 21–17 → 17–21');
    expect(matchChange(match(), match({ status: 'unfinished', scoreA: 15, scoreB: 12 }))).toBe('M05: 21–17 → 15–12 (stopped early)');
  });

  it('notes changed players, added matches, and nothing when nothing changed', () => {
    expect(matchChange(match(), match({ teamA: ['a', 'e'] }))).toBe('M05: players changed');
    expect(matchChange(undefined, match())).toBe('Added M05: 21–17');
    expect(matchChange(match(), match())).toBeNull();
  });

  it('finds the latest change to a match', () => {
    const edits = [
      { at: 1, by: 'Yuva', uid: 'u', match: 5, text: 'M05 result: 21–17' },
      { at: 3, by: 'Vino', uid: 'v', match: 5, text: 'M05: 21–17 → 17–21' },
      { at: 2, by: 'Yuva', uid: 'u', match: 6, text: 'M06 result: 21–9' },
    ];
    expect(lastEditOf(edits, 5)?.by).toBe('Vino');
    expect(lastEditOf(edits, 7)).toBeNull();
  });
});
