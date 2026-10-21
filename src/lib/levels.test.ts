import { describe, expect, it } from 'vitest';
import { LEVEL_OPTIONS, levelName, teamBalance } from './levels';

describe('level names', () => {
  it('maps each half step to a tier and Low/High', () => {
    expect(levelName(1)).toBe('Amateur Low');
    expect(levelName(1.5)).toBe('Amateur High');
    expect(levelName(2)).toBe('Beginner Low');
    expect(levelName(3)).toBe('Intermediate Low');
    expect(levelName(3.5)).toBe('Intermediate High');
    expect(levelName(4.5)).toBe('Advanced High');
    expect(levelName(5)).toBe('Professional Low');
    expect(levelName(5.5)).toBe('Professional High');
  });

  it('clamps out-of-range values', () => {
    expect(levelName(0)).toBe('Amateur Low');
    expect(levelName(9)).toBe('Professional High');
  });

  it('lists all ten levels in order', () => {
    expect(LEVEL_OPTIONS).toHaveLength(10);
    expect(LEVEL_OPTIONS[0]).toEqual({ value: 1, label: 'Amateur Low' });
    expect(LEVEL_OPTIONS[9]).toEqual({ value: 5.5, label: 'Professional High' });
  });
});

describe('team balance', () => {
  it('describes how even a lineup is', () => {
    expect(teamBalance(7.5, 7.5)).toMatchObject({ text: 'Even match', tone: 'good' });
    expect(teamBalance(8, 7.5)).toMatchObject({ text: 'Slight edge: Team 1', short: 'Slight edge' });
    expect(teamBalance(7, 8)).toMatchObject({ text: 'Slight edge: Team 2' });
    expect(teamBalance(6.5, 8)).toMatchObject({ text: 'Team 2 stronger', short: 'Uneven', tone: 'warn' });
  });
});
