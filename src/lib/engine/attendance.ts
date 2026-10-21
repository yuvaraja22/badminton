import type { Attendee, AttendeeStatus, PlayerId } from '../types';

/**
 * Leaving early. An attendee may set `leaveAfter`, the last match number they can play. Their stored
 * status stays "available" and they count as left from the match after it, so nothing has to be written
 * when they go, and clearing `leaveAfter` brings them straight back (joining fairly).
 */

type Presence = Pick<Attendee, 'status' | 'leaveAfter'>;

/** Whether a session player can be put in match number `n`. */
export function isAvailableFor(a: Presence, n: number): boolean {
  return a.status === 'available' && (a.leaveAfter == null || n <= a.leaveAfter);
}

/** Players who can be put in match number `n`, sorted so every phone plans the same matches. */
export function availableAt(attendees: Record<PlayerId, Presence>, n: number): PlayerId[] {
  return Object.entries(attendees)
    .filter(([, a]) => isAvailableFor(a, n))
    .map(([id]) => id)
    .sort();
}

/** Status as of match `n` (usually the next one): a planned departure that has passed counts as left. */
export function statusAt(a: Presence, n: number): AttendeeStatus {
  return a.status === 'available' && a.leaveAfter != null && n > a.leaveAfter ? 'left' : a.status;
}

/** The last match before they went away: when they rested or left, or their planned last match. */
export function awaySince(a: Presence & Pick<Attendee, 'since'>): number {
  return a.status === 'available' && a.leaveAfter != null ? Math.max(a.since, a.leaveAfter) : a.since;
}

/**
 * Rest / leave / come back. Coming back with "catch up" credits the matches missed while away, including
 * after a planned departure. Leaving now, or coming back once a planned departure has passed, clears it.
 */
export function withStatus(
  a: Attendee,
  status: AttendeeStatus,
  mode: 'fair' | 'catchUp',
  last: number,
): Pick<Attendee, 'status' | 'since' | 'catchUp' | 'leaveAfter'> {
  const away = awaySince(a);
  const back = status === 'available' && statusAt(a, last + 1) !== 'available';
  const catchUp = back && mode === 'catchUp' && last > away ? [...a.catchUp, { from: away + 1, to: last }] : a.catchUp;
  const passed = a.leaveAfter != null && a.leaveAfter <= last;
  const leaveAfter = status === 'left' || (status === 'available' && passed) ? null : (a.leaveAfter ?? null);
  return { status, since: last, catchUp, leaveAfter };
}
