import { describe, expect, it } from 'vitest';
import type { Attendee } from '../types';
import { leaveChoices, lineupOptions } from '../lineup';
import type { Session } from '../types';
import { availableAt, awaySince, isAvailableFor, statusAt, withStatus } from './attendance';

const a = (extra: Partial<Attendee> = {}): Attendee => ({ level: 3, status: 'available', since: 0, catchUp: [], order: 0, ...extra });

describe('leaving early', () => {
  it('counts someone as gone from the match after their last one', () => {
    expect(isAvailableFor(a({ leaveAfter: 5 }), 5)).toBe(true);
    expect(isAvailableFor(a({ leaveAfter: 5 }), 6)).toBe(false);
    expect(isAvailableFor(a({ leaveAfter: null }), 99)).toBe(true);
    expect(isAvailableFor(a({ status: 'resting', leaveAfter: 5 }), 3)).toBe(false);
    expect(statusAt(a({ leaveAfter: 5 }), 5)).toBe('available');
    expect(statusAt(a({ leaveAfter: 5 }), 6)).toBe('left');
    expect(statusAt(a({ status: 'resting', leaveAfter: 5 }), 6)).toBe('resting');
  });

  it('lists who can play a match, sorted', () => {
    const attendees = { B: a(), A: a({ leaveAfter: 1 }), C: a({ status: 'left' }), D: a({ status: 'resting' }) };
    expect(availableAt(attendees, 1)).toEqual(['A', 'B']);
    expect(availableAt(attendees, 2)).toEqual(['B']);
  });

  it('knows since when someone has been away', () => {
    expect(awaySince(a({ since: 2, leaveAfter: 6 }))).toBe(6);
    expect(awaySince(a({ status: 'resting', since: 4, leaveAfter: 9 }))).toBe(4);
    expect(awaySince(a({ status: 'left', since: 3 }))).toBe(3);
  });
});

describe('changing status around a planned departure', () => {
  it('coming back after it has passed clears it, and can catch up from their last match', () => {
    const gone = a({ since: 0, leaveAfter: 4 });
    expect(withStatus(gone, 'available', 'catchUp', 7)).toEqual({ status: 'available', since: 7, catchUp: [{ from: 5, to: 7 }], leaveAfter: null });
    expect(withStatus(gone, 'available', 'fair', 7)).toMatchObject({ catchUp: [], leaveAfter: null });
  });

  it('leaving now clears it; resting keeps one still to come', () => {
    expect(withStatus(a({ leaveAfter: 9 }), 'left', 'fair', 3).leaveAfter).toBeNull();
    expect(withStatus(a({ leaveAfter: 9 }), 'resting', 'fair', 3).leaveAfter).toBe(9);
    expect(withStatus(a({ status: 'resting', since: 2, leaveAfter: 9 }), 'available', 'catchUp', 3)).toMatchObject({
      catchUp: [{ from: 3, to: 3 }],
      leaveAfter: 9,
    });
    expect(withStatus(a({ status: 'resting', since: 2, leaveAfter: 5 }), 'available', 'fair', 6).leaveAfter).toBeNull();
  });
});

describe('leave choices', () => {
  it('runs from the current match to fifteen after it', () => {
    const live = leaveChoices(7, true, null);
    expect(live[0]).toEqual({ value: 7, label: 'After M07 (current match)' });
    expect(live[1]).toEqual({ value: 8, label: 'After M08 (next match)' });
    expect(live.at(-1)!.value).toBe(22);
    expect(leaveChoices(7, false, null)[0]).toEqual({ value: 7, label: 'Now (no more games)' });
    expect(leaveChoices(0, false, null)[0]).toEqual({ value: 1, label: 'After M01 (next match)' });
  });

  it('keeps a departure that has already happened', () => {
    const choices = leaveChoices(9, true, 5);
    expect(choices[0]).toEqual({ value: 5, label: 'After M05 (left)' });
    expect(choices[1].value).toBe(9);
  });

  it('leaves someone who has gone out of the next lineup', () => {
    const session = {
      matches: { m1: { id: 'm1', number: 1, teamA: ['A', 'B'], teamB: ['C', 'D'], scoreA: 21, scoreB: 9, status: 'completed', available: [] } },
      attendees: { A: a({ order: 0, leaveAfter: 1 }), B: a({ order: 1 }) },
    } as unknown as Session;
    expect(lineupOptions(session, (id) => id, true).map((o) => o.id)).toEqual(['B']);
    expect(lineupOptions(session, (id) => id).map((o) => o.label)).toEqual(['A · Intermediate Low – left', 'B · Intermediate Low']);
  });
});

