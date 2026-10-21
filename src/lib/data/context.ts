import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { RatingTable } from '../engine/rating';
import type { AppConfig, HistorySession, PlannedSession, Player, PlayerId, Session } from '../types';

export interface DataValue {
  players: Player[];
  playersById: Map<PlayerId, Player>;
  nameOf: (id: PlayerId) => string;
  /** Profile URL, e.g. /players/vikram */
  pathOf: (id: PlayerId) => string;
  /** Compact copies of all completed sessions (meta/history). */
  history: Record<string, HistorySession>;
  /** OpenSkill ratings replayed from the history. */
  ratings: RatingTable['ratings'];
  config: AppConfig;
  liveSessions: Session[];
  /** Upcoming sessions people can RSVP to, soonest first. */
  planned: PlannedSession[];
  /** Players and history have loaded at least once (from cache or server). */
  ready: boolean;
}

export const DataContext = createContext<DataValue | null>(null);

export function useData(): DataValue {
  const v = useContext(DataContext);
  if (!v) throw new Error('useData must be used inside <DataProvider>');
  return v;
}

export interface AuthValue {
  user: User | null;
  isAdmin: boolean;
  /** The player profile linked to this Google account (null if none). */
  playerId: string | null;
  loading: boolean;
  /** Google sign-in. With the local emulators, pass a test email instead. */
  signIn: (emulatorEmail?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
