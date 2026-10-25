import { useMemo } from 'react';
import type { Lineup, Match, Session } from '../types';
import { sortedMatches } from '../engine/games';
import { recentSessions } from '../engine/alltime';
import { sessionSkills } from '../engine/rating';
import { planQueue, recentPartnerCounts, type QueuePlan } from '../engine/scheduler';
import { useData } from './context';

/** Everything in a session the plan depends on. Scores aren't (fairness counts games, not results). */
interface PlanInputs {
  id: string;
  date: string;
  attendees: Session['attendees'];
  matches: Pick<Match, 'id' | 'number' | 'teamA' | 'teamB' | 'available'>[];
  nextPick: Lineup | null;
  shuffle: number;
}

function planInputs(session: Session): PlanInputs {
  return {
    id: session.id,
    date: session.date,
    attendees: session.attendees,
    matches: sortedMatches(session).map(({ id, number, teamA, teamB, available }) => ({ id, number, teamA, teamB, available })),
    nextPick: session.nextPick,
    shuffle: session.shuffle,
  };
}

/**
 * The scheduler's plan for a live session. It is only worked out again when something it depends on
 * changes, so saving a score or a live point doesn't re-plan (that matters with 10+ players).
 * `checkpoint: false` skips looking ahead for the next "everyone even" point, for cards that don't show it.
 */
export function useQueuePlan(session: Session | null, count = 4, { checkpoint = true }: { checkpoint?: boolean } = {}): QueuePlan | null {
  // Partner variety looks at recent sessions only, so one tournament doesn't swamp it.
  const { sessionHistory, ratings } = useData();
  const key = useMemo(() => (session && session.status === 'live' ? JSON.stringify(planInputs(session)) : null), [session]);
  return useMemo(() => {
    if (!key) return null;
    const s = JSON.parse(key) as PlanInputs;
    return planQueue(
      {
        sessionId: s.id,
        attendees: s.attendees,
        matches: s.matches.map((m) => ({ ...m, scoreA: null, scoreB: null, status: 'completed' })),
        nextPick: s.nextPick,
        shuffle: s.shuffle,
        recentPartners: recentPartnerCounts(recentSessions(sessionHistory, s.date, s.id)),
        skills: sessionSkills(s.attendees, ratings),
      },
      count,
      { checkpoint },
    );
  }, [key, sessionHistory, ratings, count, checkpoint]);
}
