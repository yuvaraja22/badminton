import type { PlannedSession, PlayerId } from '../types';

export interface RsvpLists {
  /** Who has a spot, in the order they said they're in. */
  confirmed: PlayerId[];
  /** Said they're in after the spots ran out, first come first served. */
  waitlist: PlayerId[];
  out: PlayerId[];
  /** Spots taken by confirmed players and their guests. */
  spots: number;
  /** Spots still free (null when there is no limit). */
  left: number | null;
  /** Guests each "in" player is bringing (only those bringing any). */
  guests: Record<PlayerId, number>;
}

/**
 * Who's in, who's waiting and who can't make it. Guests take spots too, and a player's whole party
 * waits if it doesn't fit; someone later whose party does fit still gets the spot.
 */
export function rsvpLists(event: Pick<PlannedSession, 'rsvps' | 'cap'>, known: (id: PlayerId) => boolean = () => true): RsvpLists {
  const entries = Object.entries(event.rsvps).filter(([id]) => known(id));
  const ins = entries.filter(([, r]) => r.status === 'in').sort((a, b) => a[1].at - b[1].at || a[0].localeCompare(b[0]));
  const confirmed: PlayerId[] = [];
  const waitlist: PlayerId[] = [];
  const guests: Record<PlayerId, number> = {};
  let spots = 0;
  for (const [id, r] of ins) {
    const party = 1 + (r.guests ?? 0);
    if (r.guests) guests[id] = r.guests;
    if (event.cap === null || spots + party <= event.cap) {
      confirmed.push(id);
      spots += party;
    } else {
      waitlist.push(id);
    }
  }
  return {
    confirmed,
    waitlist,
    out: entries.filter(([, r]) => r.status === 'out').map(([id]) => id),
    spots,
    left: event.cap === null ? null : Math.max(0, event.cap - spots),
    guests,
  };
}
