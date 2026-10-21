import { Scale } from 'lucide-react';
import { cn } from '../../lib/cn';
import { odds } from '../../lib/format';
import { teamBalance } from '../../lib/levels';

const TONES = { good: 'text-good', neutral: 'text-muted', warn: 'text-warn' };

/**
 * "Even match" / "Slight edge: Team 1" / "Team 2 stronger", from the teams' combined levels,
 * followed by each team's win chance when it is known: "Slight edge: Team 1 · 61% – 39%".
 */
export function BalanceLabel({
  levelA,
  levelB,
  chance,
  short,
  className,
}: {
  levelA: number;
  levelB: number;
  /** Chance that Team 1 wins (0–1). */
  chance?: number | null;
  short?: boolean;
  className?: string;
}) {
  const b = teamBalance(levelA, levelB);
  const o = chance == null ? null : odds(chance);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', TONES[b.tone], className)}>
      <Scale size={14} aria-hidden />
      {short ? b.short : b.text}
      {o && (
        <span className="tabular" title={`Win chance: Team 1 ${o[0]}%, Team 2 ${o[1]}%`}>
          · {short ? `${o[0]}–${o[1]}` : `${o[0]}% – ${o[1]}%`}
        </span>
      )}
    </span>
  );
}
