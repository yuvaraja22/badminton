import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ChevronLeft, Pencil, Share2 } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { playerProfile } from '../lib/engine/alltime';
import { partnerOf, sideOf, teamOf, otherSide, winnerSide } from '../lib/engine/games';
import type { RelationLine } from '../lib/engine/stats';
import { oneDecimal, pct, pctRound, shortDate, signed } from '../lib/format';
import { levelName } from '../lib/levels';
import { shareLink } from '../lib/share';
import { findPlayer } from '../lib/slug';
import { ClaimButton } from '../components/players/ClaimButton';
import { PlayerDialog } from '../components/players/PlayerDialog';
import { PlayerHero } from '../components/players/PlayerHero';
import { AchievementsCard, FormStrip, PartnerCards, SessionsList } from '../components/players/ProfileSections';
import { ProfileDetails } from '../components/players/ProfileDetails';
import { ProgressCard } from '../components/stats/ProgressCard';
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

  return (
    <div className="space-y-4">
      <Link to="/players" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Players
      </Link>

      <PlayerHero
        player={player}
        line={line}
        badges={
          <>
            {isMe && <Badge tone="volt">You</Badge>}
            <Badge tone="info">{levelName(player.level)}</Badge>
            {!player.active && <Badge>Archived</Badge>}
            {profile.firstDate && <span className="text-xs opacity-75">Since {shortDate(profile.firstDate)}</span>}
          </>
        }
        actions={
          <>
            <Button
              variant="volt"
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
            {!isAdmin && <ClaimButton player={player} />}
          </>
        }
      />
      {(player.bio || player.hand || player.position || player.racket) && (
        <Card className="p-4">
          <ProfileDetails player={player} />
        </Card>
      )}

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

          <FormStrip form={profile.form} />

          <ProgressCard playerId={player.id} sessions={sessions} />

          <PartnerCards partners={profile.partners} opponents={profile.opponents} />

          <AchievementsCard playerId={player.id} />

          <div className="grid gap-4 lg:grid-cols-2">
            <RelationTable rows={profile.partners} title="Partners" subtitle="Record when playing together" />
            <RelationTable rows={profile.opponents} title="Opponents" subtitle="Record when on the other side of the net" />
          </div>

          <SessionsList sessions={sessions} />

          <Card>
            <CardHeader title="Recent matches" />
            <ul className="divide-y divide-line pt-2 text-sm">
              {profile.recent.map((g) => {
                const side = sideOf(g, player.id)!;
                const won = winnerSide(g) === side;
                const [f, a] = side === 'A' ? [g.scoreA, g.scoreB] : [g.scoreB, g.scoreA];
                const partner = partnerOf(g, player.id);
                const opp = teamOf(g, otherSide(side));
                return (
                  <li key={`${g.sessionId}-${g.number}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={clsx('font-score inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-base font-black', won ? 'bg-good text-good-bg' : 'border-2 border-bad/45 text-bad')}>
                      {won ? 'W' : 'L'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">
                        {partner ? (
                          <>
                            with <strong>{nameOf(partner)}</strong> vs {opp.map(nameOf).join(' & ')}
                          </>
                        ) : (
                          <>Singles vs {opp.map(nameOf).join(' & ')}</>
                        )}
                      </span>
                      <span className="text-xs text-muted">
                        {shortDate(g.date)} · M{g.number}
                      </span>
                    </span>
                    <span className="font-score tabular shrink-0 text-xl leading-none font-black">
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
