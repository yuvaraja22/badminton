import type { Lineup, Match, PlayerId, Session } from './types';

export interface LineupOption {
  id: PlayerId;
  label: string;
  level: number;
}

/** Session players for the lineup pickers, e.g. "Anu (3.5)" or "Yuva (4.0) – resting". */
export function lineupOptions(session: Session, nameOf: (id: PlayerId) => string, onlyAvailable = false): LineupOption[] {
  return Object.entries(session.attendees)
    .filter(([, a]) => !onlyAvailable || a.status === 'available')
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([id, a]) => ({
      id,
      level: a.level,
      label: `${nameOf(id)} (${a.level.toFixed(1)})${a.status === 'available' ? '' : a.status === 'resting' ? ' – resting' : ' – left'}`,
    }));
}

export function lineupComplete(l: Lineup): boolean {
  const ids = [...l.teamA, ...l.teamB];
  return ids.every(Boolean) && new Set(ids).size === 4;
}

export type ScoreCheck = { ok: true; scoreA: number | null; scoreB: number | null } | { ok: false; message: string };

/** Parse the two score boxes. Final results need two different numbers; stopped-early games may be blank or level. */
export function checkScores(a: string, b: string, status: Match['status']): ScoreCheck {
  const parse = (v: string) => (v.trim() === '' ? null : Number(v));
  const scoreA = parse(a);
  const scoreB = parse(b);
  for (const v of [scoreA, scoreB]) {
    if (v !== null && (!Number.isInteger(v) || v < 0 || v > 99)) return { ok: false, message: 'Scores must be whole numbers from 0 to 99.' };
  }
  if (status === 'completed') {
    if (scoreA === null || scoreB === null) return { ok: false, message: 'Enter both scores.' };
    if (scoreA === scoreB) return { ok: false, message: "A finished game can't be a draw. Tick “Stopped early” if it wasn't completed." };
  }
  return { ok: true, scoreA, scoreB };
}
