import { matchCode } from './format';
import type { EditEntry, Match } from './types';

/** The latest change to match n, for a one-line "Yuva · Oct 25, 9:42 PM" under it. */
export function lastEditOf(edits: EditEntry[], n: number): EditEntry | null {
  let last: EditEntry | null = null;
  for (const e of edits) if (e.match === n && (!last || e.at >= last.at)) last = e;
  return last;
}

/** A match's result as written in the change history: "21–17", "18–15 (stopped early)". */
export function scoreText(m: Pick<Match, 'scoreA' | 'scoreB' | 'status'>): string {
  if (m.status === 'live') return 'back on court';
  const score = m.scoreA != null && m.scoreB != null ? `${m.scoreA}–${m.scoreB}` : 'no score';
  return m.status === 'unfinished' ? `${score} (stopped early)` : score;
}

/** What changed in a match, worded for the change history; null when nothing worth noting did. */
export function matchChange(before: Match | undefined, after: Match): string | null {
  const code = matchCode(after.number);
  if (!before) return `Added ${code}: ${scoreText(after)}`;
  const samePlayers = before.teamA.join() === after.teamA.join() && before.teamB.join() === after.teamB.join();
  if (before.status === 'live' && after.status !== 'live') {
    return `${code} result: ${scoreText(after)}${after.log ? ' (scored live)' : ''}${samePlayers ? '' : ', players changed'}`;
  }
  const parts: string[] = [];
  if (!samePlayers) parts.push('players changed');
  const was = scoreText(before);
  const now = scoreText(after);
  if (was !== now) parts.push(`${was} → ${now}`);
  return parts.length ? `${code}: ${parts.join(', ')}` : null;
}
