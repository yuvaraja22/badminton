import { predictWin, rate, rating as newRating, type Rating } from 'openskill';
import { MAX_LEVEL, MIN_LEVEL } from '../levels';
import type { Attendee, HistorySession, Player, PlayerId, Team } from '../types';
import { historyGames, isCounted, sortedHistory } from './games';

/**
 * Doubles skill ratings (OpenSkill, Weng–Lin Plackett–Luce), replayed from the full history.
 *
 * Ratings are never stored: every device rebuilds them from meta/history in date order, so they are
 * reproducible and editing or deleting a past session simply changes the replay.
 *
 * - Seeded from the level a player had in their first session (1 level = 8 μ, level 3 = μ 25).
 * - Each completed game updates all four players. The update is scaled by the winning margin
 *   (relative to the game length), so a 21-8 win counts more than 23-21.
 * - Uncertainty (σ) shrinks as a player plays and grows again while they are away.
 * - Shown on the familiar level scale (μ converted back to 1–5.5).
 */

/** μ per level (1 = Amateur Low … 5.5 = Professional High), and the μ of a level-3 (Intermediate Low) player. */
const MU_PER_LEVEL = 8;
const MU_AT_LEVEL_3 = 25;
/** Starting uncertainty (default OpenSkill is 25/3): lower, since admins set the starting level by hand. */
export const SEED_SIGMA = 6;
/** σ added per week away (as variance: σ² += DRIFT² · weeks), capped at SEED_SIGMA. */
const DRIFT_PER_WEEK = 0.6;
/** Margin scaling: a margin of MARGIN_UNIT points (in a game to 21) is a normal-sized update. */
const MARGIN_UNIT = 7;
const MARGIN_MIN = 0.6;
const MARGIN_MAX = 1.4;
/** Games before a rating is trusted for team balancing and ranked on the board. */
export const PROVISIONAL_GAMES = 8;

export interface RatingPoint {
  /** null for the starting point (the level the rating was seeded from). */
  sessionId: string | null;
  date: string;
  title: string;
  /** Rating after this session, on the level scale. */
  level: number;
  /** Change over this session. */
  change: number;
  /** Rated games played up to and including this session. */
  games: number;
}

export interface PlayerRating {
  playerId: PlayerId;
  mu: number;
  sigma: number;
  /** μ on the level scale (1–5.5), unrounded. */
  level: number;
  /** Level the rating was seeded from. */
  seedLevel: number;
  games: number;
  provisional: boolean;
  /** Change in level over the player's most recent session (from the seed level after a first session). */
  lastChange: number;
  lastDate: string | null;
  /** The starting point, then the rating after each session played, oldest first. */
  history: RatingPoint[];
  /** Highest rating after a session once established (null while provisional). */
  peak: number | null;
}

export interface GamePrediction {
  sessionId: string;
  number: number;
  /** Predicted chance that team A wins, before the game was rated. */
  pA: number;
  aWon: boolean;
}

export interface RatingTable {
  ratings: Map<PlayerId, PlayerRating>;
  /** Pre-game predictions for every rated game, oldest first (for calibration checks). */
  predictions: GamePrediction[];
}

export function levelToMu(level: number): number {
  return MU_AT_LEVEL_3 + (level - 3) * MU_PER_LEVEL;
}

/** μ on the level scale (1–5.5). */
export function muToLevel(mu: number): number {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, 3 + (mu - MU_AT_LEVEL_3) / MU_PER_LEVEL));
}

function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

/** Scale of the rating update for a game, from its margin normalised to a game to 21. */
export function marginWeight(scoreA: number, scoreB: number, pointsToWin: number): number {
  const margin = (Math.abs(scoreA - scoreB) * 21) / Math.max(1, pointsToWin);
  return Math.min(MARGIN_MAX, Math.max(MARGIN_MIN, margin / MARGIN_UNIT));
}

interface Track {
  r: Rating;
  seedLevel: number;
  games: number;
  lastDate: string | null;
  levelBeforeLastSession: number;
  points: RatingPoint[];
}

function peakOf(points: RatingPoint[]): number | null {
  const established = points.filter((p) => p.sessionId !== null && p.games >= PROVISIONAL_GAMES);
  return established.length ? Math.max(...established.map((p) => p.level)) : null;
}

