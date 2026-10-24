import type { TeamColor, TeamKey, Tournament } from './types';

/**
 * Team colours for tournaments. Each fill keeps white text readable (contrast of at least 4.5:1,
 * see teamColors.test.ts) in light and dark mode. Blue vs orange is the default pair because it
 * stays easy to tell apart for colour-blind players.
 */
export const TEAM_COLORS: Record<TeamColor, { label: string; fill: string }> = {
  blue: { label: 'Blue', fill: '#2f5bd3' },
  orange: { label: 'Orange', fill: '#c2410c' },
  green: { label: 'Green', fill: '#15803d' },
  purple: { label: 'Purple', fill: '#7e22ce' },
  red: { label: 'Red', fill: '#b91c1c' },
  teal: { label: 'Teal', fill: '#0f766e' },
};

export const TEAM_COLOR_KEYS = Object.keys(TEAM_COLORS) as TeamColor[];

export const DEFAULT_TEAM_COLORS: Record<TeamKey, TeamColor> = { a: 'blue', b: 'orange' };

/** Pairs that look alike to many colour-blind people. */
export function confusablePair(x: TeamColor, y: TeamColor): boolean {
  const pair = [x, y].sort().join('+');
  return pair === 'green+red' || pair === 'orange+red' || pair === 'green+orange';
}

/** "Team A" / "Team B" unless the team has a name. */
export function teamName(t: Pick<Tournament, 'teams'>, key: TeamKey): string {
  return t.teams[key].name?.trim() || (key === 'a' ? 'Team A' : 'Team B');
}

export function teamFill(t: Pick<Tournament, 'teams'>, key: TeamKey): string {
  return TEAM_COLORS[t.teams[key].color]?.fill ?? TEAM_COLORS[DEFAULT_TEAM_COLORS[key]].fill;
}
