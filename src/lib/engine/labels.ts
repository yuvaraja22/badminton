import type { PlayerId } from '../types';
import type { NameOf } from './stats';

/** Result description by winning margin, matching the wording of the original reports. */
export function marginLabel(winnerScore: number, loserScore: number, pointsToWin: number): string {
  const m = winnerScore - loserScore;
  if (m <= 2 && winnerScore > pointsToWin) return 'Deuce thriller';
  if (m <= 2) return 'High-pressure finish';
  if (m === 3) return 'Close contest';
  if (m === 4) return 'Solid finish';
  if (m <= 6) return 'Solid win';
  if (m <= 9) return 'Decisive victory';
  return 'Blowout win';
}

/** Team names in the order they were recorded, e.g. "Sridhar & Hardesh". */
export function teamNames(team: readonly PlayerId[], nameOf: NameOf): string {
  return team.map(nameOf).join(' & ');
}

/** Pair names in alphabetical order, e.g. "Anu & Vikram". */
export function pairLabel(pair: [PlayerId, PlayerId], nameOf: NameOf): string {
  const [a, b] = [...pair].sort((x, y) => nameOf(x).localeCompare(nameOf(y), undefined, { sensitivity: 'base' }));
  return `${nameOf(a)} & ${nameOf(b)}`;
}
