import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Crown, Gauge, Swords, Trophy } from 'lucide-react';
import { useData } from '../lib/data/context';
import { allTimeStats, entryPath } from '../lib/engine/alltime';
import { pairKey } from '../lib/engine/games';
import { calibration, pairSynergy } from '../lib/engine/insights';
import { PROVISIONAL_GAMES, ratingStandings } from '../lib/engine/rating';
import { isCounted, sideOf } from '../lib/engine/games';
import { awards, periodFromKey, seasonOf, type Award } from '../lib/engine/seasons';
import { headToHead, type PairLine } from '../lib/engine/stats';
import { isoDaysAgo, pct, pctRound, shortDate, signed, todayISO } from '../lib/format';
import type { PlayerId } from '../lib/types';
import { Podium } from '../components/stats/Podium';
import { RatingTable } from '../components/stats/RatingTable';
import { PartnershipList, StandingsTable } from '../components/stats/StandingsTable';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, Empty, Notice, PageTitle, Spinner } from '../components/ui/Card';
import { Select } from '../components/ui/Field';
import { Segmented } from '../components/ui/Segmented';

/** Last 30 days is the default view; this season and all time are a tap away (and linkable). */
type Period = '30d' | 'season' | 'all';

function HeadToHead({ games }: { games: Parameters<typeof headToHead>[0] }) {
  const { players, nameOf, history } = useData();
  const options = players.filter((p) => !p.guest);
  const [p1, setP1] = useState(options[0]?.id ?? '');
  const [p2, setP2] = useState(options[1]?.id ?? '');
  const h = useMemo(() => (p1 && p2 && p1 !== p2 ? headToHead(games, p1, p2) : null), [games, p1, p2]);

  return (
    <Card>
      <CardHeader title="Head to head" action={<Swords size={18} className="text-muted" />} />
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Select value={p1} onChange={(e) => setP1(e.target.value)} aria-label="First player">
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <span className="font-score flex size-9 items-center justify-center rounded-full bg-chip text-sm font-black tracking-wider text-chip-ink">VS</span>
          <Select value={p2} onChange={(e) => setP2(e.target.value)} aria-label="Second player">
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        {h && (
          <>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-surface-2 p-3">
                <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted">As partners</div>
                <div className="font-score tabular mt-1 text-[2.4rem] leading-none font-black">
                  {h.together.won}-{h.together.lost}
                </div>
                <div className="text-xs text-muted">{h.together.played ? `${pctRound(h.together.won / h.together.played)} · ${signed(h.together.diff)} pts` : 'Never paired'}</div>
              </div>
              <div className="rounded-2xl bg-surface-2 p-3">
                <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted">Against each other</div>
                <div className="font-score tabular mt-1 text-[2.4rem] leading-none font-black">
                  {h.against.p1Won}-{h.against.p2Won}
                </div>
                <div className="text-xs text-muted">{h.against.played ? `${nameOf(p1)} ${signed(h.against.diff)} pts` : 'Never faced'}</div>
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
                        <Link to={entryPath(g.sessionId, history[g.sessionId]?.kind ?? 'session')} className="text-muted hover:underline">
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

/** Champions (seasons) or Players of the Month, newest first; the current one is "so far". */
function AwardsCard({ title, subtitle, list, onPick, limit }: { title: string; subtitle: string; list: Award[]; onPick?: (a: Award) => void; limit: number }) {
  const { nameOf, pathOf, playersById } = useData();
  if (!list.length) return null;
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} action={<Crown size={18} className="text-muted" />} />
      <ul className="divide-y divide-line pt-2 text-sm">
        {list.slice(0, limit).map((a) => (
          <li key={a.period.key} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-28 shrink-0">
              {onPick ? (
                <button type="button" onClick={() => onPick(a)} className="text-left font-semibold hover:underline">
                  {a.period.label}
                </button>
              ) : (
                <span className="font-semibold">{a.period.label}</span>
              )}
              {!a.final && <span className="block text-xs text-muted">so far</span>}
            </span>
            <Link to={pathOf(a.winner.playerId)} className="flex min-w-0 flex-1 items-center gap-2 font-semibold hover:underline">
              <Avatar name={nameOf(a.winner.playerId)} photo={playersById.get(a.winner.playerId)?.photo} size={28} className={a.final ? 'ring-volt' : undefined} />
              <span className="truncate">{nameOf(a.winner.playerId)}</span>
            </Link>
            <span className="tabular shrink-0 text-right text-muted">
              {a.winner.won}-{a.winner.lost} · {pctRound(a.winner.winRate)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function LeaderboardPage() {
  const { history, nameOf, ready, ratings, predictions, playersById } = useData();
  const [params, setParams] = useSearchParams();
  const range = params.get('range');
  const period: Period = range === 'all' ? 'all' : range === 'season' ? 'season' : '30d';
  const today = todayISO();
  const thisSeason = seasonOf(today);
  const seasonKey = period === 'season' ? (periodFromKey(params.get('season') ?? '')?.key ?? thisSeason.key) : null;
  const season = seasonKey ? periodFromKey(seasonKey) : null;
  const setPeriod = (p: Period) => setParams(p === 'all' ? { range: 'all' } : p === 'season' ? { range: 'season' } : {}, { replace: true });
  const [minGames, setMinGames] = useState<string>('auto');
  const [allPairs, setAllPairs] = useState(false);
  const [byOdds, setByOdds] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  // Guests play and appear in reports, but aren't ranked.
  const regular = useCallback((id: PlayerId) => playersById.has(id) && !playersById.get(id)?.guest, [playersById]);

  const dates = useMemo(() => {
    if (period === '30d') return { from: isoDaysAgo(30) };
    const s = seasonKey ? periodFromKey(seasonKey) : null;
    return s ? { from: s.from, to: s.to } : {};
  }, [period, seasonKey]);
  const stats = useMemo(() => allTimeStats(history, nameOf, { ...dates, minGames: minGames === 'auto' ? undefined : Number(minGames) }), [history, nameOf, dates, minGames]);
  const standings = stats.standings.filter((l) => regular(l.playerId));
  const synergy = useMemo(() => pairSynergy(predictions, history, dates), [predictions, history, dates]);
  const odds = useMemo(() => calibration(predictions, history, dates), [predictions, history, dates]);
  const seasons = useMemo(() => awards(history, nameOf, 'season', today, regular), [history, nameOf, today, regular]);
  const months = useMemo(() => awards(history, nameOf, 'month', today, regular), [history, nameOf, today, regular]);
  const ratingRows = useMemo(() => ratingStandings(ratings, (id) => (playersById.get(id)?.active ?? false) && !playersById.get(id)?.guest), [ratings, playersById]);

  if (!ready) return <Spinner />;

  const vsOdds = (p: PairLine) => synergy.get(pairKey(p.pair[0], p.pair[1]))?.above ?? null;
  const pairsAll = stats.partnerships.filter((p) => p.pair.every(regular));
  const sorted = byOdds ? [...pairsAll].sort((a, b) => (vsOdds(b) ?? 0) - (vsOdds(a) ?? 0) || b.played - a.played) : pairsAll;
  const pairs = allPairs ? sorted : sorted.filter((p) => p.played >= 3);
  const pastSeason = season && season.key !== thisSeason.key;
  const scope = period === '30d' ? 'in the last 30 days' : season ? `in ${season.label}` : 'so far';

  return (
    <div className="space-y-4">
      <PageTitle title="Leaderboard" subtitle={`${stats.sessionCount} sessions · ${stats.games.filter(isCounted).length} matches${season ? ` · ${season.label}` : ''}`} />
      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { value: '30d', label: '30 days' },
          { value: 'season', label: 'Season' },
          { value: 'all', label: 'All time' },
        ]}
      />
      {pastSeason && (
        <Notice>
          Showing the {season.label} season.{' '}
          <button type="button" className="font-semibold underline" onClick={() => setPeriod('season')}>
            Back to this season
          </button>
        </Notice>
      )}
      {!standings.length ? (
        <Empty icon={<Trophy size={28} />} title={period === 'all' ? 'No results yet' : `No games ${scope}`}>
          {period !== 'all' && (
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => setPeriod('all')}>
              Show all time
            </Button>
          )}
        </Empty>
      ) : (
        <>
          <Podium rows={standings} />
          <Card>
            <CardHeader
              title={season ? `${pastSeason ? '' : 'This season · '}${season.label}` : 'Players'}
              subtitle={`Ranked by win rate, then point difference. Players below the minimum games are listed last.${season ? ' The top qualified player is the season champion.' : ''}`}
            />
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
              <StandingsTable rows={standings} showSessions />
            </div>
          </Card>
          {ratingRows.length > 0 && (
            <Card>
              <CardHeader
                title="Skill ratings"
                subtitle={`From every game, on the level scale. Beating stronger teams and winning by more count for more. Provisional until ${PROVISIONAL_GAMES} games.`}
              />
              <div className="pt-1 pb-1">
                <RatingTable rows={ratingRows} />
              </div>
              {odds.games >= 10 && (
                <div className="border-t border-line">
                  <button type="button" onClick={() => setCalibrationOpen(!calibrationOpen)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold hover:bg-surface-2">
                    <Gauge size={16} className="text-muted" /> How good are the win chances?
                    <span className="ml-auto text-muted">
                      favourites won {pct(odds.favouriteWon / odds.games, 0)}
                    </span>
                  </button>
                  {calibrationOpen && (
                    <div className="space-y-2 px-4 pb-4 text-sm">
                      <p className="text-muted">
                        Before each game the ratings give both teams a win chance (shown on the court). In {odds.games} rated games {scope}, the team they favoured won {odds.favouriteWon}.
                      </p>
                      <table className="tabular w-full">
                        <thead>
                          <tr className="text-xs text-muted">
                            <th className="py-1 text-left font-semibold">When the court said</th>
                            <th className="py-1 font-semibold">Games</th>
                            <th className="py-1 font-semibold">Expected</th>
                            <th className="py-1 font-semibold">Favourite won</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line text-center">
                          {odds.buckets
                            .filter((b) => b.games)
                            .map((b) => (
                              <tr key={b.label}>
                                <td className="py-1.5 text-left">{b.label}</td>
                                <td className="py-1.5">{b.games}</td>
                                <td className="py-1.5">{pct(b.expected, 0)}</td>
                                <td className="py-1.5 font-semibold">{pct(b.won / b.games, 0)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      <p className="text-xs text-muted">The closer “Favourite won” is to “Expected”, the better the chances are. A few dozen games is still a small sample.</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
          <Card>
            <CardHeader
              title="Partnerships"
              subtitle={byOdds ? 'Most wins above what their ratings expected (the opposition they faced counts)' : allPairs ? 'All pairs' : 'Pairs with 3+ games together'}
            />
            <div className="px-4 pt-3">
              <Segmented
                value={byOdds ? 'odds' : 'record'}
                onChange={(v) => setByOdds(v === 'odds')}
                options={[
                  { value: 'record', label: 'Best record' },
                  { value: 'odds', label: 'Beat the odds' },
                ]}
              />
            </div>
            <div className="pt-2">
              <PartnershipList rows={pairs} limit={allPairs ? undefined : 15} vsOdds={byOdds ? vsOdds : undefined} />
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
      <AwardsCard
        title="Season champions"
        subtitle="Seasons run Jan–Mar, Apr–Jun, Jul–Sep and Oct–Dec. Tap one to see its table."
        list={seasons}
        limit={8}
        onPick={(a) => setParams({ range: 'season', season: a.period.key }, { replace: true })}
      />
      <AwardsCard title="Player of the Month" subtitle="Top of each month's table (enough games to qualify)." list={months} limit={6} />
    </div>
  );
}
