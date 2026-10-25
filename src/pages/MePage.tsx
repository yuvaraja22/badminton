import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, LogIn, Pencil, UserRound } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { allTimeStats, playerProfile } from '../lib/engine/alltime';
import { isoDaysAgo, pct, signed } from '../lib/format';
import { usingEmulators } from '../lib/firebase';
import { levelName } from '../lib/levels';
import { ClaimButton } from '../components/players/ClaimButton';
import { PlayerHero } from '../components/players/PlayerHero';
import { PlayerDialog } from '../components/players/PlayerDialog';
import { ProfileDetails } from '../components/players/ProfileDetails';
import { AchievementsCard, FormStrip, PartnerCards, SessionsList } from '../components/players/ProfileSections';
import { NextSessionCard } from '../components/session/NextSessionCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, Empty, Spinner } from '../components/ui/Card';
import { Select } from '../components/ui/Field';
import { Stat } from '../components/ui/Stat';
import { RatingHistoryCard } from '../components/stats/RatingChart';

/** Signed in but not linked yet: pick your own profile and ask an admin to confirm. */
function FindMe() {
  const { user, claim } = useAuth();
  const { players, playersById, nameOf } = useData();
  const options = players.filter((p) => p.active);
  const [choice, setChoice] = useState(claim?.playerId ?? options[0]?.id ?? '');
  const picked = playersById.get(choice);
  return (
    <div className="space-y-4">
      <Empty icon={<UserRound size={28} />} title="Your account isn't linked to a player yet">
        Pick your name and tap <strong>This is me</strong>. Once an admin confirms, you can edit your profile, RSVP and see your stats here.
      </Empty>
      <Card>
        <CardHeader title="Which player are you?" subtitle={`Signed in as ${user?.email}`} />
        <div className="flex flex-wrap items-center gap-2 p-4">
          <Select value={choice} onChange={(e) => setChoice(e.target.value)} className="min-w-48 flex-1" aria-label="Your name">
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          {picked && <ClaimButton player={picked} size="md" />}
        </div>
        {claim && (
          <p className="px-4 pb-4 text-sm text-muted">
            You asked to be linked to <strong>{nameOf(claim.playerId)}</strong>. An admin will confirm it soon.
          </p>
        )}
      </Card>
    </div>
  );
}

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
  if (!player) return <FindMe />;

  const { line } = profile;

  return (
    <div className="space-y-4">
      <PlayerHero
        player={player}
        line={line}
        kicker="Hi,"
        badges={<Badge tone="info">{levelName(player.level)}</Badge>}
        actions={
          <>
            <Button variant="volt" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Edit profile
            </Button>
            <Link to={pathOf(player.id)}>
              <Button variant="secondary" size="sm">
                Public profile <ChevronRight size={14} />
              </Button>
            </Link>
          </>
        }
      />
      {(player.bio || player.hand || player.position || player.racket) && (
        <Card className="p-4">
          <ProfileDetails player={player} />
        </Card>
      )}

      <NextSessionCard />

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Last 30 days" value={recent ? `${recent.won}-${recent.lost}` : '–'} sub={recent ? `${pct(recent.winRate)} win rate` : 'No games yet'} />
        <Stat label="All time" value={line ? `${line.won}-${line.lost}` : '–'} sub={line ? `${pct(line.winRate)} · ${line.played} matches` : 'No games yet'} />
        <Stat label="Point difference" value={line ? signed(line.diff) : '–'} sub={recent ? `${signed(recent.diff)} in the last 30 days` : undefined} />
        <Stat label="MVP awards" value={String(profile.mvps)} sub={`${profile.sessions.length} sessions`} />
      </div>

      <RatingHistoryCard playerId={player.id} title="Your skill rating" />
      <FormStrip form={profile.form} title="Your last 10 games" />
      <AchievementsCard playerId={player.id} />
      <PartnerCards partners={profile.partners} opponents={profile.opponents} you />
      <SessionsList sessions={profile.sessions} title="Your recent sessions and tournaments" limit={5} />

      <PlayerDialog open={editing} onClose={() => setEditing(false)} player={player} mode={isAdmin ? 'admin' : 'self'} />
    </div>
  );
}
