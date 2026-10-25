import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { RatingTable } from '../engine/rating';
import type { AppConfig, HistorySession, LinkClaim, PlannedSession, Player, PlayerId, Session, Tournament } from '../types';

export interface DataValue {
  players: Player[];
  playersById: Map<PlayerId, Player>;
  nameOf: (id: PlayerId) => string;
  /** Profile URL, e.g. /players/vikram */
  pathOf: (id: PlayerId) => string;
  /** Every completed session (meta/history) plus every finished tournament: what all stats are built from. */
  history: Record<string, HistorySession>;
  /** Sessions only (meta/history): the Sessions list, the latest report, the planner's partner variety. */
  sessionHistory: Record<string, HistorySession>;
  /** OpenSkill ratings replayed from the history. */
  ratings: RatingTable['ratings'];
  /** The win chance the ratings gave every rated game before it was played (how good the predictions are). */
  predictions: RatingTable['predictions'];
  config: AppConfig;
  liveSessions: Session[];
  /** Upcoming sessions people can RSVP to, soonest first. */
  planned: PlannedSession[];
  /** Team tournaments, newest first (null until loaded). */
  tournaments: Tournament[] | null;
  /** Players and history have loaded at least once (from cache or server), or loading failed. */
  ready: boolean;
  /** Why live updates stopped, in plain words (null while all is well). */
  connectionError: string | null;
  /** Reconnect every listener after a failure. */
  retry: () => void;
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
  /** This account's pending "This is me" request, if any. */
  claim: LinkClaim | null;
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
