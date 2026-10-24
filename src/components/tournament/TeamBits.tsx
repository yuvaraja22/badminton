import { useData } from '../../lib/data/context';
import { cn } from '../../lib/cn';
import { teamScore } from '../../lib/engine/tournament';
import { teamFill, teamName } from '../../lib/teamColors';
import type { PlayerId, TeamKey, Tournament } from '../../lib/types';
import { Badge, LiveDot } from '../ui/Badge';

/** A small dot in the team's colour (identity is never colour alone: the team name sits next to it). */
export function TeamDot({ t, team, className }: { t: Tournament; team: TeamKey; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: teamFill(t, team) }} />;
}

/** "Vikram & Anu" with a bar in the team's colour. */
export function SideNames({ t, team, ids, strong, className }: { t: Tournament; team: TeamKey; ids: PlayerId[]; strong?: boolean; className?: string }) {
  const { nameOf } = useData();
  return (
    <span className={cn('flex min-w-0 items-center gap-2', className)}>
      <span aria-hidden className="h-4 w-1 shrink-0 rounded-full" style={{ background: teamFill(t, team) }} />
      <span className={cn('truncate', strong && 'font-bold')}>{ids.map(nameOf).join(' & ') || '–'}</span>
      <span className="sr-only">({teamName(t, team)})</span>
    </span>
  );
}

/** Matches won by each team, in the team colours, with points and what's left underneath. */
export function TeamScoreBar({ t, className }: { t: Tournament; className?: string }) {
  const score = teamScore(t);
  const finished = t.status === 'completed';
  const block = (key: TeamKey) => (
    <div
      className={cn('flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-white', key === 'b' && 'flex-row-reverse text-right')}
      style={{ background: `repeating-linear-gradient(${key === 'a' ? 115 : 65}deg, rgb(255 255 255 / 0.07) 0 9px, transparent 9px 18px), ${teamFill(t, key)}` }}
    >
      <span className="min-w-0 flex-1 truncate font-bold tracking-tight">{teamName(t, key)}</span>
      <span className="font-score tabular text-[2.75rem] leading-none font-black" aria-label={`${score.won[key]} matches won`}>
        {score.won[key]}
      </span>
    </div>
  );
  const line =
    score.played === 0
      ? 'Matches won appear here once play starts.'
      : `${finished && score.leader ? `${teamName(t, score.leader)} win · ` : ''}Points ${score.points.a}–${score.points.b} · ${score.played} played${score.remaining ? ` · ${score.remaining} to play` : ''}`;
  return (
    <div className={className}>
      <div className="flex gap-1 overflow-hidden rounded-[1.1rem] shadow-[0_10px_24px_-14px_rgb(0_0_0/0.5)]">
        {block('a')}
        {block('b')}
      </div>
      <p className="mt-1.5 text-center text-xs text-muted">{line}</p>
    </div>
  );
}

export function TournamentStatusBadge({ t }: { t: Pick<Tournament, 'status'> }) {
  if (t.status === 'live')
    return (
      <Badge tone="live">
        <LiveDot /> Live
      </Badge>
    );
  return t.status === 'completed' ? <Badge tone="good">Final</Badge> : <Badge tone="info">Upcoming</Badge>;
}
