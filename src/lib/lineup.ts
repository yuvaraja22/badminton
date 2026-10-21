import { isAvailableFor, statusAt } from './engine/attendance';
import { lastMatchNumber } from './engine/games';
import { matchCode, oneDecimal } from './format';
import { levelName } from './levels';
import type { Lineup, Match, PlayerId, Session } from './types';

export interface LineupOption {
  id: PlayerId;
  label: string;
  level: number;
}

/**
 * Session players for the lineup pickers, e.g. "Anu · Intermediate High", "Vikram · Rating 4.7" or
 * "Yuva · Advanced Low – resting". `skills` (from the queue plan) replaces the session level, as the scheduler does.
 */
export function lineupOptions(
  session: Session,
  nameOf: (id: PlayerId) => string,
  onlyAvailable = false,
  skills?: Record<PlayerId, number>,
): LineupOption[] {
  const next = lastMatchNumber(session) + 1;
  return Object.entries(session.attendees)
    .filter(([, a]) => !onlyAvailable || isAvailableFor(a, next))
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([id, a]) => {
      const level = skills?.[id] ?? a.level;
      const shown = level !== a.level ? `Rating ${oneDecimal(level)}` : levelName(a.level);
      const status = statusAt(a, next);
      return { id, level, label: `${nameOf(id)} · ${shown}${status === 'available' ? '' : status === 'resting' ? ' – resting' : ' – left'}` };
    });
}

export interface LeaveChoice {
  value: number;
  label: string;
}

/**
 * Leaving early: choices for the last match someone can play, from the latest match (`last`, being
 * played when `live`) to fifteen after it. A departure already set outside that range stays a choice.
 */
export function leaveChoices(last: number, live: boolean, current: number | null): LeaveChoice[] {
  const first = Math.max(1, last);
  const out: LeaveChoice[] = [];
  for (let n = first; n <= last + 15; n++) {
    const code = matchCode(n);
    const label = n === last ? (live ? `After ${code} (current match)` : 'Now (no more games)') : n === last + 1 ? `After ${code} (next match)` : `After ${code}`;
    out.push({ value: n, label });
  }
  if (current !== null && !out.some((c) => c.value === current)) {
    out.push({ value: current, label: `After ${matchCode(current)}${current < first ? ' (left)' : ''}` });
    out.sort((x, y) => x.value - y.value);
  }
  return out;
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
