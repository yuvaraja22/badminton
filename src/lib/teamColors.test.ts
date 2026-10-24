import { describe, expect, it } from 'vitest';
import { TEAM_COLORS, confusablePair } from './teamColors';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('team colours', () => {
  it('keep white text readable (WCAG AA, 4.5:1)', () => {
    for (const { label, fill } of Object.values(TEAM_COLORS)) {
      const contrast = 1.05 / (luminance(fill) + 0.05);
      expect(contrast, label).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('flags pairs colour-blind players mix up', () => {
    expect(confusablePair('red', 'green')).toBe(true);
    expect(confusablePair('blue', 'orange')).toBe(false);
  });
});
