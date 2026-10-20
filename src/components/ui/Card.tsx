import { cn } from '../../lib/cn';
import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-surface shadow-sm', className)} {...rest} />;
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-primary" />
      {label}
    </div>
  );
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warn' | 'bad' | 'good'; children: ReactNode; className?: string }) {
  const tones = {
    info: 'bg-info-bg text-ink',
    warn: 'bg-warn-bg text-warn',
    bad: 'bg-bad-bg text-bad',
    good: 'bg-good-bg text-good',
  };
  return <div className={cn('rounded-xl px-3 py-2 text-sm', tones[tone], className)}>{children}</div>;
}
