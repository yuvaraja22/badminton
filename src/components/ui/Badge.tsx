import { cn } from '../../lib/cn';
import type { ReactNode } from 'react';
import { signed } from '../../lib/format';

type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'info' | 'live';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  good: 'bg-good-bg text-good',
  bad: 'bg-bad-bg text-bad',
  warn: 'bg-warn-bg text-warn',
  info: 'bg-info-bg text-ink',
  live: 'bg-accent text-white',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', TONES[tone], className)}>
      {children}
    </span>
  );
}

/** +12 in green, −7 in red. */
export function DiffPill({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        'tabular inline-flex min-w-11 justify-center rounded-md px-2 py-0.5 text-sm font-bold',
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
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-accent" />
    </span>
  );
}
