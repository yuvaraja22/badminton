import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { playerPath } from '../slug';
import type { HistorySession, PlannedSession, Player, Session } from '../types';
import { DataContext, type DataValue } from './context';
import { toConfig, toHistoryMap, toPlanned, toPlayer, toSession } from './convert';

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

  useEffect(() => {
    const onError = (e: Error) => console.error('Firestore listener failed:', e);
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
      onSnapshot(
        query(collection(db, 'events'), where('status', '==', 'planned')),
        (snap) =>
          setPlanned(
            snap.docs
              .map((d) => toPlanned(d.id, d.data()))
              .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')),
          ),
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
      planned,
      ready: players !== null && history !== null,
    };
  }, [players, history, config, liveSessions, planned]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
