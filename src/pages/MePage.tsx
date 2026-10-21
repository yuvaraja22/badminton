import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, LogIn, Pencil, Trophy, UserRound } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { allTimeStats, playerProfile } from '../lib/engine/alltime';
import type { RelationLine } from '../lib/engine/stats';
import { isoDaysAgo, pct, shortDate, signed } from '../lib/format';
import { usingEmulators } from '../lib/firebase';
import { levelName } from '../lib/levels';
import { PhotoButton } from '../components/players/PhotoButton';
import { PlayerDialog } from '../components/players/PlayerDialog';
import { ProfileDetails } from '../components/players/ProfileDetails';
import { NextSessionCard } from '../components/session/NextSessionCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, Empty, Spinner } from '../components/ui/Card';
import { Stat } from '../components/ui/Stat';
import { RatingBadge } from '../components/stats/RatingBadge';
import { RatingHistoryCard } from '../components/stats/RatingChart';

/** Personal dashboard for a signed-in player linked to a profile. */
export default function MePage() {
  const { user, loading, signIn, playerId, isAdmin } = useAuth();
  const { playersById, history, nameOf, pathOf, ready } = useData();
  const [editing, setEditing] = useState(false);
  const me = playerId ?? '';
  const profile = useMemo(() => playerProfile(history, nameOf, me), [history, nameOf, me]);
  const recent = useMemo(
    () => allTimeStats(history, nameOf, { from: isoDaysAgo(30), minGames: 0 }).standings.find((l) => l.playerId === me) ?? null,
    [history, nameOf, me],
  );

  if (loading || !ready) return <Spinner />;
  if (!user) {
    return (
      <Empty icon={<LogIn size={28} />} title="Sign in to see your stats">
        <p>Your record, form and next session in one place.</p>
        <Button className="mt-3" onClick={() => signIn(usingEmulators ? 'admin@example.com' : undefined)}>
          Sign in with Google
        </Button>
      </Empty>
    );
  }
  const player = playerId ? playersById.get(playerId) : undefined;
  if (!player) {
    return (
      <Empty icon={<UserRound size={28} />} title="Your account isn't linked to a player yet">
        Ask an admin to add <strong>{user.email}</strong> to your profile (Players → your name → Edit → Linked Google account).
      </Empty>
    );
  }

  const { line } = profile;
  const pick = (rows: RelationLine[], best: boolean) =>
    [...rows].filter((r) => r.played >= 3).sort((a, b) => (best ? b.winRate - a.winRate || b.diff - a.diff : a.winRate - b.winRate || a.diff - b.diff))[0];
  const bestPartner = pick(profile.partners, true);
  const toughest = pick(profile.opponents, false);

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-4">
          <PhotoButton player={player} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">Hi,</p>
            <h1 className="truncate text-2xl leading-tight font-bold">{player.name}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone="info">{levelName(player.level)}</Badge>
              <RatingBadge playerId={player.id} />
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Edit
            </Button>
            <Link to={pathOf(player.id)} className="inline-flex h-8 items-center justify-center gap-1 rounded-xl px-3 text-sm font-semibold text-primary-text hover:bg-surface-2">
              Profile <ChevronRight size={14} />
            </Link>
          </div>
        </div>
        <ProfileDetails player={player} />
      </Card>

      <NextSessionCard />

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Last 30 days" value={recent ? `${recent.won}-${recent.lost}` : '–'} sub={recent ? `${pct(recent.winRate)} win rate` : 'No games yet'} />
        <Stat label="All time" value={line ? `${line.won}-${line.lost}` : '–'} sub={line ? `${pct(line.winRate)} · ${line.played} matches` : 'No games yet'} />
        <Stat label="Point difference" value={line ? signed(line.diff) : '–'} sub={recent ? `${signed(recent.diff)} in the last 30 days` : undefined} />
        <Stat label="MVP awards" value={String(profile.mvps)} sub={`${profile.sessions.length} sessions`} />
      </div>

      <RatingHistoryCard playerId={player.id} title="Your skill rating" />

      {profile.form.length > 0 && (
        <Card>
          <CardHeader title="Your last 10 games" subtitle="Most recent first" />
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
      )}

      {(bestPartner || toughest) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {bestPartner && (
            <Card className="p-4">
              <div className="text-xs font-bold uppercase text-muted">Your best partner</div>
              <Link to={pathOf(bestPartner.otherId)} className="mt-1 block text-lg font-bold hover:underline">
                {nameOf(bestPartner.otherId)}
              </Link>
              <div className="text-sm text-muted">
                {bestPartner.won}-{bestPartner.lost} together · {signed(bestPartner.diff)} pts
              </div>
            </Card>
          )}
          {toughest && (
            <Card className="p-4">
              <div className="text-xs font-bold uppercase text-muted">Your toughest opponent</div>
              <Link to={pathOf(toughest.otherId)} className="mt-1 block text-lg font-bold hover:underline">
                {nameOf(toughest.otherId)}
              </Link>
              <div className="text-sm text-muted">
                {toughest.won}-{toughest.lost} against · {signed(toughest.diff)} pts
              </div>
            </Card>
          )}
        </div>
      )}

      {profile.sessions.length > 0 && (
        <Card>
          <CardHeader title="Your recent sessions" />
          <ul className="tabular divide-y divide-line pt-2 text-sm">
            {profile.sessions.slice(0, 5).map((s) => (
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
      )}

      <PlayerDialog open={editing} onClose={() => setEditing(false)} player={player} mode={isAdmin ? 'admin' : 'self'} />
    </div>
  );
}
