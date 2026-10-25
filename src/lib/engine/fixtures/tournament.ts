import type { MatchKind, Tournament, TournamentMatch } from '../../types';

// Seven players: Vikram, Sridhar, Anu on one side, Yuva, Shashwin, Hardesh on the other, Vino on both.
export function tournament(matches: Partial<TournamentMatch>[] = []): Tournament {
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
    invited: [],
    edits: [],
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
          typedPoints: 0,
          scorer: null,
          pointsToWin: null,
          maxPoints: null,
          firstServe: null,
          startedAt: null,
          completedAt: null,
          ...m,
        };
        return [id, match];
      }),
    ),
  };
}
