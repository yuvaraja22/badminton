import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeftRight, ChevronLeft, Flag, Undo2 } from 'lucide-react';
import { useHoldUpdates } from '../../lib/appUpdate';
import { cn } from '../../lib/cn';
import { useAuth, useData } from '../../lib/data/context';
import { useScorer } from '../../lib/data/useScorer';
import { addPoint, gameState, rallyState, serveState, undoPoint, type Side } from '../../lib/engine/scoring';
import type { PlayerId, ScorerInfo, ServeSide, TeamKey } from '../../lib/types';
import { Shuttle } from '../Logo';
import { SyncPill } from '../SyncPill';
import { HalfCourtLines } from '../session/CourtView';
import { Badge, LiveDot } from '../ui/Badge';
import { Button } from '../ui/Button';

/** Someone else's last point within this long means they are still scoring. */
const SCORER_FRESH_MS = 5 * 60_000;

const sideOf = (team: TeamKey): Side => (team === 'a' ? 'A' : 'B');
const teamOf = (side: Side): TeamKey => (side === 'A' ? 'a' : 'b');

export interface ScorerSide {
  name: string;
  fill: string;
  players: PlayerId[];
}

/** "Swap sides" is remembered for the match on this phone, so a reload never flips the board back. */
function useSwapped(key: string): [boolean, () => void] {
  const storageKey = `swap:${key}`;
  const [swapped, setSwapped] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setSwapped((s) => {
      try {
        if (s) sessionStorage.removeItem(storageKey);
        else sessionStorage.setItem(storageKey, '1');
      } catch {
        // Private mode: still swaps, just isn't remembered.
      }
      return !s;
    });
  return [swapped, toggle];
}

/** Keep the screen on while scoring. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let live = true;
    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (live) lock = l;
          else void l.release();
        })
        .catch(() => {});
    void request();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

/**
 * The full-screen live scorer, for tournament and session matches alike: tap a side's half to give
 * it the point. Admins score; everyone else sees the same board update live. It calls game point,
 * deuce and change of ends, and shows who serves from which side.
 *
 * Only one phone scores at a time: whoever scored last (or tapped "Score here instead") within the
 * last few minutes. Any other admin's phone shows who is scoring and offers to take over.
 */