/** Replays every completed session, oldest first. */
export function computeRatings(history: Record<string, HistorySession>, players: Pick<Player, 'id' | 'level'>[] = []): RatingTable {
  const profileLevel = new Map(players.map((p) => [p.id, p.level]));
  const tracks = new Map<PlayerId, Track>();
  const predictions: GamePrediction[] = [];

  for (const [sessionId, h] of sortedHistory(history)) {
    const games = historyGames(sessionId, h).filter(isCounted);
    const inSession = new Set(games.flatMap((g) => [...g.teamA, ...g.teamB]));

    // Seed newcomers; widen σ for anyone returning after a break; remember where they started.
    for (const pid of inSession) {
      let t = tracks.get(pid);
      if (!t) {
        const seedLevel = h.levels?.[pid] ?? profileLevel.get(pid) ?? 3;
        const start: RatingPoint = { sessionId: null, date: h.date, title: 'Start', level: muToLevel(levelToMu(seedLevel)), change: 0, games: 0 };
        t = {
          r: newRating({ mu: levelToMu(seedLevel), sigma: SEED_SIGMA }),
          seedLevel,
          games: 0,
          lastDate: null,
          levelBeforeLastSession: seedLevel,
          points: [start],
        };
        tracks.set(pid, t);
      } else if (t.lastDate) {
        const weeks = Math.max(0, daysBetween(t.lastDate, h.date) / 7);
        const sigma = Math.min(SEED_SIGMA, Math.sqrt(t.r.sigma ** 2 + DRIFT_PER_WEEK ** 2 * weeks));
        t.r = { mu: t.r.mu, sigma: Math.max(t.r.sigma, sigma) };
      }
      t.levelBeforeLastSession = muToLevel(t.r.mu);
      t.lastDate = h.date;
    }

    for (const g of games) {
      const team = (ids: Team) => ids.map((id) => tracks.get(id)!.r);
      const a = team(g.teamA);
      const b = team(g.teamB);
      const scoreA = g.scoreA!;
      const scoreB = g.scoreB!;
      predictions.push({ sessionId, number: g.number, pA: predictWin([a, b])[0], aWon: scoreA > scoreB });

      const [na, nb] = rate([a, b], { score: [scoreA, scoreB] });
      const w = marginWeight(scoreA, scoreB, h.pointsToWin);
      const apply = (ids: Team, before: Rating[], after: Rating[]) =>
        ids.forEach((id, i) => {
          const t = tracks.get(id)!;
          t.r = { mu: before[i].mu + w * (after[i].mu - before[i].mu), sigma: after[i].sigma };
          t.games += 1;
        });
      apply(g.teamA, a, na);
      apply(g.teamB, b, nb);
    }

    for (const pid of inSession) {
      const t = tracks.get(pid)!;
      const level = muToLevel(t.r.mu);
      t.points.push({ sessionId, date: h.date, title: h.title, level, change: level - t.levelBeforeLastSession, games: t.games });
    }
  }

  const ratings = new Map<PlayerId, PlayerRating>();
  for (const [playerId, t] of tracks) {
    const level = muToLevel(t.r.mu);
    ratings.set(playerId, {
      playerId,
      mu: t.r.mu,
      sigma: t.r.sigma,
      level,
      seedLevel: t.seedLevel,
      games: t.games,
      provisional: t.games < PROVISIONAL_GAMES,
      lastChange: level - t.levelBeforeLastSession,
      lastDate: t.lastDate,
      history: t.points,
      peak: peakOf(t.points),
    });
  }
  return { ratings, predictions };
}

/** Rated players, best first: established players, then provisional ones (who may just have had a lucky night). */
export function ratingStandings(ratings: Map<PlayerId, PlayerRating>, include?: (id: PlayerId) => boolean): PlayerRating[] {
  return [...ratings.values()]
    .filter((r) => !include || include(r.playerId))
    .sort((x, y) => Number(x.provisional) - Number(y.provisional) || y.mu - x.mu || y.games - x.games);
}

/**
 * The skill each attendee is balanced by in a live session:
 * - a level the admin changed for this session (differs from the profile level) is respected;
 * - otherwise an established rating (not provisional);
 * - otherwise the session level.
 * Rounded to 0.01 so every phone plans the same matches: exp/log can differ in the last bit
 * between browser engines, and planQueue must give identical results everywhere.
 */
export function sessionSkills(
  attendees: Record<PlayerId, Pick<Attendee, 'level'>>,
  ratings: Map<PlayerId, PlayerRating>,
  playersById: Map<PlayerId, Pick<Player, 'level'>>,
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const [id, a] of Object.entries(attendees)) {
    const r = ratings.get(id);
    const profile = playersById.get(id)?.level;
    const overridden = profile !== undefined && profile !== a.level;
    out[id] = !overridden && r && !r.provisional ? Math.round(r.level * 100) / 100 : a.level;
  }
  return out;
}

/**
 * Chance that team A beats team B, from the same skills the planner balances by (see sessionSkills),
 * with each player's rating uncertainty (or the starting uncertainty if they have no rated games).
 */
export function winChance(teamA: Team, teamB: Team, skills: Record<PlayerId, number>, ratings: Map<PlayerId, PlayerRating>): number {
  const player = (id: PlayerId): Rating => ({ mu: levelToMu(skills[id] ?? 3), sigma: ratings.get(id)?.sigma ?? SEED_SIGMA });
  return predictWin([teamA.map(player), teamB.map(player)])[0];
}
