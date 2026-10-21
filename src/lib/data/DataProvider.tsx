import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { playerPath } from '../slug';
import type { HistorySession, Player, Session } from '../types';
import { DataContext, type DataValue } from './context';
import { toConfig, toHistoryMap, toPlayer, toSession } from './convert';

/**
 * Live listeners shared by every page. A visit costs roughly one read per player plus three:
 * the history cache, the settings and any live session.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [history, setHistory] = useState<Record<string, HistorySession> | null>(null);
  const [config, setConfig] = useState(toConfig(undefined));
  const [liveSessions, setLiveSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onError = (e: Error) => setError(e.message);
    const unsubs = [
      onSnapshot(
        collection(db, 'players'),
        (snap) => setPlayers(snap.docs.map((d) => toPlayer(d.id, d.data()))),
        onError,
      ),
      onSnapshot(doc(db, 'meta', 'history'), (snap) => setHistory(toHistoryMap(snap.data())), onError),
      onSnapshot(doc(db, 'meta', 'config'), (snap) => setConfig(toConfig(snap.data())), onError),
      onSnapshot(
        query(collection(db, 'sessions'), where('status', '==', 'live')),
        (snap) => setLiveSessions(snap.docs.map((d) => toSession(d.id, d.data())).sort((a, b) => b.date.localeCompare(a.date))),
        onError,
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const value = useMemo<DataValue>(() => {
    const list = [...(players ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    const byId = new Map(list.map((p) => [p.id, p]));
    const paths = new Map(list.map((p) => [p.id, playerPath(list, p.id)]));
    return {
      players: list,
      playersById: byId,
      nameOf: (id) => byId.get(id)?.name ?? 'Unknown',
      pathOf: (id) => paths.get(id) ?? `/players/${id}`,
      history: history ?? {},
      config,
      liveSessions,
      ready: players !== null && history !== null,
      error,
    };
  }, [players, history, config, liveSessions, error]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
