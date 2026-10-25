import { deleteDoc, deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { addDaysISO, todayISO } from '../../format';
import type { PlannedSession, PlayerId, Rsvp, RsvpStatus } from '../../types';
import { eventsCol, run } from './core';

type PlanInput = Pick<PlannedSession, 'kind' | 'name' | 'date' | 'time' | 'note' | 'cap' | 'repeat'>;

/** Plan the next session or tournament, so players can say whether they're coming. */
export function planSession(input: PlanInput): string {
  const ref = doc(eventsCol);
  run(
    setDoc(ref, { ...input, status: 'planned', sessionId: null, rsvps: {}, createdAt: Date.now() }),
    input.kind === 'tournament' ? 'Planning the tournament' : 'Planning the session',
  );
  return ref.id;
}

export function updatePlannedSession(id: string, patch: PlanInput) {
  run(updateDoc(doc(eventsCol, id), patch), 'Saving the plan');
}

export function cancelPlannedSession(id: string) {
  run(deleteDoc(doc(eventsCol, id)), 'Cancelling the session');
}

/** A weekly session that isn't happening this time: the same plan a week later, with fresh answers. */
export function skipPlannedWeek(event: PlannedSession) {
  run(updateDoc(doc(eventsCol, event.id), { date: addDaysISO(event.date, 7), rsvps: {} }), 'Skipping this week');
}

/**
 * Weekly plans whose day went by without being started move on to their next date (fresh answers),
 * so the next one is always there to answer. Run from an admin's phone.
 */
export function rollWeeklyPlans(planned: PlannedSession[]) {
  const today = todayISO();
  for (const e of planned) {
    if (e.repeat !== 'weekly' || e.status !== 'planned' || !e.date || e.date >= today) continue;
    let date = e.date;
    while (date < today) date = addDaysISO(date, 7);
    run(updateDoc(doc(eventsCol, e.id), { date, rsvps: {} }), 'Moving the weekly session on');
  }
}

/**
 * "I'm in" / "Can't make it" (null clears the answer), with any guests they're bringing. Changing only
 * the number of guests keeps their place in the queue.
 */
export function setRsvp(eventId: string, playerId: PlayerId, status: RsvpStatus | null, guests = 0, previous: Rsvp | null = null) {
  const at = previous && previous.status === status ? previous.at : Date.now();
  const value = status ? { status, at, ...(status === 'in' && guests > 0 ? { guests } : {}) } : deleteField();
  run(updateDoc(doc(eventsCol, eventId), { [`rsvps.${playerId}`]: value }), 'Saving your answer');
}

/** The plan became a session or tournament. A weekly plan is planned again for a week later. */
export function markPlannedStarted(event: PlannedSession, sessionId: string) {
  const batch = writeBatch(db);
  batch.update(doc(eventsCol, event.id), { status: 'started', sessionId });
  if (event.repeat === 'weekly') {
    batch.set(doc(eventsCol), {
      kind: event.kind,
      name: event.name,
      date: addDaysISO(event.date < todayISO() ? todayISO() : event.date, 7),
      time: event.time,
      note: event.note,
      cap: event.cap,
      repeat: 'weekly',
      status: 'planned',
      sessionId: null,
      rsvps: {},
      createdAt: Date.now(),
    });
  }
  run(batch.commit(), 'Updating the planned session');
}
