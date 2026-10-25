import { describe, expect, it } from 'vitest';
import { parseBackup } from './backupFormat';
import { toSession } from './convert';

describe('reading a backup file', () => {
  it('reads this version: everything by collection', () => {
    const b = parseBackup(
      JSON.stringify({
        app: 'badminton-stats',
        version: 2,
        exportedAt: '2026-10-25T10:00:00.000Z',
        collections: { players: { p1: { name: 'Vikram', level: 4 } }, sessions: { s1: { title: 'Sunday', status: 'completed' } }, admins: { 'x@y.z': {} } },
      }),
    );
    expect(b.exportedAt).toBe('2026-10-25T10:00:00.000Z');
    expect(Object.keys(b.docs.players)).toEqual(['p1']);
    expect(Object.keys(b.docs.sessions)).toEqual(['s1']);
    expect(b.docs.tournaments).toEqual({});
  });

  it('rebuilds whole sessions from an older backup (players, stats summary, tournaments)', () => {
    const b = parseBackup(
      JSON.stringify({
        exportedAt: '2026-10-01T00:00:00.000Z',
        players: [{ id: 'p1', name: 'Vikram', level: 4 }],
        history: {
          s1: { date: '2026-09-27', title: 'Sunday Badminton', pointsToWin: 21, players: ['a', 'b', 'c', 'd'], levels: { a: 4 }, m: [{ n: 1, a: ['a', 'b'], b: ['c', 'd'], sa: 21, sb: 17 }] },
        },
        tournaments: [{ id: 't1', name: 'Cup' }],
      }),
    );
    expect(b.docs.players.p1).toEqual({ name: 'Vikram', level: 4 });
    expect(b.docs.tournaments.t1).toEqual({ name: 'Cup' });
    const s = toSession('s1', b.docs.sessions.s1);
    expect(s).toMatchObject({ title: 'Sunday Badminton', status: 'completed', date: '2026-09-27' });
    expect(Object.values(s.matches)).toMatchObject([{ number: 1, teamA: ['a', 'b'], scoreA: 21, scoreB: 17, status: 'completed' }]);
    expect(s.attendees.a.level).toBe(4);
  });

  it('refuses anything else', () => {
    expect(() => parseBackup('{"hello": 1}')).toThrow(/backup/);
    expect(() => parseBackup('not json')).toThrow();
  });
});
