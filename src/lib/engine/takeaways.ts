import type { GameRecord, PlayerId } from '../types';
import { capitalize, listJoin, numberWord, pct, signed } from '../format';
import { isCounted, margin, otherSide, partnerOf, scoreFor, sideOf, teamOf, topScore, winnerSide } from './games';
import { pairLabel, teamNames } from './labels';
import { partnersOf, type NameOf, type PairLine, type PlayerLine } from './stats';

export interface TakeawayInput {
  /** All games of the session (any status), in match order. */
  games: GameRecord[];
  standings: PlayerLine[];
  partnerships: PairLine[];
  nameOf: NameOf;
  pointsToWin: number;
  newPlayers: Set<PlayerId>;
}

interface Item {
  priority: number;
  text: string;
  /** Shown at the end regardless of priority (e.g. unfinished matches). */
  last?: boolean;
}

const code = (n: number) => `M${n}`;
const allGames = (n: number) => (n === 2 ? 'both games' : `all ${n} games`);
const hiLo = (g: GameRecord) => {
  const a = g.scoreA ?? 0;
  const b = g.scoreB ?? 0;
  return `${Math.max(a, b)}-${Math.min(a, b)}`;
};

/**
 * Rule-based "Key Session Takeaways". Each rule produces at most one bullet; the highest-priority
 * bullets are kept. Wording follows the style of the group's original reports.
 */