export function LiveScorer({
  matchKey,
  title,
  subtitle,
  backTo,
  backLabel,
  sides,
  status,
  log,
  scoreA,
  scoreB,
  typedPoints,
  firstServe,
  rules,
  scorer,
  notStarted,
  actions,
  onPoint,
  onClaim,
  onFinish,
  onFirstServe,
}: {
  /** Identifies the match on this phone (remembers "Swap sides"). */
  matchKey: string;
  title: ReactNode;
  subtitle: ReactNode;
  backTo: string;
  backLabel: string;
  sides: Record<TeamKey, ScorerSide>;
  status: 'scheduled' | 'live';
  log: string;
  scoreA: number;
  scoreB: number;
  typedPoints: number;
  firstServe: ServeSide | null;
  rules: { pointsToWin: number; maxPoints: number };
  scorer: (ScorerInfo & { at: number }) | null;
  /** Shown instead of the rules while the match hasn't started. */
  notStarted?: string;
  /** More buttons for the footer (e.g. the game's target, or Start). */
  actions?: ReactNode;
  /** The new log after a point or an undo. */
  onPoint: (log: string) => void;
  onClaim: () => void;
  onFinish: () => void;
  onFirstServe: (side: ServeSide | null) => void;
}) {
  const { nameOf } = useData();
  const { isAdmin } = useAuth();
  const me = useScorer();
  const [swapped, toggleSwapped] = useSwapped(matchKey);
  const [now, setNow] = useState(() => Date.now());
  const lastTap = useRef(0);

  // Another admin's phone (older entries have no id, so fall back to the name) that scored recently.
  const someoneElse = scorer && (scorer.id ? scorer.id !== me.id : scorer.name !== me.name);
  const otherScorer = scorer && someoneElse && now - scorer.at < SCORER_FRESH_MS ? scorer : null;
  const live = status === 'live';
  const canScore = isAdmin && live && !otherScorer;

  // Re-check every so often whether another phone is still scoring.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => window.clearInterval(timer);
  }, []);
  useWakeLock(canScore);
  // A new version of the app waits until the match is over.
  useHoldUpdates(live);

  const state = log ? rallyState(log, rules.pointsToWin, rules.maxPoints) : gameState(scoreA, scoreB, rules.pointsToWin, rules.maxPoints);
  const winnerTeam: TeamKey | null = state.winner ? teamOf(state.winner) : null;
  const serve = live && !state.over ? serveState(log, firstServe, typedPoints) : null;
  const serveTeam = serve ? teamOf(serve.side) : null;

  /** `at` is the tap's event time stamp (ms). */
  const tap = (team: TeamKey, at: number) => {
    if (!canScore || state.over) return;
    if (at - lastTap.current < 350) return; // an accidental double tap
    lastTap.current = at;
    navigator.vibrate?.(12);
    onPoint(addPoint(log, sideOf(team), rules.pointsToWin, rules.maxPoints));
  };

  let line: string;
  if (!live) line = notStarted ?? 'Not started yet';
  else if (state.over && winnerTeam) line = `${sides[winnerTeam].name} win ${Math.max(state.a, state.b)}–${Math.min(state.a, state.b)}`;
  else if (state.gamePoint.length === 2) line = 'Golden point: the next point wins';
  else if (state.gamePoint.length === 1) line = `Game point · ${sides[teamOf(state.gamePoint[0])].name}`;
  else if (state.deuce) line = 'Deuce';
  else line = `First to ${rules.pointsToWin}, win by 2 (max ${rules.maxPoints})`;

  const half = (team: TeamKey, first: boolean) => {
    const score = team === 'a' ? state.a : state.b;
    const point = state.gamePoint.includes(sideOf(team));
    const serving = serveTeam === team;
    const content = (
      <>
        <HalfCourtLines flip={!first} className="inset-4 opacity-20 landscape:opacity-0 md:opacity-0" />
        {/* Always laid out (hidden when not serving) so both halves line up. */}
        <span
          className={cn(
            'relative mb-1.5 inline-flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-bold tracking-[0.12em] uppercase',
            !serving && 'invisible',
          )}
        >
          <Shuttle className="h-3.5 -rotate-[30deg] text-white" /> Serve · {serve?.court === 'left' ? 'left' : 'right'}
        </span>
        <span className="relative max-w-full truncate px-3 text-[13px] font-bold tracking-[0.18em] uppercase opacity-90">{sides[team].name}</span>
        <span className="relative mt-1 px-3 text-center text-[15px] leading-snug font-semibold opacity-95">{sides[team].players.map(nameOf).join(' & ')}</span>
        <span className="font-score tabular relative mt-2 text-[clamp(4.5rem,min(38vw,24vh),13rem)] leading-[0.9] font-black drop-shadow-[0_6px_18px_rgb(0_0_0/0.25)]">{score}</span>
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
    const bg = { background: `radial-gradient(120% 80% at 50% 0%, rgb(255 255 255 / 0.16), transparent 60%), ${sides[team].fill}` };
    return canScore && !state.over ? (
      <button
        key={team}
        type="button"
        onClick={(e) => tap(team, e.timeStamp)}
        className={cn(cls, 'touch-manipulation transition active:scale-[0.98] active:brightness-110')}
        style={bg}
        aria-label={`Point to ${sides[team].name}, now ${score}${serving ? ', serving' : ''}`}
      >
        {content}
      </button>
    ) : (
      <div key={team} className={cls} style={bg}>
        {content}
      </div>
    );
  };

  const askFirstServe = canScore && !log && !state.over;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center gap-2 px-2 py-2">
        <Link to={backTo} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface-2" aria-label={backLabel}>
          <ChevronLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold tracking-tight">{title}</div>
          <div className="truncate text-xs text-muted">{subtitle}</div>
        </div>
        <SyncPill />
        {live ? (
          <Badge tone="live">
            <LiveDot /> Live
          </Badge>
        ) : (
          <Badge>Not started</Badge>
        )}
      </header>

      {isAdmin && live && otherScorer && (
        <div className="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-warn-bg px-3.5 py-2 text-sm text-warn">
          <span className="min-w-0 flex-1">Being scored on {otherScorer.name}'s phone.</span>
          <Button size="sm" variant="secondary" onClick={onClaim}>
            Score here instead
          </Button>
        </div>
      )}

      {/* A phone held upright stacks the teams top and bottom; tablets and landscape put them side by side. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 md:flex-row landscape:flex-row">
        {half(swapped ? 'b' : 'a', true)}
        {half(swapped ? 'a' : 'b', false)}
      </div>

      <div className="px-4 pt-3 text-center" aria-live="polite">
        <p className="text-[15px] font-bold tracking-tight">
          {line}
          {state.changeEnds && live && <span className="text-accent"> · Change ends</span>}
        </p>
        {serve && (
          <p className="mt-0.5 text-xs text-muted">
            {sides[serve.side === 'A' ? 'a' : 'b'].name} serve{!log ? ' first' : ''}, from the {serve.court} service court
            {askFirstServe && firstServe && (
              <>
                {' · '}
                <button type="button" className="font-semibold underline" onClick={() => onFirstServe(null)}>
                  change
                </button>
              </>
            )}
          </p>
        )}
        {askFirstServe && !firstServe && (
          <div className="mt-2 flex items-center justify-center gap-2 text-sm">
            <span className="text-muted">Who serves first?</span>
            {(['a', 'b'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onFirstServe(sideOf(k))}
                className="rounded-full px-3 py-1 text-xs font-bold text-white"
                style={{ background: sides[k].fill }}
              >
                {sides[k].name}
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 p-3">
        {isAdmin && live && (
          <>
            <Button variant="secondary" size="lg" onClick={() => onPoint(undoPoint(log))} disabled={!canScore || log.length <= typedPoints}>
              <Undo2 size={18} /> Undo
            </Button>
            {state.over && (
              <Button size="lg" className="flex-1" onClick={onFinish} disabled={!canScore}>
                <Flag size={18} /> Finish match
              </Button>
            )}
          </>
        )}
        {actions}
        <Button variant="secondary" size="lg" onClick={toggleSwapped} className={cn(!isAdmin && 'flex-1')} aria-label="Swap sides">
          <ArrowLeftRight size={18} /> {isAdmin ? '' : 'Swap sides'}
        </Button>
      </footer>
    </div>
  );
}
