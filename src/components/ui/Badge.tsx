import { cn } from '../../lib/cn';
import type { ReactNode } from 'react';
import { signed } from '../../lib/format';

type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'info' | 'live' | 'volt';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  good: 'bg-good-bg text-good',
  bad: 'bg-bad-bg text-bad',
  warn: 'bg-warn-bg text-warn',
  info: 'bg-info-bg text-ink ring-1 ring-inset ring-line',
  live: 'bg-accent text-accent-ink',
  volt: 'bg-volt text-volt-ink',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  );
}

/** +12 in green, −7 in red, on a scoreboard numeral. */
export function DiffPill({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        'font-score tabular inline-flex min-w-12 justify-center rounded-full px-2 py-0.5 text-[15px] leading-5 font-bold tracking-wide',
        value > 0 ? 'bg-good-bg text-good' : value < 0 ? 'bg-bad-bg text-bad' : 'bg-surface-2 text-muted',
        className,
      )}
    >
      {signed(value)}
    </span>
  );
}

export function LiveDot() {
  return (
    <span className="relative inline-flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-current" />
    </span>
  );
}
