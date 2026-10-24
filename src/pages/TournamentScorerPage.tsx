import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeftRight, ChevronLeft, Flag, Play, RotateCcw, Undo2 } from 'lucide-react';
import { cn } from '../lib/cn';
import { useAuth, useData } from '../lib/data/context';
import { claimTournamentScorer, finishTournamentMatch, resumeTournamentMatch, scoreTournamentMatch, startTournamentMatch } from '../lib/data/mutations';
import { useScorer } from '../lib/data/useScorer';
import { addPoint, gameState, liveMatch, nextMatch, rallyState, undoPoint, type Side } from '../lib/engine/tournament';
import { formatTime, matchCode } from '../lib/format';
import { teamFill, teamName } from '../lib/teamColors';
import type { TeamKey } from '../lib/types';
import { Badge, LiveDot } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Empty, Spinner } from '../components/ui/Card';

const sideOf = (team: TeamKey): Side => (team === 'a' ? 'A' : 'B');
/** Someone else's last point within this long means they are still scoring. */
const SCORER_FRESH_MS = 5 * 60_000;

/**
 * Live scorer: tap a team's half to give them the point. Admins score; everyone else sees the same
 * board update live. Full screen, so it is easy to use courtside.
 */
export default function TournamentScorerPage() {
  const { id, matchId } = useParams();
  const { tournaments, nameOf } = useData();
  const { isAdmin } = useAuth();
  const me = useScorer();
  const navigate = useNavigate();
  const [swapped, setSwapped] = useState(false);
  const [tookOver, setTookOver] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lastTap = useRef(0);

  const t = tournaments?.find((x) => x.id === id);
  const m = t && matchId ? t.matches[matchId] : undefined;
  // Another admin's phone (older entries have no id, so fall back to the name) that scored recently.
  const someoneElse = m?.scorer && (m.scorer.id ? m.scorer.id !== me.id : m.scorer.name !== me.name);
  const otherScorer = m?.scorer && someoneElse && now - m.scorer.at < SCORER_FRESH_MS ? m.scorer : null;
  const canScore = isAdmin && m?.status === 'live' && (!otherScorer || tookOver);

  // Re-check every so often whether another phone is still scoring.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => window.clearInterval(timer);
  }, []);

  // Keep the screen on while scoring.
  useEffect(() => {
    if (!canScore || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (active) lock = l;
          else void l.release();
        })
        .catch(() => {});
    void request();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [canScore]);

  if (tournaments === null) return <Spinner />;
  if (!t || !m) {
    return (
      <Empty title="Match not found">
        It may have been deleted.{' '}
        <Link to={t ? `/tournaments/${t.id}` : '/tournaments'} className="font-semibold underline">
          Back
        </Link>
      </Empty>
    );
  }

  const state = m.log ? rallyState(m.log, t.pointsToWin, t.maxPoints) : gameState(m.scoreA, m.scoreB, t.pointsToWin, t.maxPoints);
  const onCourt = liveMatch(t);
  const courtBusy = onCourt !== null && onCourt.id !== m.id;
  const upNext = nextMatch(t);
  const winnerTeam: TeamKey | null = state.winner ? (state.winner === 'A' ? 'a' : 'b') : null;

  /** `at` is the tap's event time stamp (ms). */
  const tap = (team: TeamKey, at: number) => {
    if (!canScore || state.over) return;
    if (at - lastTap.current < 350) return; // an accidental double tap
    lastTap.current = at;
    navigator.vibrate?.(12);
    scoreTournamentMatch(t, m.id, addPoint(m.log, sideOf(team), t.pointsToWin, t.maxPoints), me);
  };

  let status: string;
  if (m.status === 'scheduled') status = m.time ? `Starts around ${formatTime(m.time)}` : 'Not started yet';
  else if (state.over && winnerTeam) status = `${teamName(t, winnerTeam)} win ${Math.max(state.a, state.b)}–${Math.min(state.a, state.b)}`;
  else if (state.gamePoint.length === 2) status = 'Golden point: the next point wins';
  else if (state.gamePoint.length === 1) status = `Game point · ${teamName(t, state.gamePoint[0] === 'A' ? 'a' : 'b')}`;
  else if (state.deuce) status = 'Deuce';
  else status = `First to ${t.pointsToWin}, win by 2 (max ${t.maxPoints})`;

  const half = (team: TeamKey) => {
    const score = team === 'a' ? state.a : state.b;
    const point = state.gamePoint.includes(sideOf(team));
    const content = (
      <>
        <span className="max-w-full truncate px-3 text-sm font-bold tracking-wide uppercase opacity-90">{teamName(t, team)}</span>
        <span className="mt-1 px-3 text-center text-sm leading-snug opacity-90">{m[team].map(nameOf).join(' & ')}</span>
        <span className="tabular mt-3 text-[clamp(3.5rem,min(30vw,20vh),10rem)] leading-none font-black">{score}</span>
        {/* Always laid out (hidden when not needed) so both halves' scores stay level. */}
        <span className={cn('mt-3 rounded-full bg-white/20 px-3 py-1 text-xs font-bold tracking-wide uppercase', !point && winnerTeam !== team && 'invisible')}>
          {winnerTeam === team ? 'Winner' : 'Game point'}
        </span>
      </>
    );
    const cls = 'flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center rounded-3xl text-white select-none';
    return canScore && !state.over ? (
      <button
        key={team}
        type="button"
        onClick={(e) => tap(team, e.timeStamp)}
        className={cn(cls, 'touch-manipulation transition active:scale-[0.98] active:brightness-110')}
        style={{ background: teamFill(t, team) }}
        aria-label={`Point to ${teamName(t, team)}, now ${score}`}
      >
        {content}
      </button>
    ) : (
      <div key={team} className={cls} style={{ background: teamFill(t, team) }}>
        {content}
      </div>
    );
  };

  const startNext = () => {
    if (!upNext || onCourt) return;
    startTournamentMatch(t, upNext.id, me);
    navigate(`/tournaments/${t.id}/matches/${upNext.id}`, { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center gap-2 px-2 py-2">
        <Link to={`/tournaments/${t.id}`} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Back to the tournament">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">
            {matchCode(m.order)} · {m.kind === 'doubles' ? 'Doubles' : 'Singles'}
          </div>
          <div className="truncate text-xs text-muted">
            {t.name}
            {m.time ? ` · ${formatTime(m.time)}` : ''}
          </div>
        </div>
        {m.status === 'live' ? (
          <Badge tone="live">
            <LiveDot /> Live
          </Badge>
        ) : m.status === 'completed' ? (
          <Badge tone="good">Final</Badge>
        ) : (
          <Badge>Not started</Badge>
        )}
      </header>

      {isAdmin && m.status === 'live' && otherScorer && !tookOver && (
        <div className="mx-3 mb-2 flex items-center gap-3 rounded-xl bg-warn-bg px-3 py-2 text-sm text-warn">
          <span className="min-w-0 flex-1">Being scored on {otherScorer.name}'s phone.</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              claimTournamentScorer(t, m.id, me);
              setTookOver(true);
            }}
          >
            Score here instead
          </Button>
        </div>
      )}

      {/* A phone held upright stacks the teams top and bottom; tablets and landscape put them side by side. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 md:flex-row landscape:flex-row">
        {half(swapped ? 'b' : 'a')}
        {half(swapped ? 'a' : 'b')}
      </div>

      <p className="px-4 pt-3 text-center text-sm font-semibold" aria-live="polite">
        {status}
        {state.changeEnds && m.status === 'live' && <span className="text-accent"> · Change ends</span>}
      </p>

      <footer className="flex flex-wrap items-center gap-2 p-3">
        {isAdmin && m.status === 'live' && (
          <>
            <Button variant="secondary" size="lg" onClick={() => scoreTournamentMatch(t, m.id, undoPoint(m.log), me)} disabled={!canScore || !m.log}>
              <Undo2 size={18} /> Undo
            </Button>
            {state.over && (
              <Button size="lg" className="flex-1" onClick={() => finishTournamentMatch(t, m.id)} disabled={!canScore}>
                <Flag size={18} /> Finish match
              </Button>
            )}
          </>
        )}
        {isAdmin && m.status === 'scheduled' && (
          <Button size="lg" className="flex-1" disabled={courtBusy} onClick={() => startTournamentMatch(t, m.id, me)}>
            <Play size={18} /> {courtBusy ? `${matchCode(onCourt!.order)} is on court` : 'Start match'}
          </Button>
        )}
        {isAdmin && m.status === 'completed' && (
          <>
            {upNext && !onCourt && (
              <Button size="lg" className="flex-1" onClick={startNext}>
                <Play size={18} /> Start {matchCode(upNext.order)}
              </Button>
            )}
            <Button variant="secondary" size="lg" disabled={courtBusy} onClick={() => resumeTournamentMatch(t, m.id, me)}>
              <RotateCcw size={18} /> Reopen
            </Button>
          </>
        )}
        <Button variant="secondary" size="lg" onClick={() => setSwapped((s) => !s)} className={cn(!isAdmin && 'flex-1')} aria-label="Swap sides">
          <ArrowLeftRight size={18} /> {isAdmin ? '' : 'Swap sides'}
        </Button>
      </footer>
    </div>
  );
}
