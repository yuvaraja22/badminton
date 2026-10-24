import { Link } from 'react-router';
import { cn } from '../../lib/cn';

/** Sessions | Tournaments, at the top of both lists (the bottom nav keeps one "Sessions" item). */
export function SessionsSwitch({ current }: { current: 'sessions' | 'tournaments' }) {
  const item = (to: string, label: string, on: boolean) => (
    <Link
      to={to}
      role="tab"
      aria-selected={on}
      className={cn(
        'flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition',
        on ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
      )}
    >
      {label}
    </Link>
  );
  return (
    <div role="tablist" className="mb-4 flex rounded-xl bg-surface-2 p-1">
      {item('/sessions', 'Sessions', current === 'sessions')}
      {item('/tournaments', 'Tournaments', current === 'tournaments')}
    </div>
  );
}
