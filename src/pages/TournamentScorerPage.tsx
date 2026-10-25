import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeftRight, ChevronLeft, Flag, Play, Target, Undo2 } from 'lucide-react';
import { cn } from '../lib/cn';
import { useAuth, useData } from '../lib/data/context';
import { claimTournamentScorer, finishTournamentMatch, scoreTournamentMatch, setMatchTarget, startTournamentMatch } from '../lib/data/mutations';
import { useScorer } from '../lib/data/useScorer';
import { addPoint, gameState, liveMatch, maxPointsFor, rallyState, rulesFor, undoPoint, type Side } from '../lib/engine/tournament';
import { formatTime, matchCode } from '../lib/format';
import { teamFill, teamName } from '../lib/teamColors';
import type { TeamKey, Tournament, TournamentMatch } from '../lib/types';
import { Badge, LiveDot } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Empty, Notice, Spinner } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { MatchSummary } from '../components/tournament/MatchSummary';
import { TargetPicker } from '../components/tournament/TargetPicker';
import { HalfCourtLines } from '../components/session/CourtView';

const sideOf = (team: TeamKey): Side => (team === 'a' ? 'A' : 'B');
/** Someone else's last point within this long means they are still scoring. */
const SCORER_FRESH_MS = 5 * 60_000;

/** Play the match to a different target, e.g. 15 or 10 when time is short. */
function TargetForm({ t, m, onDone }: { t: Tournament; m: TournamentMatch; onDone: () => void }) {
  const [target, setTarget] = useState(rulesFor(t, m).pointsToWin);
  const after = gameState(m.scoreA, m.scoreB, target, maxPointsFor(target));
  const winner: TeamKey | null = after.winner ? (after.winner === 'A' ? 'a' : 'b') : null;
  return (
    <div className="space-y-4">
      <TargetPicker value={target} onChange={setTarget} />
      {m.status === 'live' && winner && (
        <Notice tone="warn">
          At {m.scoreA}–{m.scoreB} that ends the game: {teamName(t, winner)} win.
        </Notice>
      )}
      <Button
        block
        onClick={() => {
          setMatchTarget(t, m.id, target);
          onDone();
        }}
      >
        Play to {target}
      </Button>
    </div>
  );
}

/**
 * Live scorer: tap a team's half to give them the point. Admins score; everyone else sees the same
 * board update live. Full screen, so it is easy to use courtside.
 */
