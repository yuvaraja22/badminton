import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ChevronLeft, Pencil, Share2, Trophy } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { playerProfile } from '../lib/engine/alltime';
import { partnerOf, sideOf, teamOf, otherSide, winnerSide } from '../lib/engine/games';
import type { RelationLine } from '../lib/engine/stats';
import { longDate, oneDecimal, pct, pctRound, shortDate, signed } from '../lib/format';
import { levelName } from '../lib/levels';
import { shareLink } from '../lib/share';
import { findPlayer } from '../lib/slug';
import { PlayerDialog } from '../components/players/PlayerDialog';
import { PhotoButton } from '../components/players/PhotoButton';
import { ProfileDetails } from '../components/players/ProfileDetails';
import { RatingBadge } from '../components/stats/RatingBadge';
import { WinRateChart } from '../components/stats/WinRateChart';
import { Badge, DiffPill } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, Empty, Spinner } from '../components/ui/Card';
import { Stat } from '../components/ui/Stat';

function RelationTable({ rows, title, subtitle }: { rows: RelationLine[]; title: string; subtitle: string }) {
  const { nameOf, pathOf } = useData();
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <ul className="tabular divide-y divide-line pt-2 text-sm">
        {rows.map((r) => (
          <li key={r.otherId} className="flex items-center justify-between gap-2 px-4 py-2.5">
            <Link to={pathOf(r.otherId)} className="min-w-0 truncate font-semibold hover:underline">
              {nameOf(r.otherId)}
            </Link>
            <span className="flex shrink-0 items-center gap-3">
              <span className="text-muted">
                {r.won}-{r.lost} ({pctRound(r.winRate)})
              </span>
              <DiffPill value={r.diff} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function PlayerPage() {
  // The URL ends with the player's name (/players/vikram); older links with the id still work.
  const { id: param = '' } = useParams();
  const { players, history, nameOf, pathOf, ready } = useData();
  const { isAdmin, playerId: myPlayerId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [editing, setEditing] = useState(false);
  const player = useMemo(() => findPlayer(players, param), [players, param]);
  const profile = useMemo(() => playerProfile(history, nameOf, player?.id ?? ''), [history, nameOf, player]);
  const canonical = player ? pathOf(player.id) : null;

  // Show the name-based address even when the page was opened with an id link.
  useEffect(() => {
    if (canonical && decodeURIComponent(location.pathname) !== decodeURIComponent(canonical)) {
      navigate(canonical, { replace: true });
    }
  }, [canonical, location.pathname, navigate]);

  if (!ready) return <Spinner />;
  if (!player) {
    return (
      <Empty title="Player not found">
        The name in the link may have changed. <Link to="/players" className="font-semibold underline">See all players</Link>
      </Empty>
    );
  }

  const { line, sessions } = profile;
  const isMe = myPlayerId === player.id;
  const chartData = [...sessions].reverse().map((s) => ({
    label: shortDate(s.date),
    title: s.title,
    winRate: Math.round(s.winRate * 1000) / 10,
    record: `${s.won}-${s.lost}`,
  }));
  const qualified = (r: RelationLine) => r.played >= 3;
  const bestPartner = [...profile.partners].filter(qualified).sort((a, b) => b.winRate - a.winRate || b.diff - a.diff)[0];
  const toughest = [...profile.opponents].filter(qualified).sort((a, b) => a.winRate - b.winRate || a.diff - b.diff)[0];

  return (
    <div className="space-y-4">
      <Link to="/players" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Players
      </Link>

      <Card className="space-y-3 p-4">
      <div className="flex items-center gap-4">
        <PhotoButton player={player} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{player.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {isMe && <Badge tone="good">You</Badge>}
            <Badge tone="info">{levelName(player.level)}</Badge>
            <RatingBadge playerId={player.id} />
            {!player.active && <Badge>Archived</Badge>}
            {profile.firstDate && <span>Playing since {longDate(profile.firstDate)}</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              shareLink({
                title: `${player.name} · Badminton Stats`,
                text: line
                  ? `${player.name}'s badminton record: ${line.won}-${line.lost} (${pct(line.winRate)} wins) in ${line.played} matches.`
                  : `${player.name}'s badminton profile.`,
                url: `${window.location.origin}${pathOf(player.id)}`,
              })
            }
          >
            <Share2 size={14} /> Share
          </Button>
          {(isAdmin || isMe) && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Edit
            </Button>
          )}
        </div>
      </div>
      <ProfileDetails player={player} />
      </Card>

      {!line ? (
        <Empty title="No completed matches yet">Stats appear after this player's first finished session.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Matches" value={String(line.played)} sub={`${sessions.length} sessions`} />
            <Stat label="Won – lost" value={`${line.won}-${line.lost}`} sub={`${pct(line.winRate)} win rate`} />
            <Stat label="Point difference" value={signed(line.diff)} sub={`${line.pointsFor} for · ${line.pointsAgainst} against`} />
            <Stat label="Points per game" value={oneDecimal(line.ppg)} sub={`${oneDecimal(line.papg)} conceded`} />
            <Stat label="MVP awards" value={String(profile.mvps)} />
            <Stat
              label="Best session"
              value={sessions.length ? `#${Math.min(...sessions.map((s) => s.rank))}` : '–'}
              sub={sessions.length ? `of ${sessions.find((s) => s.rank === Math.min(...sessions.map((x) => x.rank)))?.of} players` : undefined}
            />
          </div>

          <Card>
            <CardHeader title="Last 10 games" subtitle="Most recent first" />
            <div className="flex flex-wrap gap-1.5 p-4">
              {profile.form.map((r, i) => (
                <span
                  key={i}
                  className={clsx('inline-flex size-8 items-center justify-center rounded-lg text-sm font-bold', r === 'W' ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad')}
                  aria-label={r === 'W' ? 'Win' : 'Loss'}
                >
                  {r}
                </span>
              ))}
            </div>
          </Card>

          {chartData.length >= 2 && (
            <Card>
              <CardHeader title="Win rate by session" subtitle="Each point is one session; the sessions list below has the same numbers." />
              <div className="px-2 pt-3 pb-2">
                <WinRateChart data={chartData} />
              </div>
            </Card>
          )}

          {(bestPartner || toughest) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {bestPartner && (
                <Card className="p-4">
                  <div className="text-xs font-bold uppercase text-muted">Best partner (3+ games)</div>
                  <div className="mt-1 text-lg font-bold">{nameOf(bestPartner.otherId)}</div>
                  <div className="text-sm text-muted">
                    {bestPartner.won}-{bestPartner.lost} together · {signed(bestPartner.diff)} pts
                  </div>
                </Card>
              )}
              {toughest && (
                <Card className="p-4">
                  <div className="text-xs font-bold uppercase text-muted">Toughest opponent (3+ games)</div>
                  <div className="mt-1 text-lg font-bold">{nameOf(toughest.otherId)}</div>
                  <div className="text-sm text-muted">
                    {toughest.won}-{toughest.lost} against · {signed(toughest.diff)} pts
                  </div>
                </Card>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <RelationTable rows={profile.partners} title="Partners" subtitle="Record when playing together" />
            <RelationTable rows={profile.opponents} title="Opponents" subtitle="Record when on the other side of the net" />
          </div>

          <Card>
            <CardHeader title="Sessions" />
            <ul className="tabular divide-y divide-line pt-2 text-sm">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link to={`/sessions/${s.id}?tab=report`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <span className="w-24 shrink-0 text-muted">{shortDate(s.date)}</span>
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    {s.mvp && <Trophy size={15} className="shrink-0 text-warn" aria-label="MVP" />}
                    <span className="shrink-0 font-semibold">
                      {s.won}-{s.lost}
                    </span>
                    <span className="w-14 shrink-0 text-right text-muted">
                      #{s.rank}/{s.of}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Recent matches" />
            <ul className="divide-y divide-line pt-2 text-sm">
              {profile.recent.map((g) => {
                const side = sideOf(g, player.id)!;
                const won = winnerSide(g) === side;
                const [f, a] = side === 'A' ? [g.scoreA, g.scoreB] : [g.scoreB, g.scoreA];
                const partner = partnerOf(g, player.id)!;
                const opp = teamOf(g, otherSide(side));
                return (
                  <li key={`${g.sessionId}-${g.number}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={clsx('inline-flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold', won ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad')}>
                      {won ? 'W' : 'L'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        with <strong>{nameOf(partner)}</strong> vs {nameOf(opp[0])} &amp; {nameOf(opp[1])}
                      </span>
                      <span className="text-xs text-muted">
                        {shortDate(g.date)} · M{g.number}
                      </span>
                    </span>
                    <span className="tabular shrink-0 font-bold">
                      {f}-{a}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
      <PlayerDialog open={editing} onClose={() => setEditing(false)} player={player} mode={isAdmin ? 'admin' : 'self'} />
    </div>
  );
}
