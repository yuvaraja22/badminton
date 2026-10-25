import { newId } from '../ids';
import type { Attendee, HistorySession, Match, PlayerId, Session, Team } from '../types';
import { sessionData } from './convert';

/**
 * The backup file: everything an admin can read, as one JSON file (the app's Download backup and the
 * nightly backup write the same thing). Restoring only brings back what is missing.
 */

export const COLLECTIONS = ['players', 'sessions', 'events', 'tournaments', 'meta', 'admins', 'links', 'claims', 'trash'] as const;
/** What a restore can bring back. */
export const RESTORABLE = ['players', 'sessions', 'tournaments', 'events'] as const;
export type Restorable = (typeof RESTORABLE)[number];

export type Docs = Record<string, Record<string, unknown>>;

export interface Backup {
  app: 'badminton-stats';
  version: 2;
  exportedAt: string;
  collections: Partial<Record<(typeof COLLECTIONS)[number], Docs>>;
}

/** What a backup file holds, ready to compare with what's in the app now. */
export interface ParsedBackup {
  exportedAt: string;
  docs: Record<Restorable, Docs>;
}

const strip = (o: Record<string, unknown>) => {
  const { id: _id, ...rest } = o;
  void _id;
  return rest;
};

/** A completed session rebuilt from its compact stats copy (old-style backups had nothing more). */
function sessionFromHistory(id: string, h: HistorySession): Omit<Session, 'id'> {
  const attendees: Record<PlayerId, Attendee> = {};
  h.players.forEach((pid, i) => {
    attendees[pid] = { level: h.levels?.[pid] ?? 3, status: 'available', since: 0, catchUp: [], order: i };
  });
  const matches: Record<string, Match> = {};
  for (const m of h.m) {
    const mid = newId();
    matches[mid] = {
      id: mid,
      number: m.n,
      teamA: m.a as Team,
      teamB: m.b as Team,
      scoreA: m.sa,
      scoreB: m.sb,
      status: m.u ? 'unfinished' : 'completed',
      available: h.players,
      completedAt: null,
    };
  }
  return sessionData({
    id,
    date: h.date,
    title: h.title,
    status: 'completed',
    pointsToWin: h.pointsToWin,
    attendees,
    matches,
    nextPick: null,
    shuffle: 0,
    takeaways: null,
    playerIds: h.players,
    edits: [],
    completedAt: null,
  });
}

/** Read a backup file: this version's, or the older "players + history + tournaments" kind. */
export function parseBackup(text: string): ParsedBackup {
  const raw = JSON.parse(text) as Record<string, unknown>;
  const docs: ParsedBackup['docs'] = { players: {}, sessions: {}, tournaments: {}, events: {} };
  if (raw.app === 'badminton-stats' && raw.collections && typeof raw.collections === 'object') {
    const c = raw.collections as Record<string, Docs | undefined>;
    for (const name of RESTORABLE) docs[name] = c[name] ?? {};
    return { exportedAt: String(raw.exportedAt ?? ''), docs };
  }
  if (Array.isArray(raw.players) && raw.history && typeof raw.history === 'object') {
    for (const p of raw.players as Record<string, unknown>[]) if (typeof p.id === 'string') docs.players[p.id] = strip(p);
    for (const t of (raw.tournaments ?? []) as Record<string, unknown>[]) if (typeof t.id === 'string') docs.tournaments[t.id] = strip(t);
    for (const [id, h] of Object.entries(raw.history as Record<string, HistorySession>)) {
      if (h.kind !== 'tournament' && Array.isArray(h.m)) docs.sessions[id] = sessionFromHistory(id, h) as unknown as Record<string, unknown>;
    }
    return { exportedAt: String(raw.exportedAt ?? ''), docs };
  }
  throw new Error("This doesn't look like a Badminton Stats backup.");
}

