import { describe, expect, it } from 'vitest';
import { toPlanned } from '../data/convert';
import { rsvpLists } from './rsvp';

const event = (cap: number | null, rsvps: Record<string, { status: 'in' | 'out'; at: number; guests?: number }>) => ({ cap, rsvps });

describe('who has a spot', () => {
  it('lets everyone in without a limit, in the order they answered', () => {
    const l = rsvpLists(event(null, { b: { status: 'in', at: 2 }, a: { status: 'in', at: 1 }, c: { status: 'out', at: 3 } }));
    expect(l.confirmed).toEqual(['a', 'b']);
    expect(l.waitlist).toEqual([]);
    expect(l.out).toEqual(['c']);
    expect(l.left).toBeNull();
  });

  it('puts later answers on a waitlist once the spots are gone, guests included', () => {
    const l = rsvpLists(
      event(4, {
        a: { status: 'in', at: 1, guests: 1 },
        b: { status: 'in', at: 2 },
        c: { status: 'in', at: 3, guests: 1 }, // needs 2, only 1 left
        d: { status: 'in', at: 4 }, // fits the last spot
        e: { status: 'in', at: 5 },
      }),
    );
    expect(l.confirmed).toEqual(['a', 'b', 'd']);
    expect(l.waitlist).toEqual(['c', 'e']);
    expect(l.spots).toBe(4);
    expect(l.left).toBe(0);
    expect(l.guests).toEqual({ a: 1, c: 1 });
  });

  it('moves the waitlist up when someone drops out', () => {
    const before = { a: { status: 'in' as const, at: 1 }, b: { status: 'in' as const, at: 2 }, c: { status: 'in' as const, at: 3 } };
    expect(rsvpLists(event(2, before)).waitlist).toEqual(['c']);
    expect(rsvpLists(event(2, { ...before, a: { status: 'out', at: 9 } })).confirmed).toEqual(['b', 'c']);
  });

  it('skips players who no longer exist', () => {
    expect(rsvpLists(event(null, { gone: { status: 'in', at: 1 }, a: { status: 'in', at: 2 } }), (id) => id !== 'gone').confirmed).toEqual(['a']);
  });
});

describe('reading a plan', () => {
  it('fills in the limit, the weekly repeat and sensible guests', () => {
    const p = toPlanned('e1', {
      date: '2026-11-01',
      status: 'planned',
      cap: 8,
      repeat: 'weekly',
      rsvps: { a: { status: 'in', at: 1, guests: 2 }, b: { status: 'in', at: 2, guests: 9 }, c: { status: 'out', at: 3, guests: 1 }, d: { status: 'maybe' } },
    });
    expect(p.cap).toBe(8);
    expect(p.repeat).toBe('weekly');
    expect(p.rsvps).toEqual({ a: { status: 'in', at: 1, guests: 2 }, b: { status: 'in', at: 2, guests: 3 }, c: { status: 'out', at: 3 } });
    expect(toPlanned('e2', { date: '2026-11-01' })).toMatchObject({ cap: null, repeat: null, rsvps: {} });
  });
});
