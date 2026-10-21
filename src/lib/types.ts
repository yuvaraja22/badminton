export type PlayerId = string;
export type Team = [PlayerId, PlayerId];

export type Hand = 'left' | 'right';
export type CourtPosition = 'front' | 'back' | 'both';

export interface Player {
  id: PlayerId;
  name: string;
  /** Skill level 1–5.5 in 0.5 steps (Amateur Low … Professional High); default for new sessions. */
  level: number;
  active: boolean;
  /** Small inline JPEG data URL (no Firebase Storage needed). */
  photo?: string | null;
  /** Set by the player (once linked) or an admin. */
  bio?: string | null;
  hand?: Hand | null;
  position?: CourtPosition | null;
  racket?: string | null;
  createdAt?: number;
}

/** Fields a linked player may change on their own profile (also enforced by firestore.rules). */
export type OwnProfileFields = Pick<Player, 'name' | 'photo' | 'bio' | 'hand' | 'position' | 'racket'>;

export const PROFILE_LIMITS = { name: 30, bio: 160, racket: 40 } as const;

export type RsvpStatus = 'in' | 'out';

/** A session the admins have scheduled; players RSVP before it starts. */
export interface PlannedSession {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24h) or null */
  time: string | null;
  note: string | null;
  status: 'planned' | 'started' | 'cancelled';
  sessionId: string | null;
  rsvps: Record<PlayerId, { status: RsvpStatus; at: number }>;
  createdAt?: number;
}

/** live = being played now, completed = final score, unfinished = stopped early (excluded from stats). */
export type MatchStatus = 'live' | 'completed' | 'unfinished';

export interface Match {
  id: string;
  number: number;
  teamA: Team;
  teamB: Team;
  scoreA: number | null;
  scoreB: number | null;
  status: MatchStatus;
  /** Players who were available when the match was created (used for fair-share accounting). */
  available: PlayerId[];
  createdAt?: number;
  completedAt?: number | null;
}

export type AttendeeStatus = 'available' | 'resting' | 'left';

/** Matches (inclusive, by number) a player is credited for as if present ("Catch up"). */
export interface CatchUpWindow {
  from: number;
  to: number;
}

export interface Attendee {
  level: number;
  status: AttendeeStatus;
  /** Highest match number that existed when the status last changed. */
  since: number;
  catchUp: CatchUpWindow[];
  /** Display order within the session. */
  order: number;
  /** An admin set this level for the session: balance by it instead of the player's skill rating. */
  levelOverride?: boolean;
}

export interface Lineup {
  teamA: Team;
  teamB: Team;
}

export type SessionStatus = 'live' | 'completed';

export interface Session {
  id: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
  title: string;
  status: SessionStatus;
  pointsToWin: number;
  attendees: Record<PlayerId, Attendee>;
  matches: Record<string, Match>;
  /** Admin's manual lineup for the next match, or null to use the scheduler's suggestion. */
  nextPick: Lineup | null;
  /** Cycles through alternative suggestions for the next match. */
  shuffle: number;
  /** Saved (possibly edited) takeaways; null means "generate automatically". */
  takeaways: string[] | null;
  playerIds: PlayerId[];
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number | null;
}

/** Compact copy of a completed session, stored in meta/history so all-time stats cost one read. */
export interface HistoryMatch {
  n: number;
  a: Team;
  b: Team;
  sa: number | null;
  sb: number | null;
  /** true when the match was stopped early. */
  u?: boolean;
}

export interface HistorySession {
  date: string;
  title: string;
  pointsToWin: number;
  players: PlayerId[];
  levels: Record<PlayerId, number>;
  m: HistoryMatch[];
}

export interface AppConfig {
  /** Appended to the weekday for session titles, e.g. "Sunday Badminton Tournament". */
  groupName: string;
  pointsToWin: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  groupName: 'Badminton Tournament',
  pointsToWin: 21,
};

/** A single game in a normalized form, shared by every stats calculation. */
export interface GameRecord {
  sessionId: string;
  date: string;
  number: number;
  teamA: Team;
  teamB: Team;
  scoreA: number | null;
  scoreB: number | null;
  status: MatchStatus;
}
