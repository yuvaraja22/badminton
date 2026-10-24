import { useMemo } from 'react';
import { Link } from 'react-router';
import { ChevronRight, FileText, Plus, Trophy, UserPlus } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { useQueuePlan } from '../lib/data/usePlan';
import { useWinChance } from '../lib/data/useWinChance';
import { allTimeStats, summarizeHistory } from '../lib/engine/alltime';
import { sortedMatches } from '../lib/engine/games';
import { isoDaysAgo, matchCode, odds, shortDate, todayISO } from '../lib/format';
import { Shuttle } from '../components/Logo';
import { ChanceBar, CourtLines, CourtMatch } from '../components/session/CourtView';
import { Avatar } from '../components/ui/Avatar';
import { DateStub } from '../components/ui/DateStub';
import type { Session } from '../lib/types';
import { InstallCard } from '../components/InstallCard';
import { NextSessionCard } from '../components/session/NextSessionCard';
import { TournamentCard } from '../components/tournament/TournamentCard';
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
  const chanceOf = useWinChance();
  return (
    <Link to={`/sessions/${session.id}`} className="group block">
      <section className="court-mat relative overflow-hidden rounded-[1.6rem] p-3 shadow-[var(--shadow-card)] transition group-hover:-translate-y-0.5">
        <div className="flex items-center gap-2 px-1 pt-0.5">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold tracking-[0.14em] text-accent-ink uppercase">
            <LiveDot /> Live now
          </span>
          {live && <span className="font-score text-xl leading-none font-black tracking-wide">{matchCode(live.number)} on court</span>}
          <span className="ml-auto text-sm opacity-75">{shortDate(session.date)}</span>
        </div>
        <div className="flex items-end justify-between gap-2 px-1 pt-2.5 pb-3">
          <h2 className="text-[1.55rem] leading-[1.05] font-extrabold tracking-[-0.03em]">{session.title}</h2>
          <ChevronRight className="mb-0.5 shrink-0 opacity-70 transition group-hover:translate-x-0.5" size={22} />
        </div>
        {live ? (
          <>
            <CourtMatch teamA={live.teamA} teamB={live.teamB} className="min-h-40" />
            {plan && <ChanceBar chance={chanceOf(live.teamA, live.teamB, plan.skills)} onCourt className="px-1 pt-3" />}
          </>
        ) : (
          !next && <p className="px-1 pb-1 text-sm opacity-80">Waiting for players.</p>
        )}
        {next && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-black/20 px-3 py-2.5 text-sm">
            <span className="font-score text-lg leading-none font-black tracking-wide text-volt">{matchCode(next.number)}</span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold opacity-75">Up next </span>
              {team(next.teamA)} vs {team(next.teamB)}
            </span>
            {plan && (
              <span className="font-score tabular shrink-0 text-base font-bold opacity-80" title="Win chance">
                {odds(chanceOf(next.teamA, next.teamB, plan.skills)).join('–')}
              </span>
            )}
          </div>
        )}
      </section>
    </Link>
  );
}

/** The court is empty: the admin's way in to a new session. */
function StartCard() {
  return (
    <section className="court-mat relative overflow-hidden rounded-[1.6rem] p-5 shadow-[var(--shadow-card)]">
      <CourtLines className="inset-y-4 right-[-38%] w-[85%] text-court-ink opacity-50" />
      <Shuttle className="absolute top-5 right-6 h-16 rotate-[35deg] text-court-ink drop-shadow-[0_8px_14px_rgb(0_0_0/0.35)]" />
      <div className="relative max-w-[16rem]">
        <p className="kicker text-court-ink/75">Court's empty</p>
        <h2 className="mt-2 text-[1.9rem] leading-[1] font-extrabold tracking-[-0.035em]">Ready to play?</h2>
        <p className="mt-2 text-sm opacity-80">Pick who's here, set levels, and the app plans fair matches.</p>
        <Link to="/sessions/new" className="mt-4 inline-block">
          <Button variant="volt" size="lg">
            <Plus size={18} /> Start a session
          </Button>
        </Link>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { liveSessions, history, nameOf, ready, players, playersById, tournaments } = useData();
  const { isAdmin } = useAuth();
  const summaries = useMemo(() => summarizeHistory(history, nameOf), [history, nameOf]);
  // Home shows the last 30 days; all-time is one tap away on the leaderboard.
  const top = useMemo(
    () => allTimeStats(history, nameOf, { from: isoDaysAgo(30) }).standings.filter((l) => l.qualified).slice(0, 5),
    [history, nameOf],
  );
  const latest = summaries[0];
  // Tournaments being played, then ones coming up (soonest first).
  const comingTournaments = (tournaments ?? [])
    .filter((t) => t.status === 'live' || (t.status === 'upcoming' && t.date >= todayISO()))
    .sort((a, b) => Number(b.status === 'live') - Number(a.status === 'live') || a.date.localeCompare(b.date));

  if (!ready) return <Spinner />;

  return (
    <div className="space-y-5 [&>*]:animate-rise">
      {liveSessions.map((s) => (
        <LiveSessionCard key={s.id} session={s} />
      ))}

      {comingTournaments.map((t) => (
        <TournamentCard key={t.id} t={t} />
      ))}

      {isAdmin && !liveSessions.length && <StartCard />}

      <NextSessionCard />

      <InstallCard />

      {latest && (
        <Link to={`/sessions/${latest.id}`} className="group block">
          <Card className="relative overflow-hidden transition group-hover:-translate-y-0.5">
            <CardHeader title="Latest report" action={<FileText size={18} className="text-muted" />} />
            <div className="flex items-center gap-4 px-4 pt-2 pb-4">
              <DateStub date={latest.date} />
              <div className="min-w-0 flex-1">
                <h3 className="text-lg leading-tight font-bold tracking-tight">{latest.title}</h3>
                <p className="mt-0.5 text-sm text-muted">
                  {latest.matchCount} matches · {latest.playerIds.length} players
                </p>
              </div>
            </div>
            {latest.mvpId && (
              <div className="relative flex items-center gap-3 overflow-hidden border-t border-line bg-surface-2/60 px-4 py-3">
                <span className="absolute -top-10 -right-6 size-32 rounded-full bg-volt/40 blur-2xl" aria-hidden />
                <span className="relative">
                  <Avatar name={nameOf(latest.mvpId)} photo={playersById.get(latest.mvpId)?.photo} size={48} className="ring-volt ring-3" />
                  <span className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full bg-volt text-volt-ink ring-2 ring-surface">
                    <Trophy size={11} strokeWidth={2.75} />
                  </span>
                </span>
                <span className="relative min-w-0">
                  <span className="block text-[11px] font-bold tracking-[0.16em] text-muted uppercase">Player of the session</span>
                  <span className="block truncate text-xl leading-tight font-extrabold tracking-tight">{nameOf(latest.mvpId)}</span>
                </span>
                <ChevronRight size={20} className="relative ml-auto shrink-0 text-muted transition group-hover:translate-x-0.5" />
              </div>
            )}
          </Card>
        </Link>
      )}

      {summaries.length > 0 && (
        <Card>
          <CardHeader
            title="Leaders · last 30 days"
            action={
              <Link to="/leaderboard?range=all" className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-primary-text hover:bg-surface-2">
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
