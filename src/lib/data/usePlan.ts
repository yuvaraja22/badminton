import { useMemo } from 'react';
import type { Session } from '../types';
import { sortedMatches } from '../engine/games';
import { recentSessions } from '../engine/alltime';
import { sessionSkills } from '../engine/rating';
import { planQueue, recentPartnerCounts, type QueuePlan } from '../engine/scheduler';
import { useData } from './context';

/** The scheduler's plan for a live session, recomputed whenever the session or history changes. */
export function useQueuePlan(session: Session | null, count = 4): QueuePlan | null {
  // Partner variety looks at recent sessions only, so one tournament doesn't swamp it.
  const { sessionHistory, ratings } = useData();
  return useMemo(() => {
    if (!session || session.status !== 'live') return null;
    return planQueue(
      {
        sessionId: session.id,
        attendees: session.attendees,
        matches: sortedMatches(session),
        nextPick: session.nextPick,
        shuffle: session.shuffle,
        recentPartners: recentPartnerCounts(recentSessions(sessionHistory, session.date, session.id)),
        skills: sessionSkills(session.attendees, ratings),
      },
      count,
    );
  }, [session, sessionHistory, ratings, count]);
}
