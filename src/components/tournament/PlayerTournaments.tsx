import { Link } from 'react-router';
import { useData } from '../../lib/data/context';
import { playerRecords, playerTeam, teamScore } from '../../lib/engine/tournament';
import { shortDate } from '../../lib/format';
import { teamName } from '../../lib/teamColors';
import type { PlayerId } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';
import { TeamDot, TournamentStatusBadge } from './TeamBits';

/** A player's team tournaments: their team, their record and how the team did. Kept apart from session stats. */
export function PlayerTournaments({ playerId, title = 'Tournaments' }: { playerId: PlayerId; title?: string }) {
  const { tournaments } = useData();
  const rows = (tournaments ?? []).flatMap((t) => {
    const team = playerTeam(t, playerId);
    const line = team ? playerRecords(t).find((l) => l.playerId === playerId) : undefined;
    return team && line ? [{ t, team, line }] : [];
  });
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader title={title} subtitle="Team tournaments. Not counted in the session stats." />
      <ul className="divide-y divide-line pt-2 text-sm">
        {rows.map(({ t, team, line }) => {
          const leader = teamScore(t).leader;
          const result = t.status !== 'completed' || team === 'both' ? null : leader === team ? 'Won' : leader ? 'Lost' : 'Draw';
          return (
            <li key={t.id}>
              <Link to={`/tournaments/${t.id}?tab=results`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                <span className="w-20 shrink-0 text-muted">{shortDate(t.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{t.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    {team !== 'b' && <TeamDot t={t} team="a" />}
                    {team !== 'a' && <TeamDot t={t} team="b" />}
                    {team === 'both' ? 'Both teams' : teamName(t, team)}
                  </span>
                </span>
                <span className="tabular shrink-0 font-semibold" aria-label={`${line.won} won, ${line.lost} lost`}>
                  {line.won}-{line.lost}
                </span>
                {result ? <Badge tone={result === 'Won' ? 'good' : result === 'Lost' ? 'bad' : 'neutral'}>{result}</Badge> : <TournamentStatusBadge t={t} />}
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
