import type { GameRecord, HistorySession, PlayerId, Session } from '../types';
import { historyGames, isCounted, sideOf, sortedHistory } from './games';
import {
  computePartnerships,
  computeStandings,
  opponentsOf,
  partnersOf,
  recentForm,
  type NameOf,
  type PairLine,
  type PlayerLine,
  type RelationLine,
} from './stats';

export interface SessionSummary {
  id: string;
  date: string;
  title: string;
  matchCount: number;
  playerIds: PlayerId[];
  standings: PlayerLine[];
  /** Top of the session table (null if nobody qualified with a win). */
  mvpId: PlayerId | null;
}

export function summarizeSession(id: string, h: HistorySession, nameOf: NameOf): SessionSummary {
  const games = historyGames(id, h);
  const standings = computeStandings(games, nameOf);
  const top = standings[0];
  return {
    id,
    date: h.date,
    title: h.title,
    matchCount: games.filter(isCounted).length,
    playerIds: h.players,
    standings,
    mvpId: top && top.qualified && top.won > 0 ? top.playerId : null,
  };
}

/** Newest first. */
export function summarizeHistory(history: Record<string, HistorySession>, nameOf: NameOf): SessionSummary[] {
  return sortedHistory(history)
    .map(([id, h]) => summarizeSession(id, h, nameOf))
    .reverse();
}

export interface DateRange {
  from?: string;
  to?: string;
}

function inRange(date: string, range: DateRange): boolean {
  return (!range.from || date >= range.from) && (!range.to || date <= range.to);
}

export interface AllTimeLine extends PlayerLine {
  sessions: number;
  mvps: number;
}

export function allTimeStats(
  history: Record<string, HistorySession>,
  nameOf: NameOf,
  opts: DateRange & { minGames?: number } = {},
): { standings: AllTimeLine[]; partnerships: PairLine[]; games: GameRecord[]; sessionCount: number } {
  const entries = sortedHistory(history).filter(([, h]) => inRange(h.date, opts));
  const games = entries.flatMap(([id, h]) => historyGames(id, h));
  const sessions = new Map<PlayerId, number>();
  const mvps = new Map<PlayerId, number>();
  for (const [id, h] of entries) {
    const played = new Set(historyGames(id, h).filter(isCounted).flatMap((g) => [...g.teamA, ...g.teamB]));
    for (const p of played) sessions.set(p, (sessions.get(p) ?? 0) + 1);
    const mvp = summarizeSession(id, h, nameOf).mvpId;
    if (mvp) mvps.set(mvp, (mvps.get(mvp) ?? 0) + 1);
  }
  const counts = new Map<PlayerId, number>();
  for (const g of games) if (isCounted(g)) for (const p of [...g.teamA, ...g.teamB]) counts.set(p, (counts.get(p) ?? 0) + 1);
  const maxPlayed = Math.max(0, ...counts.values());
  const minGames = opts.minGames ?? Math.min(10, Math.ceil(maxPlayed / 2));
  const standings = computeStandings(games, nameOf, { minGames }).map((l) => ({
    ...l,
    sessions: sessions.get(l.playerId) ?? 0,
    mvps: mvps.get(l.playerId) ?? 0,
  }));
  return { standings, partnerships: computePartnerships(games, nameOf), games, sessionCount: entries.length };
}

export interface PlayerSessionLine {
  id: string;
  date: string;
  title: string;
  won: number;
  lost: number;
  diff: number;
  winRate: number;
  rank: number;
  of: number;
  mvp: boolean;
}

export interface PlayerProfile {
  line: PlayerLine | null;
  sessions: PlayerSessionLine[];
  partners: RelationLine[];
  opponents: RelationLine[];
  form: ('W' | 'L')[];
  recent: (GameRecord & { title: string })[];
  firstDate: string | null;
  mvps: number;
}

export function playerProfile(history: Record<string, HistorySession>, nameOf: NameOf, pid: PlayerId): PlayerProfile {
  const entries = sortedHistory(history);
  const games = entries.flatMap(([id, h]) => historyGames(id, h));
  const titles = new Map(entries.map(([id, h]) => [id, h.title]));
  const sessions: PlayerSessionLine[] = [];
  for (const [id, h] of entries) {
    const summary = summarizeSession(id, h, nameOf);
    const idx = summary.standings.findIndex((l) => l.playerId === pid);
    if (idx < 0) continue;
    const l = summary.standings[idx];
    sessions.push({
      id,
      date: h.date,
      title: h.title,
      won: l.won,
      lost: l.lost,
      diff: l.diff,
      winRate: l.winRate,
      rank: idx + 1,
      of: summary.standings.length,
      mvp: summary.mvpId === pid,
    });
  }
  const mine = games.filter((g) => isCounted(g) && sideOf(g, pid));
  return {
    line: computeStandings(mine, nameOf, { minGames: 0 }).find((l) => l.playerId === pid) ?? null,
    sessions: sessions.reverse(),
    partners: partnersOf(mine, pid),
    opponents: opponentsOf(mine, pid),
    form: recentForm(mine, pid, 10),
    recent: mine
      .slice(-10)
      .reverse()
      .map((g) => ({ ...g, title: titles.get(g.sessionId) ?? '' })),
    firstDate: sessions.at(-1)?.date ?? null,
    mvps: sessions.filter((s) => s.mvp).length,
  };
}

/** Players whose first session with the group is this one (none for the group's very first session). */
export function newPlayersFor(
  session: Pick<Session, 'id' | 'date' | 'playerIds'>,
  history: Record<string, HistorySession>,
): Set<PlayerId> {
  const prior = Object.entries(history).filter(([id, h]) => id !== session.id && h.date < session.date);
  if (!prior.length) return new Set();
  const seen = new Set(prior.flatMap(([, h]) => h.players));
  return new Set(session.playerIds.filter((p) => !seen.has(p)));
}

/** Completed sessions before this one, most recent first (used to vary partners week to week). */
export function recentSessions(history: Record<string, HistorySession>, date: string, sessionId: string, count = 4): HistorySession[] {
  return sortedHistory(history)
    .filter(([id, h]) => id !== sessionId && h.date <= date)
    .slice(-count)
    .map(([, h]) => h);
}
