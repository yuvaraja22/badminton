import { describe, expect, it } from 'vitest';
import { serveState, typedLog, validFinalScore } from './scoring';

describe('who serves, from which court', () => {
  it('is whoever was picked at 0–0, from the right', () => {
    expect(serveState('', 'B')).toEqual({ side: 'B', court: 'right' });
    expect(serveState('', null)).toBeNull();
  });

  it('follows the rally winner, right on an even score and left on an odd one', () => {
    expect(serveState('A', 'B')).toEqual({ side: 'A', court: 'left' }); // 1–0
    expect(serveState('AA', null)).toEqual({ side: 'A', court: 'right' }); // 2–0
    expect(serveState('AAB', null)).toEqual({ side: 'B', court: 'left' }); // 2–1, B on 1
    expect(serveState('AABB', null)).toEqual({ side: 'B', court: 'right' }); // 2–2
  });

  it("doesn't guess after a typed-in score until a point is played live", () => {
    const typed = typedLog(5, 3);
    expect(typed).toBe('AAAAABBB');
    expect(serveState(typed, 'A', typed.length)).toBeNull();
    expect(serveState(`${typed}A`, 'A', typed.length)).toEqual({ side: 'A', court: 'right' }); // 6–3
  });
});

describe('finished scores', () => {
  it('knows a real finish from a typo', () => {
    expect(validFinalScore(21, 19)).toBe(true);
    expect(validFinalScore(21, 20)).toBe(false);
    expect(validFinalScore(24, 22)).toBe(true);
    expect(validFinalScore(30, 29)).toBe(true);
    expect(validFinalScore(25, 10)).toBe(false);
    expect(validFinalScore(15, 13, 15, 21)).toBe(true);
  });
});
