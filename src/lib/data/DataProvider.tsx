import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, doc, onSnapshot, query, where, type FirestoreError } from 'firebase/firestore';
import { computeRatings } from '../engine/rating';
import { tournamentHistory } from '../engine/tournament';
import { db } from '../firebase';
import { playerPath } from '../slug';
import type { HistorySession, PlannedSession, Player, Session, Tournament } from '../types';
import { DataContext, type DataValue } from './context';
import { toConfig, toHistoryMap, toPlanned, toPlayer, toSession, toTournament } from './convert';

/** A listener's failure in plain words (the banner says live updates stopped). */
function explain(e: FirestoreError): string {
  if (e.code === 'permission-denied') return 'the server refused to share the data';
  if (e.code === 'resource-exhausted') return "the app's free daily allowance has run out (it resets overnight)";
  if (e.code === 'unavailable') return "the server can't be reached";
  return e.message;
}

/** Finished tournaments as history entries, keyed by id (what the stats and ratings are built from). */
function finishedHistory(list: Tournament[]): Record<string, HistorySession> {
  const out: Record<string, HistorySession> = {};
  for (const t of list) {
    const h = tournamentHistory(t);
    if (h) out[t.id] = h;
  }
  return out;
}

/**
 * Live listeners shared by every page. A visit costs roughly one read per player plus a few more:
 * the history cache, the settings, any live session and the next planned session.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [history, setHistory] = useState<Record<string, HistorySession> | null>(null);
  const [config, setConfig] = useState(toConfig(undefined));
  const [liveSessions, setLiveSessions] = useState<Session[]>([]);
  const [planned, setPlanned] = useState<PlannedSession[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  // Only changes when a finished tournament does, so live scoring doesn't redo every rating on every point.
  const [tournamentStats, setTournamentStats] = useState<Record<string, HistorySession>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const failed = (what: string) => (e: FirestoreError) => {
      console.error(`Firestore listener failed (${what}):`, e);
      setErrors((x) => ({ ...x, [what]: explain(e) }));
    };
    const fine = (what: string) =>
      setErrors((x) => {
        if (!(what in x)) return x;
        const rest = { ...x };
        delete rest[what];
        return rest;
      });
    let finishedKey: string | null = null;
    const unsubs = [
      onSnapshot(
        collection(db, 'players'),
        (snap) => {
          setPlayers(snap.docs.map((d) => toPlayer(d.id, d.data())));
          fine('players');
        },
        failed('players'),
      ),
      onSnapshot(
        doc(db, 'meta', 'history'),
        (snap) => {
          setHistory(toHistoryMap(snap.data()));
          fine('history');
        },
        failed('history'),
      ),
      onSnapshot(doc(db, 'meta', 'config'), (snap) => setConfig(toConfig(snap.data())), failed('config')),
      onSnapshot(
        query(collection(db, 'sessions'), where('status', '==', 'live')),
        (snap) => {
          setLiveSessions(snap.docs.map((d) => toSession(d.id, d.data())).sort((a, b) => b.date.localeCompare(a.date)));
          fine('sessions');
        },
        failed('sessions'),
      ),
      onSnapshot(
        query(collection(db, 'events'), where('status', '==', 'planned')),
        (snap) =>
          setPlanned(
            snap.docs
              .map((d) => toPlanned(d.id, d.data()))
              .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')),
          ),
        failed('events'),
      ),
      // Team tournaments are few and small; the live one updates point by point while it's scored.
      onSnapshot(
        collection(db, 'tournaments'),
        (snap) => {
          const list = snap.docs
            .map((d) => toTournament(d.id, d.data()))
            .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0));
          setTournaments(list);
          const key = list
            .filter((t) => t.status === 'completed')
            .map((t) => `${t.id}:${t.updatedAt ?? 0}`)
            .join('|');
          if (key !== finishedKey) {
            finishedKey = key;
            setTournamentStats(finishedHistory(list));
          }
          fine('tournaments');
        },
        failed('tournaments'),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [attempt]);

  const retry = useCallback(() => {
    setErrors({});
    setAttempt((a) => a + 1);
  }, []);

  // Finished tournaments count like sessions: one history for every stat and the ratings.
  const allHistory = useMemo(() => ({ ...(history ?? {}), ...tournamentStats }), [history, tournamentStats]);

  // Replaying every game is cheap (well under a millisecond per session) but only redo it when the inputs change.
  const table = useMemo(() => computeRatings(allHistory, players ?? []), [allHistory, players]);

  const value = useMemo<DataValue>(() => {
    const list = [...(players ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    const byId = new Map(list.map((p) => [p.id, p]));
    const paths = new Map(list.map((p) => [p.id, playerPath(list, p.id)]));
    const problems = Object.values(errors);
    return {
      players: list,
      playersById: byId,
      nameOf: (id) => byId.get(id)?.name ?? 'Unknown',
      pathOf: (id) => paths.get(id) ?? `/players/${id}`,
      history: allHistory,
      sessionHistory: history ?? {},
      ratings: table.ratings,
      predictions: table.predictions,
      config,
      liveSessions,
      planned,
      tournaments,
      // Never wait forever: if a listener failed, show what there is (the banner explains).
      ready: (players !== null && history !== null) || problems.length > 0,
      connectionError: problems[0] ?? null,
      retry,
    };
  }, [players, history, allHistory, table, config, liveSessions, planned, tournaments, errors, retry]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
