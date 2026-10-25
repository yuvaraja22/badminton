import type { HistorySession, PlayerId } from '../types';
import { summarizeHistory } from './alltime';
import { historyGames, isCounted, sideOf, sortedHistory, topScore, winnerSide } from './games';
import type { Award } from './seasons';
import type { NameOf } from './stats';

/**
 * Milestones, streaks and attendance for a player's profile, all worked out from the history: game and
 * win counts, wins in a row, MVPs, unbeaten sessions, deuce games won, seasons and months won.
 */

export type MilestoneKind = 'games' | 'wins' | 'streak' | 'mvp' | 'unbeaten' | 'deuce' | 'sessions' | 'season' | 'month';

export interface Milestone {
  kind: MilestoneKind;
  /** "100 games", "5 wins in a row", "Season champion · Oct–Dec 2026". */
  label: string;
  /** When it was reached (the session's date, or the end of the season/month). */
  date: string;
  sessionId: string | null;
}

export interface Streaks {
  /** The run the player is on now: wins or losses in a row (most recent games). */
  current: { result: 'W' | 'L'; length: number } | null;
  /** Their longest run of wins, and when it ended. */
  bestWin: { length: number; date: string } | null;
}

export interface Attendance {
  /** Group sessions they came to (tournaments aside). */
  attended: number;
  /** Group sessions since their first one, theirs included. */
  possible: number;
  rate: number;
  /** Sessions in a row up to the latest one (0 if they missed the latest). */
  streak: number;
}

export interface Achievements {
  milestones: Milestone[];
  streaks: Streaks;
  attendance: Attendance | null;
}

const GAMES = [25, 50, 100, 200, 300, 500, 750, 1000];
const WINS = [10, 25, 50, 100, 200, 300, 500];
const STREAKS = [5, 10, 15, 20];
const MVPS = [1, 5, 10, 25, 50];
const DEUCES = [5, 10, 25, 50];
const SESSIONS = [10, 25, 50, 100, 200];

export interface AchievementExtras {
  /** Session id → its MVP (from summarizeHistory); worked out when not given. */
  mvps?: Map<string, PlayerId | null>;
  seasons?: Award[];
  months?: Award[];
}

export function mvpMap(history: Record<string, HistorySession>, nameOf: NameOf): Map<string, PlayerId | null> {
  return new Map(summarizeHistory(history, nameOf).map((s) => [s.id, s.mvpId]));
}

export function achievements(history: Record<string, HistorySession>, pid: PlayerId, nameOf: NameOf, extras: AchievementExtras = {}): Achievements {
  const mvps = extras.mvps ?? mvpMap(history, nameOf);
  const milestones: Milestone[] = [];
  const reached = (kind: MilestoneKind, label: string, date: string, sessionId: string | null) => milestones.push({ kind, label, date, sessionId });
  let games = 0;
  let wins = 0;
  let deuces = 0;
  let mvpCount = 0;
  let run: { result: 'W' | 'L'; length: number } | null = null;
  let bestWin: Streaks['bestWin'] = null;
  const streaksHit = new Set<number>();
  let sessionsCount = 0;
  const groupSessions: HistorySession[] = [];

  for (const [id, h] of sortedHistory(history)) {
    if (h.kind !== 'tournament') {
      groupSessions.push(h);
      if (h.players.includes(pid)) {
        sessionsCount += 1;
        if (SESSIONS.includes(sessionsCount)) reached('sessions', `${sessionsCount} sessions`, h.date, id);
      }
    }
    let won = 0;
    let lost = 0;
    for (const g of historyGames(id, h)) {
      const side = sideOf(g, pid);
      if (!side || !isCounted(g)) continue;
      const win = winnerSide(g) === side;
      games += 1;
      if (GAMES.includes(games)) reached('games', `${games} games`, h.date, id);
      if (win) {
        wins += 1;
        won += 1;
        if (WINS.includes(wins)) reached('wins', `${wins} wins`, h.date, id);
        if (topScore(g) > (g.pointsToWin ?? h.pointsToWin)) {
          deuces += 1;
          if (DEUCES.includes(deuces)) reached('deuce', `${deuces} deuce games won`, h.date, id);
        }
      } else {
        lost += 1;
      }
      const result = win ? 'W' : 'L';
      run = run && run.result === result ? { result, length: run.length + 1 } : { result, length: 1 };
      if (run.result === 'W') {
        if (!bestWin || run.length > bestWin.length) bestWin = { length: run.length, date: h.date };
        if (STREAKS.includes(run.length) && !streaksHit.has(run.length)) {
          streaksHit.add(run.length);
          reached('streak', `${run.length} wins in a row`, h.date, id);
        }
      }
    }
    if (won >= 4 && lost === 0) reached('unbeaten', `Unbeaten session (${won}-0)`, h.date, id);
    if (mvps.get(id) === pid) {
      mvpCount += 1;
      if (MVPS.includes(mvpCount)) reached('mvp', mvpCount === 1 ? 'First MVP' : `${mvpCount} MVPs`, h.date, id);
    }
  }

  for (const a of extras.seasons ?? []) if (a.final && a.winner.playerId === pid) reached('season', `Season champion · ${a.period.label}`, a.period.to, null);
  for (const a of extras.months ?? []) if (a.final && a.winner.playerId === pid) reached('month', `Player of the Month · ${a.period.label}`, a.period.to, null);

  // Attendance: group sessions from their first one on.
  const first = groupSessions.findIndex((h) => h.players.includes(pid));
  let attendance: Attendance | null = null;
  if (first >= 0) {
    const since = groupSessions.slice(first);
    const attended = since.filter((h) => h.players.includes(pid)).length;
    let streak = 0;
    for (let i = groupSessions.length - 1; i >= 0 && groupSessions[i].players.includes(pid); i--) streak += 1;
    attendance = { attended, possible: since.length, rate: attended / since.length, streak };
  }

  milestones.sort((a, b) => b.date.localeCompare(a.date));
  return { milestones, streaks: { current: run, bestWin }, attendance };
}

export interface RecentMilestone extends Milestone {
  playerId: PlayerId;
}

/** Milestones the given players reached on or after `since`, newest first. */
export function recentMilestones(
  history: Record<string, HistorySession>,
  players: PlayerId[],
  nameOf: NameOf,
  since: string,
  extras: Omit<AchievementExtras, 'mvps'> = {},
): RecentMilestone[] {
  const mvps = mvpMap(history, nameOf);
  return players
    .flatMap((playerId) => achievements(history, playerId, nameOf, { ...extras, mvps }).milestones.filter((m) => m.date >= since).map((m) => ({ ...m, playerId })))
    .sort((a, b) => b.date.localeCompare(a.date) || nameOf(a.playerId).localeCompare(nameOf(b.playerId)));
}