export default function TournamentScorerPage() {
  const { id, matchId } = useParams();
  const { tournaments, nameOf } = useData();
  const { isAdmin } = useAuth();
  const me = useScorer();
  const [swapped, setSwapped] = useState(false);
  const [tookOver, setTookOver] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
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

  // A finished match gets its summary page; the full-screen board is for scoring.
  if (m.status === 'completed') return <MatchSummary t={t} m={m} />;

  const rules = rulesFor(t, m);
  const state = m.log ? rallyState(m.log, rules.pointsToWin, rules.maxPoints) : gameState(m.scoreA, m.scoreB, rules.pointsToWin, rules.maxPoints);
  const onCourt = liveMatch(t);
  const courtBusy = onCourt !== null && onCourt.id !== m.id;
  const winnerTeam: TeamKey | null = state.winner ? (state.winner === 'A' ? 'a' : 'b') : null;

  /** `at` is the tap's event time stamp (ms). */
  const tap = (team: TeamKey, at: number) => {
    if (!canScore || state.over) return;
    if (at - lastTap.current < 350) return; // an accidental double tap
    lastTap.current = at;
    navigator.vibrate?.(12);
    scoreTournamentMatch(t, m.id, addPoint(m.log, sideOf(team), rules.pointsToWin, rules.maxPoints), me);
  };

  let status: string;
  if (m.status === 'scheduled') status = m.time ? `Starts around ${formatTime(m.time)}` : 'Not started yet';
  else if (state.over && winnerTeam) status = `${teamName(t, winnerTeam)} win ${Math.max(state.a, state.b)}–${Math.min(state.a, state.b)}`;
  else if (state.gamePoint.length === 2) status = 'Golden point: the next point wins';
  else if (state.gamePoint.length === 1) status = `Game point · ${teamName(t, state.gamePoint[0] === 'A' ? 'a' : 'b')}`;
  else if (state.deuce) status = 'Deuce';
  else status = `First to ${rules.pointsToWin}, win by 2 (max ${rules.maxPoints})`;

  const half = (team: TeamKey, first: boolean) => {
    const score = team === 'a' ? state.a : state.b;
    const point = state.gamePoint.includes(sideOf(team));
    const content = (
      <>
        <HalfCourtLines flip={!first} className="inset-4 opacity-20 landscape:opacity-0 md:opacity-0" />
        <span className="relative max-w-full truncate px-3 text-[13px] font-bold tracking-[0.18em] uppercase opacity-90">{teamName(t, team)}</span>
        <span className="relative mt-1 px-3 text-center text-[15px] leading-snug font-semibold opacity-95">{m[team].map(nameOf).join(' & ')}</span>
        <span className="font-score tabular relative mt-2 text-[clamp(4.5rem,min(38vw,24vh),13rem)] leading-[0.9] font-black drop-shadow-[0_6px_18px_rgb(0_0_0/0.25)]">{score}</span>
        {/* Always laid out (hidden when not needed) so both halves' scores stay level. */}
        <span
          className={cn(
            'relative mt-3 rounded-full px-3 py-1 text-xs font-bold tracking-[0.14em] uppercase',
            winnerTeam === team ? 'bg-volt text-volt-ink' : 'bg-white/20',
            !point && winnerTeam !== team && 'invisible',
          )}
        >
          {winnerTeam === team ? 'Winner' : 'Game point'}
        </span>
      </>
    );
    const cls = 'relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[1.75rem] text-white select-none';
    const bg = { background: `radial-gradient(120% 80% at 50% 0%, rgb(255 255 255 / 0.16), transparent 60%), ${teamFill(t, team)}` };
    return canScore && !state.over ? (
      <button
        key={team}
        type="button"
        onClick={(e) => tap(team, e.timeStamp)}
        className={cn(cls, 'touch-manipulation transition active:scale-[0.98] active:brightness-110')}
        style={bg}
        aria-label={`Point to ${teamName(t, team)}, now ${score}`}
      >
        {content}
      </button>
    ) : (
      <div key={team} className={cls} style={bg}>
        {content}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center gap-2 px-2 py-2">
        <Link to={`/tournaments/${t.id}`} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface-2" aria-label="Back to the tournament">
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold tracking-tight">
            <span className="font-score text-xl leading-none font-black tracking-wide">{matchCode(m.order)}</span> · {m.kind === 'doubles' ? 'Doubles' : 'Singles'}
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
        ) : (
          <Badge>Not started</Badge>
        )}
      </header>

      {isAdmin && m.status === 'live' && otherScorer && !tookOver && (
        <div className="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-warn-bg px-3.5 py-2 text-sm text-warn">
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
        {half(swapped ? 'b' : 'a', true)}
        {half(swapped ? 'a' : 'b', false)}
      </div>

      <p className="px-4 pt-3 text-center text-[15px] font-bold tracking-tight" aria-live="polite">
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
        {isAdmin && !state.over && (
          <Button variant="secondary" size="lg" onClick={() => setTargetOpen(true)} aria-label={`Game to ${rules.pointsToWin}. Change the target`}>
            <Target size={18} /> {rules.pointsToWin}
          </Button>
        )}
        {isAdmin && m.status === 'scheduled' && (
          <Button size="lg" className="flex-1" disabled={courtBusy} onClick={() => startTournamentMatch(t, m.id, me)}>
            <Play size={18} /> {courtBusy ? `${matchCode(onCourt!.order)} is on court` : 'Start match'}
          </Button>
        )}
        <Button variant="secondary" size="lg" onClick={() => setSwapped((s) => !s)} className={cn(!isAdmin && 'flex-1')} aria-label="Swap sides">
          <ArrowLeftRight size={18} /> {isAdmin ? '' : 'Swap sides'}
        </Button>
      </footer>

      <Dialog open={targetOpen} onClose={() => setTargetOpen(false)} title="Game to">
        {targetOpen && <TargetForm t={t} m={m} onDone={() => setTargetOpen(false)} />}
      </Dialog>
    </div>
  );
}
