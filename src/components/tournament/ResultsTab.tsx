import { Link } from 'react-router';
import { Trophy } from 'lucide-react';
import { useData } from '../../lib/data/context';
import { playerRecords, resultLine, teamScore } from '../../lib/engine/tournament';
import { signed } from '../../lib/format';
import { teamName } from '../../lib/teamColors';
import type { Tournament } from '../../lib/types';
import { Card, CardHeader } from '../ui/Card';
import { Stat } from '../ui/Stat';
import { TeamDot } from './TeamBits';

export function ResultsTab({ t }: { t: Tournament }) {
  const { nameOf, pathOf } = useData();
  const s = teamScore(t);
  const lines = playerRecords(t).filter((l) => l.doubles + l.singles > 0);
  const total = s.played + s.remaining;
  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3 p-4">
        {t.status === 'completed' && s.leader && <Trophy size={22} className="shrink-0 text-warn" aria-hidden />}
        <div className="min-w-0">
          <p className="text-lg font-bold">{resultLine(t)}</p>
          <p className="text-sm text-muted">Most matches won takes the tournament; total points break a tie.</p>
        </div>
      </Card>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Matches won" value={`${s.won.a}–${s.won.b}`} sub={`${teamName(t, 'a')} – ${teamName(t, 'b')}`} />
        <Stat label="Points" value={`${s.points.a}–${s.points.b}`} sub="finished matches" />
        <Stat label="Played" value={`${s.played}/${total}`} sub={s.remaining ? `${s.remaining} to play` : 'all done'} />
      </div>
      {lines.length > 0 && (
        <Card>
          <CardHeader title="Players" subtitle="Finished matches. The common player's results count for the side they played on." />
          <table className="tabular mt-2 w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="px-4 py-1.5 text-left font-semibold">Player</th>
                <th className="px-2 py-1.5 font-semibold">Played</th>
                <th className="px-2 py-1.5 font-semibold">W–L</th>
                <th className="px-4 py-1.5 font-semibold">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map((l) => (
                <tr key={l.playerId}>
                  <td className="px-4 py-2">
                    <Link to={pathOf(l.playerId)} className="flex min-w-0 items-center gap-2 hover:underline">
                      {(l.team === 'a' || l.team === 'both') && <TeamDot t={t} team="a" />}
                      {(l.team === 'b' || l.team === 'both') && <TeamDot t={t} team="b" />}
                      <span className="truncate font-semibold">{nameOf(l.playerId)}</span>
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {l.played}/{l.doubles + l.singles}
                  </td>
                  <td className="px-2 py-2 text-center font-semibold">
                    {l.won}–{l.lost}
                  </td>
                  <td className="px-4 py-2 text-center">{l.played ? signed(l.pointsFor - l.pointsAgainst) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
