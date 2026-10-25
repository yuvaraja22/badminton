import type { ReactNode } from 'react';
import { Check, CloudOff, LoaderCircle, WifiOff } from 'lucide-react';
import { cn } from '../lib/cn';
import { useSyncStatus, type SyncState } from '../lib/sync';

const VIEWS: Record<Exclude<SyncState, 'idle'>, { icon: ReactNode; tone: string; title: string }> = {
  offline: {
    icon: <CloudOff size={14} aria-hidden />,
    tone: 'bg-warn-bg text-warn',
    title: 'No connection. Changes are kept on this phone and sync when it is back online.',
  },
  waiting: {
    icon: <WifiOff size={14} aria-hidden />,
    tone: 'bg-warn-bg text-warn',
    title: "Changes haven't reached the server yet. They are kept on this phone and sync once the connection works.",
  },
  saving: { icon: <LoaderCircle size={14} className="animate-spin" aria-hidden />, tone: 'bg-surface-2 text-muted', title: 'Sending changes…' },
  saved: { icon: <Check size={14} strokeWidth={2.75} aria-hidden />, tone: 'bg-good-bg text-good', title: 'All changes are saved for everyone.' },
};

/**
 * Whether this phone's changes have reached everyone: "Offline · 3 to sync", "Not saved yet",
 * "Saving…", then a brief "Saved". Nothing while all is well.
 */
export function SyncPill({ className }: { className?: string }) {
  const { state, pending } = useSyncStatus();
  if (state === 'idle') return null;
  const view = VIEWS[state];
  const text =
    state === 'offline' ? (pending ? `Offline · ${pending} to sync` : 'Offline') : state === 'waiting' ? 'Not saved yet' : state === 'saving' ? 'Saving…' : 'Saved';
  return (
    <span
      role="status"
      title={view.title}
      className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', view.tone, className)}
    >
      {view.icon}
      {text}
    </span>
  );
}
