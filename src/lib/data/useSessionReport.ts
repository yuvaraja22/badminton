import { useMemo } from 'react';
import { newPlayersFor } from '../engine/alltime';
import { sessionGames } from '../engine/games';
import { buildReport, type SessionReport } from '../engine/report';
import type { Session } from '../types';
import { useData } from './context';

export function useSessionReport(session: Session): SessionReport {
  const { nameOf, history } = useData();
  return useMemo(
    () =>
      buildReport({
        title: session.title,
        date: session.date,
        pointsToWin: session.pointsToWin,
        games: sessionGames(session),
        nameOf,
        newPlayers: newPlayersFor(session, history),
      }),
    [session, nameOf, history],
  );
}
