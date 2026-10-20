import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { AppConfig, HistorySession, Player, PlayerId, Session } from '../types';

export interface DataValue {
  players: Player[];
  playersById: Map<PlayerId, Player>;
  nameOf: (id: PlayerId) => string;
  /** Compact copies of all completed sessions (meta/history). */
  history: Record<string, HistorySession>;
  config: AppConfig & { importedKeys: string[] };
  liveSessions: Session[];
  /** Players and history have loaded at least once (from cache or server). */
  ready: boolean;
  error: string | null;
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