export function generateTakeaways(input: TakeawayInput, max = 6): string[] {
  const { games, standings, partnerships, nameOf, pointsToWin, newPlayers } = input;
  const counted = games.filter(isCounted);
  const items: Item[] = [];
  const winnersOf = (g: GameRecord) => {
    const w = winnerSide(g)!;
    return { winners: teamNames(teamOf(g, w), nameOf), losers: teamNames(teamOf(g, otherSide(w)), nameOf) };
  };
  const lossesOf = (pid: PlayerId) =>
    counted.filter((g) => {
      const s = sideOf(g, pid);
      return s && winnerSide(g) !== s;
    });
  const winningWith = (pid: PlayerId) => {
    const winners = partnersOf(counted, pid).filter((r) => r.won > 0);
    if (winners.length === 1) return `winning only alongside ${nameOf(winners[0].otherId)}`;
    return `winning with ${winners.length} different partners`;
  };

  // 1. Top performer.
  const mvp = standings[0];
  if (mvp && mvp.qualified && mvp.played >= 2 && mvp.won > 0) {
    const n = nameOf(mvp.playerId);
    const partners = partnersOf(counted, mvp.playerId).length;
    const teammates = `${partners} different teammate${partners === 1 ? '' : 's'}`;
    let text: string;
    if (mvp.lost === 0 && mvp.won >= 3) {
      text = `Flawless Display: ${n} went ${mvp.won}-0, partnering ${teammates} and winning every game.`;
    } else if (mvp.lost === 1 && mvp.won >= 3) {
      const loss = lossesOf(mvp.playerId)[0];
      const [f, a] = scoreFor(loss, sideOf(loss, mvp.playerId)!);
      text =
        `Near-Flawless Display: ${n} went ${mvp.won}-1 across ${mvp.played} games, partnering ${teammates}. ` +
        `${n}'s only loss was ${code(loss.number)} (${f}-${a}) alongside ${nameOf(partnerOf(loss, mvp.playerId)!)}.`;
    } else {
      text = `${n} Tops the Table: ${n} went ${mvp.won}-${mvp.lost} (${pct(mvp.winRate)}), ${winningWith(mvp.playerId)}.`;
    }
    items.push({ priority: 100, text });
  }

  // 2. Best point difference, when it isn't the top performer.
  const qualified = standings.filter((l) => l.qualified);
  const bestDiff = [...qualified].sort((a, b) => b.diff - a.diff)[0];
  if (bestDiff && mvp && bestDiff.playerId !== mvp.playerId && bestDiff.diff > 0) {
    const n = nameOf(bestDiff.playerId);
    let text = `${n}'s Consistency: ${n} went ${bestDiff.won}-${bestDiff.lost} and posted the best point difference at ${signed(bestDiff.diff)}.`;
    const losses = lossesOf(bestDiff.playerId);
    if (losses.length >= 2 && losses.length <= 4) {
      const partners = new Set(losses.map((g) => partnerOf(g, bestDiff.playerId)));
      if (partners.size === 1) {
        const margins = new Set(losses.map(margin));
        const m = margins.size === 1 ? [...margins][0] : null;
        const lead = losses.length === 2 ? 'Both' : `All ${numberWord(losses.length)}`;
        text += ` ${lead} of ${n}'s losses came alongside ${nameOf([...partners][0]!)}${m != null ? `, by ${m} point${m === 1 ? '' : 's'} each` : ''}.`;
      }
    }
    items.push({ priority: 75, text });
  }

  // 3. Runner-up, when not already covered.
  const second = standings[1];
  if (second && second.qualified && standings.length >= 4 && second.playerId !== bestDiff?.playerId && second.winRate >= 0.5) {
    const n = nameOf(second.playerId);
    items.push({
      priority: 70,
      text: `${n}'s Climb: ${n} finished second at ${second.won}-${second.lost} (${signed(second.diff)}), ${winningWith(second.playerId)}.`,
    });
  }

  // 4. Unbeaten pairs.
  const unbeatenAll = partnerships.filter((p) => p.lost === 0 && p.won > 0);
  const unbeatenMulti = unbeatenAll.filter((p) => p.played >= 2);
  if (unbeatenMulti.length) {
    const first = unbeatenMulti[0];
    const others = unbeatenAll.filter((p) => p !== first);
    const label = (p: PairLine) => pairLabel(p.pair, nameOf);
    let text: string;
    if (others.length === 0) {
      text = `Unbeaten Pair: ${label(first)} went ${first.won}-0 (${signed(first.diff)}) together.`;
    } else if (others.length === 1 && others[0].played >= 2) {
      const o = others[0];
      text = `Unbeaten Pairs: ${label(first)} (${first.won}-0, ${signed(first.diff)}) and ${label(o)} (${o.won}-0, ${signed(o.diff)}) won every game they played together.`;
    } else {
      const o = others[0];
      text =
        `Unbeaten Pairs: ${label(first)} went ${first.won}-0 (${signed(first.diff)}), and ${numberWord(others.length)} other pairing${others.length === 1 ? '' : 's'} ` +
        `finished unbeaten, led by ${label(o)} (${o.won}-0, ${signed(o.diff)}).`;
    }
    items.push({ priority: 90, text });
  }

  // 5. A player who was unbeatable with one partner and winless with another.
  let usedWinless: string | null = null;
  {
    let best: { pid: PlayerId; win: { otherId: PlayerId; played: number }; loss: { otherId: PlayerId; played: number; diff: number } } | null = null;
    for (const line of standings) {
      const rel = partnersOf(counted, line.playerId);
      const win = rel.filter((r) => r.played >= 2 && r.lost === 0).sort((a, b) => b.played - a.played)[0];
      const loss = rel.filter((r) => r.played >= 2 && r.won === 0).sort((a, b) => b.played - a.played || a.diff - b.diff)[0];
      if (!win || !loss) continue;
      const score = win.played + loss.played;
      const bestScore = best ? best.win.played + best.loss.played : -1;
      if (score > bestScore || (score === bestScore && best && loss.diff < best.loss.diff)) {
        best = { pid: line.playerId, win, loss };
      }
    }
    if (best) {
      const n = nameOf(best.pid);
      usedWinless = pairLabel([best.pid, best.loss.otherId], nameOf);
      items.push({
        priority: 85,
        text:
          `${n}'s Two Sides: ${usedWinless} lost ${allGames(best.loss.played)} as a pair (${signed(best.loss.diff)}), ` +
          `while ${n} won ${allGames(best.win.played)} alongside ${nameOf(best.win.otherId)}.`,
      });
    }
  }

  // 6. Winless pairing.
  const winless = partnerships
    .filter((p) => p.played >= 2 && p.won === 0 && pairLabel(p.pair, nameOf) !== usedWinless)
    .sort((a, b) => b.played - a.played || a.diff - b.diff)[0];
  if (winless) {
    items.push({
      priority: 55,
      text: `Tough Pairing: ${pairLabel(winless.pair, nameOf)} lost ${allGames(winless.played)} together (${signed(winless.diff)}).`,
    });
  }

  // 7. Close games and games that went past the target score.
  const nail = counted.filter((g) => margin(g) <= 2);
  const over = counted.filter((g) => topScore(g) > pointsToWin);
  const overList = listJoin(over.map((g) => `${code(g.number)} (${hiLo(g)})`));
  if (nail.length >= 3) {
    const allTwo = nail.every((g) => margin(g) === 2);
    let text = `Nail-Biters: ${capitalize(numberWord(nail.length))} games were decided by ${allTwo ? '2 points' : '2 points or fewer'} (${nail.map((g) => code(g.number)).join(', ')}).`;
    if (over.length === 1) text += ` ${overList} went past ${pointsToWin}.`;
    else if (over.length === 2) text += ` ${overList} both went past ${pointsToWin}.`;
    else if (over.length > 2) text += ` ${overList} all went past ${pointsToWin}.`;
    items.push({ priority: 80, text });
  } else if (over.length === 1) {
    const g = over[0];
    const { winners, losers } = winnersOf(g);
    items.push({
      priority: 80,
      text: `Overtime Thriller: ${code(g.number)} went past ${pointsToWin}, with ${winners} ${margin(g) <= 2 ? 'edging' : 'beating'} ${losers} ${hiLo(g)}.`,
    });
  } else if (over.length > 1) {
    items.push({ priority: 80, text: `Overtime Thrillers: ${overList} all went past ${pointsToWin}.` });
  }

  // 8. Narrow losses for a player near the bottom.
  {
    let best: { pid: PlayerId; narrow: GameRecord[]; line: PlayerLine } | null = null;
    for (const line of standings) {
      if (line.playerId === mvp?.playerId || line.lost < 3) continue;
      const narrow = lossesOf(line.playerId).filter((g) => margin(g) <= 2);
      if (narrow.length < 2) continue;
      if (!best || narrow.length > best.narrow.length || (narrow.length === best.narrow.length && line.winRate < best.line.winRate)) {
        best = { pid: line.playerId, narrow, line };
      }
    }
    if (best) {
      const n = nameOf(best.pid);
      const allTwo = best.narrow.every((g) => margin(g) === 2);
      items.push({
        priority: 65,
        text:
          `Close Calls for ${n}: ${n} finished ${best.line.won}-${best.line.lost}, but ${best.narrow.length} of those losses were ` +
          `${allTwo ? 'by just 2 points' : 'by 2 points or fewer'} (${best.narrow.map((g) => code(g.number)).join(', ')}).`,
      });
    }
  }

  // 9. First session with the group.
  for (const line of standings.filter((l) => newPlayers.has(l.playerId)).slice(0, 2)) {
    const n = nameOf(line.playerId);
    items.push({
      priority: 72,
      text:
        line.diff > 0 || line.winRate >= 0.5
          ? `Debut Impact: ${n} made a strong debut, going ${line.won}-${line.lost} with a ${signed(line.diff)} point difference.`
          : `Debut: ${n} played ${line.played} games in a first session with the group, going ${line.won}-${line.lost}.`,
    });
  }

  // 10. Best attack and defence.
  if (qualified.length >= 2) {
    const attack = [...qualified].sort((a, b) => b.ppg - a.ppg)[0];
    const defence = [...qualified].sort((a, b) => a.papg - b.papg)[0];
    const text =
      attack.playerId === defence.playerId
        ? `Two-Way Dominance: ${nameOf(attack.playerId)} averaged ${attack.ppg.toFixed(1)} points per game and conceded only ${attack.papg.toFixed(1)}.`
        : `Attack & Defence: ${nameOf(attack.playerId)} averaged ${attack.ppg.toFixed(1)} points per game; ${nameOf(defence.playerId)} conceded only ${defence.papg.toFixed(1)} per game, the best defensive record.`;
    items.push({ priority: 40, text });
  }

  // 11. Biggest margin.
  const blowout = [...counted].sort((a, b) => margin(b) - margin(a) || a.number - b.number)[0];
  if (blowout && margin(blowout) >= 10) {
    const { winners, losers } = winnersOf(blowout);
    items.push({
      priority: 30,
      text: `Biggest Blowout: ${winners} beat ${losers} ${hiLo(blowout)} in ${code(blowout.number)} (+${margin(blowout)}).`,
    });
  }

  // 12. Matches that were stopped early.
  for (const g of games.filter((x) => x.status === 'unfinished')) {
    let text: string;
    if (g.scoreA != null && g.scoreB != null && g.scoreA !== g.scoreB) {
      const lead = g.scoreA > g.scoreB ? 'A' : 'B';
      text =
        `Unfinished: ${code(g.number)} was stopped with ${teamNames(teamOf(g, lead), nameOf)} leading ` +
        `${teamNames(teamOf(g, otherSide(lead)), nameOf)} ${hiLo(g)} and is not counted in the standings.`;
    } else if (g.scoreA != null && g.scoreB != null) {
      text = `Unfinished: ${code(g.number)} was stopped at ${g.scoreA}-${g.scoreB} and is not counted in the standings.`;
    } else {
      text = `Unfinished: ${code(g.number)} was stopped early and is not counted in the standings.`;
    }
    items.push({ priority: 95, text, last: true });
  }

  const kept = [...items].sort((a, b) => b.priority - a.priority).slice(0, max);
  return [...kept.filter((i) => !i.last), ...kept.filter((i) => i.last)].map((i) => i.text);
}
