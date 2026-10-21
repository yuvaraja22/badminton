import { useCallback } from 'react';
import { winChance } from '../engine/rating';
import type { PlayerId, Team } from '../types';
import { useData } from './context';

/** Chance that team A beats team B, given the skills used for balancing (e.g. a queue plan's skills). */
export function useWinChance(): (teamA: Team, teamB: Team, skills: Record<PlayerId, number>) => number {
  const { ratings } = useData();
  return useCallback((teamA, teamB, skills) => winChance(teamA, teamB, skills, ratings), [ratings]);
}
