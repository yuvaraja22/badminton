import { cn } from '../../lib/cn';
import type { HTMLAttributes, ReactNode } from 'react';
import { Shuttle } from '../Logo';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[1.4rem] border border-line bg-surface shadow-[var(--shadow-card)]', className)} {...rest} />;
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-4', className)}>
      <div className="min-w-0">
        <h2 className="kicker">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate pb-0.5 text-[2.1rem] leading-none font-extrabold tracking-[-0.035em]">
          <span className="marker">{title}</span>
        </h1>
        {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[1.4rem] border-2 border-dashed border-line px-6 py-10 text-center">
      <div className="relative mb-1 flex size-16 items-center justify-center rounded-full bg-surface-2 text-muted">
        {icon ?? <Shuttle className="h-9 -rotate-[30deg]" />}
      </div>
      <p className="text-lg font-bold tracking-tight">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

/** A shuttle hopping over a net while things load. */
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted" role="status">
      <span className="relative flex h-10 w-16 items-end justify-center" aria-hidden>
        <span className="absolute bottom-0 h-4 w-0.5 rounded bg-line" />
        <Shuttle className="animate-shuttle h-6 text-primary-text" />
      </span>
      {label}
    </div>
  );
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warn' | 'bad' | 'good'; children: ReactNode; className?: string }) {
  const tones = {
    info: 'bg-info-bg text-ink border-line',
    warn: 'bg-warn-bg text-warn border-warn/25',
    bad: 'bg-bad-bg text-bad border-bad/25',
    good: 'bg-good-bg text-good border-good/25',
  };
  return <div className={cn('rounded-2xl border px-3.5 py-2.5 text-sm', tones[tone], className)}>{children}</div>;
}
