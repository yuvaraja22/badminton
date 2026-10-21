import { useMemo } from 'react';
import { Link } from 'react-router';
import { ChevronRight, FileText, Plus, Trophy, UserPlus } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { useQueuePlan } from '../lib/data/usePlan';
import { allTimeStats, summarizeHistory } from '../lib/engine/alltime';
import { sortedMatches } from '../lib/engine/games';
import { isoDaysAgo, matchCode, shortDate } from '../lib/format';
import type { Session } from '../lib/types';
import { InstallCard } from '../components/InstallCard';
import { NextSessionCard } from '../components/session/NextSessionCard';
import { StandingsTable } from '../components/stats/StandingsTable';
import { LiveDot } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, Empty, Spinner } from '../components/ui/Card';

function LiveSessionCard({ session }: { session: Session }) {
  const { nameOf } = useData();
  const plan = useQueuePlan(session, 1);
  const live = sortedMatches(session).find((m) => m.status === 'live');
  const next = plan?.upcoming[0];
  const team = (t: [string, string]) => `${nameOf(t[0])} & ${nameOf(t[1])}`;
  return (
    <Link to={`/sessions/${session.id}`} className="block">
      <Card className="overflow-hidden border-accent/40 transition hover:shadow-md">
        <div className="flex items-center justify-between bg-accent/10 px-4 py-2.5">
          <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-accent">
            <LiveDot /> Live now
          </span>
          <span className="text-sm text-muted">{shortDate(session.date)}</span>
        </div>
        <div className="space-y-2 px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-lg font-bold">{session.title}</h2>
            <ChevronRight className="shrink-0 text-muted" size={20} />
          </div>
          {live && (
            <p className="text-sm">
              <span className="font-semibold text-accent">On court {matchCode(live.number)}:</span> {team(live.teamA)} vs {team(live.teamB)}
            </p>
          )}
          {next && (
            <p className="text-sm">
              <span className="font-semibold text-muted">Up next:</span> {team(next.teamA)} vs {team(next.teamB)}
            </p>
          )}
          {!live && !next && <p className="text-sm text-muted">Waiting for players.</p>}
        </div>
      </Card>
    </Link>
  );
}

export default function HomePage() {
  const { liveSessions, history, nameOf, ready, players } = useData();
  const { isAdmin } = useAuth();
  const summaries = useMemo(() => summarizeHistory(history, nameOf), [history, nameOf]);
  // Home shows the last 30 days; all-time is one tap away on the leaderboard.
  const top = useMemo(
    () => allTimeStats(history, nameOf, { from: isoDaysAgo(30) }).standings.filter((l) => l.qualified).slice(0, 5),
    [history, nameOf],
  );
  const latest = summaries[0];

  if (!ready) return <Spinner />;

  return (
    <div className="space-y-5">
      {liveSessions.map((s) => (
        <LiveSessionCard key={s.id} session={s} />
      ))}

      {isAdmin && !liveSessions.length && (
        <Card className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold">Ready to play?</h2>
            <p className="text-sm text-muted">Pick who's here, set levels, and the app plans fair matches.</p>
          </div>
          <Link to="/sessions/new">
            <Button size="lg">
              <Plus size={18} /> Start a session
            </Button>
          </Link>
        </Card>
      )}

      <NextSessionCard />

      <InstallCard />

      {latest && (
        <Link to={`/sessions/${latest.id}`} className="block">
          <Card className="transition hover:shadow-md">
            <CardHeader title="Latest report" action={<FileText size={18} className="text-muted" />} />
            <div className="px-4 pt-1 pb-4">
              <h3 className="text-lg font-bold">{latest.title}</h3>
              <p className="text-sm text-muted">
                {shortDate(latest.date)} · {latest.matchCount} matches · {latest.playerIds.length} players
              </p>
              {latest.mvpId && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warn-bg px-3 py-1 text-sm font-semibold text-warn">
                  <Trophy size={14} /> MVP {nameOf(latest.mvpId)}
                </p>
              )}
            </div>
          </Card>
        </Link>
      )}

      {summaries.length > 0 && (
        <Card>
          <CardHeader
            title="Leaders · last 30 days"
            action={
              <Link to="/leaderboard?range=all" className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-primary-text hover:bg-surface-2">
                All time
              </Link>
            }
          />
          {top.length > 0 ? (
            <>
              <div className="pt-2">
                <StandingsTable rows={top} />
              </div>
              <div className="border-t border-line px-4 py-2.5 text-right">
                <Link to="/leaderboard" className="text-sm font-semibold text-primary-text hover:underline">
                  Full table
                </Link>
              </div>
            </>
          ) : (
            <p className="px-4 pt-2 pb-4 text-sm text-muted">No games in the last 30 days. Tap “All time” to see everyone's record.</p>
          )}
        </Card>
      )}

      {!liveSessions.length && !latest && (
        <Empty icon={<Trophy size={28} />} title="No sessions yet">
          Results will appear here after the first session.
          {isAdmin && !players.length && (
            <div className="mt-3 flex justify-center">
              <Link to="/players">
                <Button variant="secondary" size="sm">
                  <UserPlus size={15} /> Add players
                </Button>
              </Link>
            </div>
          )}
        </Empty>
      )}
    </div>
  );
}
