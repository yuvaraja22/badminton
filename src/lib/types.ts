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

/** A session or tournament the admins have scheduled; players RSVP before it starts. */
export interface PlannedSession {
  id: string;
  kind: 'session' | 'tournament';
  /** The tournament's name (sessions get their title when they start). */
  name: string | null;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24h) or null */
  time: string | null;
  note: string | null;
  status: 'planned' | 'started' | 'cancelled';
  /** What it became once started: the session's id, or the tournament's. */
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
  /** Each side's players: two for doubles, one for singles (tournaments). */
  a: PlayerId[];
  b: PlayerId[];
  sa: number | null;
  sb: number | null;
  /** true when the match was stopped early. */
  u?: boolean;
  /** Points to win this game, when it differs from the session's (e.g. a tournament match cut to 15). */
  p?: number;
}

export interface HistorySession {
  /** Absent for sessions; 'tournament' for a finished team tournament counted in the stats. */
  kind?: 'tournament';
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
  /** Two players for doubles, one for singles. */
  teamA: PlayerId[];
  teamB: PlayerId[];
  scoreA: number | null;
  scoreB: number | null;
  status: MatchStatus;
  /** Points to win this game when it differs from its session's. */
  pointsToWin?: number;
}

// ---------------------------------------------------------------- team tournaments

/** The two sides of a team tournament. */
export type TeamKey = 'a' | 'b';
export type TeamColor = 'blue' | 'orange' | 'green' | 'purple' | 'red' | 'teal';

export interface TournamentTeam {
  /** Optional; shown as "Team A" / "Team B" when empty. */
  name: string | null;
  color: TeamColor;
  /** A common player (plays for either side, chosen per match) is in both teams' lists. */
  players: PlayerId[];
}

export type MatchKind = 'doubles' | 'singles';

/** An admin keeping score: account id (to tell phones apart) and first name (to show). */
export interface ScorerInfo {
  id: string;
  name: string;
}
export type TournamentMatchStatus = 'scheduled' | 'live' | 'completed';

export interface TournamentMatch {
  id: string;
  /** Position in the schedule, 1-based (shown as M01, M02…). */
  order: number;
  kind: MatchKind;
  /** Team A's players in this match (one for singles, two for doubles), and Team B's. */
  a: PlayerId[];
  b: PlayerId[];
  /** Tentative start, HH:MM (24h). */
  time: string | null;
  status: TournamentMatchStatus;
  scoreA: number;
  scoreB: number;
  /** One letter per point ("A" or "B") when scored live; drives Undo. Empty when the score was typed in. */
  log: string;
  /** Points at the start of the log that were typed in, not scored live (a typed-in score reopened in the scorer). */
  typedPoints: number;
  /** Who scored it last and when: a soft lock so two phones don't score the same match. */
  scorer: (ScorerInfo & { at: number }) | null;
  /** This game's target when it was changed (e.g. 15 or 10); null means the tournament's 21. */
  pointsToWin: number | null;
  maxPoints: number | null;
  startedAt: number | null;
  completedAt: number | null;
}

export type TournamentStatus = 'upcoming' | 'live' | 'completed';

export interface Tournament {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  status: TournamentStatus;
  /** Every match is one game to pointsToWin, won by 2 points, capped at maxPoints. */
  pointsToWin: number;
  maxPoints: number;
  teams: Record<TeamKey, TournamentTeam>;
  /** Auto-fill for match times: when the first match starts and the minutes per match. */
  schedule: { start: string | null; minutes: number };
  matches: Record<string, TournamentMatch>;
  /** Players who said they're in when the tournament was planned (listed first when picking teams). */
  invited: PlayerId[];
  createdAt?: number;
  updatedAt?: number;
}
