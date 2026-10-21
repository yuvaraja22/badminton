/**
 * Skill levels are stored as numbers (1–5.5 in half steps) so team balancing can add them up,
 * and shown as names: each tier has a Low and a High step (1 = Amateur Low … 5.5 = Professional High).
 */
const LEVEL_TIERS = ['Amateur', 'Beginner', 'Intermediate', 'Advanced', 'Professional'] as const;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5.5;

export function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level * 2) / 2));
}

/** 4.5 → { tier: "Advanced", part: "High" } */
export function levelParts(level: number): { tier: string; part: 'Low' | 'High' } {
  const step = Math.round((clampLevel(level) - MIN_LEVEL) * 2);
  return { tier: LEVEL_TIERS[Math.floor(step / 2)], part: step % 2 === 0 ? 'Low' : 'High' };
}

/** 4.5 → "Advanced High" */
export function levelName(level: number): string {
  const { tier, part } = levelParts(level);
  return `${tier} ${part}`;
}

export const LEVEL_OPTIONS: { value: number; label: string }[] = Array.from({ length: (MAX_LEVEL - MIN_LEVEL) * 2 + 1 }, (_, i) => {
  const value = MIN_LEVEL + i / 2;
  return { value, label: levelName(value) };
});

export interface Balance {
  /** "Even match", "Slight edge: Team 1", "Team 2 stronger" */
  text: string;
  /** Compact form for lists: "Even", "Slight edge", "Uneven" */
  short: string;
  tone: 'good' | 'neutral' | 'warn';
}

/** How evenly matched two teams are, from their combined levels. */
export function teamBalance(levelA: number, levelB: number): Balance {
  const gap = Math.abs(levelA - levelB);
  const stronger = levelA > levelB ? 'Team 1' : 'Team 2';
  if (gap < 0.25) return { text: 'Even match', short: 'Even', tone: 'good' };
  if (gap <= 1) return { text: `Slight edge: ${stronger}`, short: 'Slight edge', tone: 'neutral' };
  return { text: `${stronger} stronger`, short: 'Uneven', tone: 'warn' };
}
