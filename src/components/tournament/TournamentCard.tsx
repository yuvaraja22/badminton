import { Link } from 'react-router';
import { ChevronRight, Swords } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useData } from '../../lib/data/context';
import { liveMatch, nextMatch } from '../../lib/engine/tournament';
import { formatTime, matchCode, shortDate } from '../../lib/format';
import type { Tournament } from '../../lib/types';
import { LiveDot } from '../ui/Badge';
import { Card } from '../ui/Card';
import { TeamScoreBar } from './TeamBits';

/** Home page card for a live or upcoming tournament: the team score, what's on court and what's next. */
export function TournamentCard({ t }: { t: Tournament }) {
  const { nameOf } = useData();
  const live = liveMatch(t);
  const next = nextMatch(t);
  const names = (ids: string[]) => ids.map(nameOf).join(' & ');
  return (
    <Link to={live ? `/tournaments/${t.id}/matches/${live.id}` : `/tournaments/${t.id}`} className="block">
      <Card className={cn('overflow-hidden transition hover:shadow-md', live && 'border-accent/40')}>
        <div className={cn('flex items-center justify-between px-4 py-2.5', live ? 'bg-accent/10' : 'bg-surface-2')}>
          <span className={cn('flex items-center gap-2 text-[13px] font-bold tracking-wide uppercase', live ? 'text-accent' : 'text-muted')}>
            {live ? <LiveDot /> : <Swords size={14} aria-hidden />} {t.status === 'upcoming' ? 'Tournament coming up' : 'Tournament'}
          </span>
          <span className="text-sm text-muted">{shortDate(t.date)}</span>
        </div>
        <div className="space-y-3 px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-lg font-bold">{t.name}</h2>
            <ChevronRight className="shrink-0 text-muted" size={20} />
          </div>
          <TeamScoreBar t={t} />
          {live && (
            <p className="text-sm">
              <span className="font-semibold text-accent">On court {matchCode(live.order)}:</span> {names(live.a)} vs {names(live.b)}{' '}
              <strong className="tabular whitespace-nowrap">
                {live.scoreA}–{live.scoreB}
              </strong>
            </p>
          )}
          {next && (
            <p className="text-sm">
              <span className="font-semibold text-muted">
                {live ? 'Next' : 'First up'} {matchCode(next.order)}
                {next.time ? ` · ${formatTime(next.time)}` : ''}:
              </span>{' '}
              {names(next.a)} vs {names(next.b)}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
