import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { useData } from '../../lib/data/context';
import { odds } from '../../lib/format';
import type { PlayerId } from '../../lib/types';
import { Avatar } from '../ui/Avatar';

const line = { vectorEffect: 'non-scaling-stroke' as const };

/**
 * Top-down doubles court markings (13.4 m × 6.1 m, net across the middle), stretched to fill the box.
 * Purely decorative; sits behind the players.
 */
export function CourtLines({ className, net = true }: { className?: string; net?: boolean }) {
  return (
    <div className={cn('pointer-events-none absolute', className)} aria-hidden>
      <svg viewBox="0 0 134 61" preserveAspectRatio="none" overflow="visible" className="size-full">
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.55">
          <rect x="0" y="0" width="134" height="61" {...line} />
          {/* Singles sidelines, short service lines, doubles long service lines, centre lines. */}
          <path d="M0 4.6 H134 M0 56.4 H134 M47.2 0 V61 M86.8 0 V61 M7.6 0 V61 M126.4 0 V61 M0 30.5 H47.2 M86.8 30.5 H134" {...line} />
        </g>
        {net && (
          <g>
            <line x1="67" y1="-3" x2="67" y2="64" stroke="rgb(0 0 0 / 0.25)" strokeWidth="7" {...line} />
            <line x1="67" y1="-3" x2="67" y2="64" stroke="currentColor" strokeWidth="3" {...line} />
          </g>
        )}
      </svg>
    </div>
  );
}

/**
 * One half of the court seen from behind the baseline (6.1 m wide, 6.7 m to the net), net along the
 * bottom edge; `flip` puts the net along the top. Decorative.
 */
export function HalfCourtLines({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <div className={cn('pointer-events-none absolute', className)} aria-hidden>
      <svg viewBox="0 0 61 67" preserveAspectRatio="none" overflow="visible" className={cn('size-full', flip && '-scale-y-100')}>
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="0" y="0" width="61" height="67" {...line} />
          <path d="M4.6 0 V67 M56.4 0 V67 M0 7.6 H61 M0 47.2 H61 M30.5 0 V47.2" {...line} />
        </g>
        <line x1="-3" y1="67" x2="64" y2="67" stroke="currentColor" strokeWidth="4" {...line} />
      </svg>
    </div>
  );
}

/** Two overlapping avatars with the names underneath. */
export function TeamStack({
  ids,
  align = 'start',
  size = 34,
  onCourt,
  className,
}: {
  ids: PlayerId[];
  align?: 'start' | 'end';
  size?: number;
  onCourt?: boolean;
  className?: string;
}) {
  const { nameOf, playersById } = useData();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', align === 'end' ? 'items-end text-right' : 'items-start', className)}>
      <div className={cn('flex', align === 'end' && 'flex-row-reverse')}>
        {ids.map((id, i) => (
          <Avatar
            key={id}
            name={nameOf(id)}
            photo={playersById.get(id)?.photo}
            size={size}
            className={cn(i > 0 && (align === 'end' ? '-mr-2.5' : '-ml-2.5'), onCourt && 'ring-court')}
          />
        ))}
      </div>
      <div className="min-w-0 max-w-full text-[15px] leading-tight font-bold tracking-tight">
        {ids.map((id) => (
          <div key={id} className="truncate">
            {nameOf(id)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A match drawn on a court: Team 1 in the left half, Team 2 in the right, the net between.
 * `scoreA` / `scoreB` go under each team (score boxes, or the final score).
 */
export function CourtMatch({
  teamA,
  teamB,
  scoreA,
  scoreB,
  labels = ['Team 1', 'Team 2'],
  className,
}: {
  teamA: PlayerId[];
  teamB: PlayerId[];
  scoreA?: ReactNode;
  scoreB?: ReactNode;
  labels?: [string, string];
  className?: string;
}) {
  return (
    <div className={cn('relative mx-auto grid w-full max-w-xl grid-cols-2 rounded-md text-court-ink', className)}>
      <CourtLines className="inset-0 text-court-ink" />
      {(
        [
          [teamA, scoreA, labels[0], 'start'],
          [teamB, scoreB, labels[1], 'end'],
        ] as const
      ).map(([ids, score, label, align]) => (
        <div
          key={label}
          className={cn('relative flex min-w-0 flex-col justify-between gap-3 py-3', align === 'start' ? 'pr-5 pl-[9%]' : 'pr-[9%] pl-5 items-end')}
        >
          <span className="text-[10.5px] font-bold tracking-[0.16em] uppercase opacity-75">{label}</span>
          <TeamStack ids={ids} align={align} onCourt />
          {score}
        </div>
      ))}
      <span className="font-score absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-volt text-sm font-black tracking-wider text-volt-ink shadow-[0_4px_14px_rgb(0_0_0/0.35)]">
        VS
      </span>
    </div>
  );
}

/** Win chance as a split bar: Team 1's share from the left, Team 2's from the right. */
export function ChanceBar({ chance, onCourt, className }: { chance: number; onCourt?: boolean; className?: string }) {
  const [a, b] = odds(chance);
  return (
    <div className={cn('mx-auto flex w-full max-w-xl items-center gap-2.5', className)} title={`Win chance: Team 1 ${a}%, Team 2 ${b}%`}>
      <span className="font-score tabular w-9 text-base leading-none font-extrabold">{a}%</span>
      <div className={cn('flex h-2 flex-1 gap-0.5 overflow-hidden rounded-full', onCourt ? 'bg-black/20' : 'bg-surface-2')} aria-hidden>
        <span className={cn('rounded-full', onCourt ? 'bg-volt' : 'bg-primary')} style={{ width: `${a}%` }} />
        <span className={cn('flex-1 rounded-full', onCourt ? 'bg-court-ink/70' : 'bg-muted/45')} />
      </div>
      <span className="font-score tabular w-9 text-right text-base leading-none font-extrabold">{b}%</span>
    </div>
  );
}
