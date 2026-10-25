import type { HistorySession, PlayerId } from '../types';
import { allTimeStats, type AllTimeLine } from './alltime';
import type { NameOf } from './stats';

/**
 * Seasons are calendar quarters (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec), each with a champion; every
 * month has a Player of the Month. Both are the top of that period's standings among players with
 * enough games (the same table as the leaderboard), so they need no extra data.
 */

export type PeriodKind = 'season' | 'month';

export interface Period {
  kind: PeriodKind;
  /** "2026-Q4" or "2026-10". */
  key: string;
  /** "Oct–Dec 2026" or "October 2026". */
  label: string;
  /** First and last day, YYYY-MM-DD. */
  from: string;
  to: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function seasonOf(date: string): Period {
  const [y, m] = date.split('-').map(Number);
  const q = Math.floor((m - 1) / 3);
  const first = q * 3 + 1;
  return {
    kind: 'season',
    key: `${y}-Q${q + 1}`,
    label: `${MONTHS[first - 1].slice(0, 3)}–${MONTHS[first + 1].slice(0, 3)} ${y}`,
    from: `${y}-${pad(first)}-01`,
    to: `${y}-${pad(first + 2)}-${pad(lastDay(y, first + 2))}`,
  };
}

export function monthOf(date: string): Period {
  const [y, m] = date.split('-').map(Number);
  return { kind: 'month', key: `${y}-${pad(m)}`, label: `${MONTHS[m - 1]} ${y}`, from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
}

export function periodOf(kind: PeriodKind, date: string): Period {
  return kind === 'season' ? seasonOf(date) : monthOf(date);
}

/** A season or month from its key ("2026-Q4" / "2026-10"), or null if it isn't one. */
export function periodFromKey(key: string): Period | null {
  const season = /^(\d{4})-Q([1-4])$/.exec(key);
  if (season) return seasonOf(`${season[1]}-${pad((Number(season[2]) - 1) * 3 + 1)}-01`);
  const month = /^(\d{4})-(\d{2})$/.exec(key);
  if (month && Number(month[2]) >= 1 && Number(month[2]) <= 12) return monthOf(`${key}-01`);
  return null;
}

export interface Award {
  period: Period;
  /** The top qualified player, and the runner-up. */
  winner: AllTimeLine;
  runnerUp: AllTimeLine | null;
  /** The period is over (otherwise it's the leader so far). */
  final: boolean;
}

/**
 * The champion of every season (or Player of the Month for every month) with games in it, newest
 * first. `eligible` leaves players out of the running (guests).
 */
export function awards(
  history: Record<string, HistorySession>,
  nameOf: NameOf,
  kind: PeriodKind,
  today: string,
  eligible: (id: PlayerId) => boolean = () => true,
): Award[] {
  const periods = new Map<string, Period>();
  for (const h of Object.values(history)) if (h.date) periods.set(periodOf(kind, h.date).key, periodOf(kind, h.date));
  const out: Award[] = [];
  for (const period of [...periods.values()].sort((a, b) => b.from.localeCompare(a.from))) {
    const top = allTimeStats(history, nameOf, { from: period.from, to: period.to }).standings.filter((l) => l.qualified && l.won > 0 && eligible(l.playerId));
    if (!top.length) continue;
    out.push({ period, winner: top[0], runnerUp: top[1] ?? null, final: period.to < today });
  }
  return out;
}
