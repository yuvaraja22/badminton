import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Swords, Trophy } from 'lucide-react';
import { useData } from '../lib/data/context';
import { allTimeStats } from '../lib/engine/alltime';
import { isCounted, sideOf } from '../lib/engine/games';
import { headToHead } from '../lib/engine/stats';
import { isoDaysAgo, pctRound, shortDate, signed } from '../lib/format';
import { PartnershipList, StandingsTable } from '../components/stats/StandingsTable';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, Empty, PageTitle, Spinner } from '../components/ui/Card';
import { Select } from '../components/ui/Field';
import { Segmented } from '../components/ui/Segmented';

/** Last 30 days is the default view; all-time is one tap away (and linkable as ?range=all). */
type Period = '30d' | 'all';

function HeadToHead({ games }: { games: Parameters<typeof headToHead>[0] }) {
  const { players, nameOf } = useData();
  const [p1, setP1] = useState(players[0]?.id ?? '');
  const [p2, setP2] = useState(players[1]?.id ?? '');
  const h = useMemo(() => (p1 && p2 && p1 !== p2 ? headToHead(games, p1, p2) : null), [games, p1, p2]);

  return (
    <Card>
      <CardHeader title="Head to head" action={<Swords size={18} className="text-muted" />} />
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Select value={p1} onChange={(e) => setP1(e.target.value)} aria-label="First player">
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <span className="text-xs font-bold uppercase text-muted">vs</span>
          <Select value={p2} onChange={(e) => setP2(e.target.value)} aria-label="Second player">
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        {h && (
          <>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-surface-2 p-3">
                <div className="text-xs font-bold uppercase text-muted">As partners</div>
                <div className="tabular mt-1 text-2xl font-bold">
                  {h.together.won}-{h.together.lost}
                </div>
                <div className="text-xs text-muted">
                  {h.together.played ? `${pctRound(h.together.won / h.together.played)} · ${signed(h.together.diff)} pts` : 'Never paired'}
                </div>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <div className="text-xs font-bold uppercase text-muted">Against each other</div>
                <div className="tabular mt-1 text-2xl font-bold">
                  {h.against.p1Won}-{h.against.p2Won}
                </div>
                <div className="text-xs text-muted">
                  {h.against.played ? `${nameOf(p1)} ${signed(h.against.diff)} pts` : 'Never faced'}
                </div>
              </div>
            </div>
            {h.meetings.length > 0 && (
              <ul className="divide-y divide-line text-sm">
                {h.meetings
                  .slice(-6)
                  .reverse()
                  .map((g) => {
                    const s1 = sideOf(g, p1)!;
                    const s2 = sideOf(g, p2)!;
                    const [f, a] = s1 === 'A' ? [g.scoreA, g.scoreB] : [g.scoreB, g.scoreA];
                    return (
                      <li key={`${g.sessionId}-${g.number}`} className="flex items-center justify-between gap-2 py-2">
                        <Link to={`/sessions/${g.sessionId}?tab=report`} className="text-muted hover:underline">
                          {shortDate(g.date)} · M{g.number}
                        </Link>
                        <span>
                          {s1 === s2 ? 'Together' : 'Against'} ·{' '}
                          <span className="tabular font-semibold">
                            {f}-{a}
                          </span>
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export default function LeaderboardPage() {
  const { history, nameOf, ready } = useData();
  const [params, setParams] = useSearchParams();
  const period: Period = params.get('range') === 'all' ? 'all' : '30d';
  const setPeriod = (p: Period) => setParams(p === 'all' ? { range: 'all' } : {}, { replace: true });
  const [minGames, setMinGames] = useState<string>('auto');
  const [allPairs, setAllPairs] = useState(false);

  const stats = useMemo(() => {
    const from = period === '30d' ? isoDaysAgo(30) : undefined;
    return allTimeStats(history, nameOf, { from, minGames: minGames === 'auto' ? undefined : Number(minGames) });
  }, [history, nameOf, period, minGames]);

  if (!ready) return <Spinner />;

  const pairs = allPairs ? stats.partnerships : stats.partnerships.filter((p) => p.played >= 3);

  return (
    <div className="space-y-4">
      <PageTitle title="Leaderboard" subtitle={`${stats.sessionCount} sessions · ${stats.games.filter(isCounted).length} matches`} />
      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { value: '30d', label: 'Last 30 days' },
          { value: 'all', label: 'All time' },
        ]}
      />
      {!stats.standings.length ? (
        <Empty icon={<Trophy size={28} />} title={period === '30d' ? 'No games in the last 30 days' : 'No results yet'}>
          {period === '30d' && (
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => setPeriod('all')}>
              Show all time
            </Button>
          )}
        </Empty>
      ) : (
        <>
          <Card>
            <CardHeader title="Players" subtitle="Ranked by win rate, then point difference. Players below the minimum games are listed last." />
            <div className="px-4 pt-3">
              <Select value={minGames} onChange={(e) => setMinGames(e.target.value)} className="h-9 w-auto text-sm" aria-label="Minimum games">
                <option value="auto">Min games: auto (up to 10)</option>
                {[0, 5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    Min {n} games
                  </option>
                ))}
              </Select>
            </div>
            <div className="pt-2 pb-2">
              <StandingsTable rows={stats.standings} showSessions />
            </div>
          </Card>
          <Card>
            <CardHeader title="Partnerships" subtitle={allPairs ? 'All pairs' : 'Pairs with 3+ games together'} />
            <div className="pt-2">
              <PartnershipList rows={pairs} limit={allPairs ? undefined : 15} />
              {!pairs.length && <p className="px-4 pb-4 text-sm text-muted">No pair has played 3 games together yet.</p>}
            </div>
            <div className="border-t border-line p-2 text-center">
              <Button variant="ghost" size="sm" onClick={() => setAllPairs(!allPairs)}>
                {allPairs ? 'Show top pairs only' : 'Show all pairs'}
              </Button>
            </div>
          </Card>
          <HeadToHead games={stats.games} />
        </>
      )}
    </div>
  );
}
