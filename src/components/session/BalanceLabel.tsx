import { Scale } from 'lucide-react';
import { cn } from '../../lib/cn';
import { teamBalance } from '../../lib/levels';

const TONES = { good: 'text-good', neutral: 'text-muted', warn: 'text-warn' };

/** "Even match" / "Slight edge: Team 1" / "Team 2 stronger", from the teams' combined levels. */
export function BalanceLabel({ levelA, levelB, short, className }: { levelA: number; levelB: number; short?: boolean; className?: string }) {
  const b = teamBalance(levelA, levelB);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', TONES[b.tone], className)}>
      <Scale size={14} aria-hidden />
      {short ? b.short : b.text}
    </span>
  );
}
