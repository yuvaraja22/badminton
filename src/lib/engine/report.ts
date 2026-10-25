import type { GameRecord, PlayerId } from '../types';
import { longDate, matchCode, pct, signed } from '../format';
import { isCounted, margin, otherSide, playersOf, sideOf, teamOf, totalPoints, winnerSide } from './games';
import { marginLabel, pairLabel, teamNames } from './labels';
import { computePartnerships, computeStandings, tightestGame, type NameOf, type PairLine, type PlayerLine } from './stats';
import { generateTakeaways } from './takeaways';

export interface ReportInput {
  title: string;
  date: string;
  pointsToWin: number;
  /** Every match of the session (any status). */
  games: GameRecord[];
  nameOf: NameOf;
  /** Players for whom this is their first session with the group. */
  newPlayers?: Set<PlayerId>;
  /** A team tournament: its own wording, and the teams' names for the two sides. */
  kind?: 'session' | 'tournament';
  sides?: [string, string];
}

export interface StandingRow extends PlayerLine {
  rank: number;
  name: string;
  isNew: boolean;
}

export interface PairRow extends PairLine {
  label: string;
}

export interface LogRow {
  number: number;
  code: string;
  team1: string;
  team2: string;
  scoreA: number | null;
  scoreB: number | null;
  winner: 'A' | 'B' | null;
  /** "Team 1" / "Team 2", or the tournament team's name. */
  winnerLabel: string | null;
  context: string;
  status: GameRecord['status'];
}

export interface SessionReport {
  kind: 'session' | 'tournament';
  title: string;
  dateLabel: string;
  subtitle: string;
  footer: string;
  matchCount: number;
  totalPoints: number;
  playerCount: number;
  unfinishedCount: number;
  liveCount: number;
  mvp: { name: string; won: number; lost: number; line: string; undefeated: boolean } | null;
  bestPair: { label: string; line: string } | null;
  tightest: { score: string; line: string } | null;
  standings: StandingRow[];
  partnerships: PairRow[];
  log: LogRow[];
  autoTakeaways: string[];
}

const SUBTITLE = 'Official Match Analytics, Individual Rankings & Partnership Synergy';

export function buildReport(input: ReportInput): SessionReport {
  const { nameOf, pointsToWin } = input;
  const kind = input.kind ?? 'session';
  const sides = input.sides ?? ['Team 1', 'Team 2'];
  const newPlayers = input.newPlayers ?? new Set<PlayerId>();
  const games = [...input.games].sort((a, b) => a.number - b.number);
  const counted = games.filter(isCounted);

  const standingLines = computeStandings(counted, nameOf);
  const standings: StandingRow[] = standingLines.map((l, i) => ({
    ...l,
    rank: i + 1,
    name: nameOf(l.playerId),
    isNew: newPlayers.has(l.playerId),
  }));
  const pairLines = computePartnerships(counted, nameOf);
  const partnerships: PairRow[] = pairLines.map((p) => ({ ...p, label: pairLabel(p.pair, nameOf) }));

  const top = standingLines[0];
  const mvpLine = top && top.qualified && top.won > 0 ? top : null;
  const mvp = mvpLine
    ? {
        name: nameOf(mvpLine.playerId),
        won: mvpLine.won,
        lost: mvpLine.lost,
        line: `${pct(mvpLine.winRate)} win rate (${signed(mvpLine.diff)} diff)`,
        undefeated: mvpLine.lost === 0,
      }
    : null;

  // Prefer a pair with 2+ games together; in a short session fall back to any winning pair.
  const best = partnerships.find((p) => p.played >= 2 && p.winRate > 0.5) ?? partnerships.find((p) => p.winRate > 0.5) ?? null;
  const bestPair = best
    ? {
        label: best.label,
        line: `${best.won} win${best.won === 1 ? '' : 's'} / ${best.lost} loss${best.lost === 1 ? '' : 'es'} (${signed(best.diff)} diff)`,
      }
    : null;

  const tight = tightestGame(counted);
  let tightest: SessionReport['tightest'] = null;
  if (tight) {
    const w = winnerSide(tight)!;
    const hi = Math.max(tight.scoreA!, tight.scoreB!);
    const lo = Math.min(tight.scoreA!, tight.scoreB!);
    tightest = {
      score: `${hi} - ${lo}`,
      line: `${teamNames(teamOf(tight, w), nameOf)} beat ${teamNames(teamOf(tight, otherSide(w)), nameOf)} (M${tight.number})`,
    };
  }

  // The top performer's single defeat gets a special mention in the log.
  const onlyDefeat =
    mvpLine && mvpLine.lost === 1 && mvpLine.won >= 3
      ? counted.find((g) => {
          const s = sideOf(g, mvpLine.playerId);
          return s && winnerSide(g) !== s;
        })?.number
      : undefined;

  const log: LogRow[] = games.map((g) => {
    const w = isCounted(g) ? winnerSide(g) : null;
    let context: string;
    if (g.status === 'live') {
      context = 'In progress';
    } else if (g.status === 'unfinished') {
      if (g.scoreA != null && g.scoreB != null && g.scoreA !== g.scoreB) {
        const lead = g.scoreA > g.scoreB ? 'A' : 'B';
        const hi = Math.max(g.scoreA, g.scoreB);
        const lo = Math.min(g.scoreA, g.scoreB);
        context = `Unfinished: ${teamNames(teamOf(g, lead), nameOf)} led ${hi}-${lo}`;
      } else if (g.scoreA != null && g.scoreB != null) {
        context = `Unfinished: level at ${g.scoreA}-${g.scoreB}`;
      } else {
        context = 'Unfinished';
      }
    } else if (w) {
      const hi = Math.max(g.scoreA!, g.scoreB!);
      const lo = Math.min(g.scoreA!, g.scoreB!);
      const label = g.number === onlyDefeat ? `${nameOf(mvpLine!.playerId)}'s only defeat` : marginLabel(hi, lo, g.pointsToWin ?? pointsToWin);
      context = `${label} (+${margin(g)})`;
    } else {
      context = 'No result';
    }
    return {
      number: g.number,
      code: matchCode(g.number),
      team1: teamNames(g.teamA, nameOf),
      team2: teamNames(g.teamB, nameOf),
      scoreA: g.scoreA,
      scoreB: g.scoreB,
      winner: w,
      winnerLabel: w ? sides[w === 'A' ? 0 : 1] : null,
      context,
      status: g.status,
    };
  });

  const playerCount = new Set(games.flatMap(playersOf)).size;
  const dateLabel = longDate(input.date);

  return {
    kind,
    title: input.title,
    dateLabel,
    subtitle: `${dateLabel} • ${kind === 'tournament' ? `${sides[0]} vs ${sides[1]}` : SUBTITLE}`,
    footer: `${input.title} • Official Match Analytics Report`,
    matchCount: counted.length,
    totalPoints: counted.reduce((s, g) => s + totalPoints(g), 0),
    playerCount,
    unfinishedCount: games.filter((g) => g.status === 'unfinished').length,
    liveCount: games.filter((g) => g.status === 'live').length,
    mvp,
    bestPair,
    tightest,
    standings,
    partnerships,
    log,
    autoTakeaways: generateTakeaways({
      games,
      standings: standingLines,
      partnerships: pairLines,
      nameOf,
      pointsToWin,
      newPlayers,
    }),
  };
}
