import { Link } from 'react-router';
import { ChevronRight, Swords } from 'lucide-react';
import { teamScore } from '../../lib/engine/tournament';
import { teamName } from '../../lib/teamColors';
import type { Tournament } from '../../lib/types';
import { DateStub } from '../ui/DateStub';
import { TeamDot, TournamentStatusBadge } from './TeamBits';

/** A tournament in the Play list: name, status, and the teams with matches won once play starts. */
export function TournamentRow({ t }: { t: Tournament }) {
  const score = teamScore(t);
  const count = Object.keys(t.matches).length;
  return (
    <Link to={`/tournaments/${t.id}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2">
      <DateStub date={t.date} tone={t.status === 'completed' ? 'paper' : 'chip'} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-bold tracking-tight">{t.name}</span>
          {t.status === 'completed' ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted">
              <Swords size={12} aria-hidden /> Tournament
            </span>
          ) : (
            <TournamentStatusBadge t={t} />
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <TeamDot t={t} team="a" />
            {teamName(t, 'a')}
            {score.played > 0 ? (
              <strong className="font-score tabular text-base text-ink">
                {score.won.a}–{score.won.b}
              </strong>
            ) : (
              'vs'
            )}
            {teamName(t, 'b')}
            <TeamDot t={t} team="b" />
          </span>
          <span aria-hidden>·</span>
          <span>
            {count} match{count === 1 ? '' : 'es'}
          </span>
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </Link>
  );
}
