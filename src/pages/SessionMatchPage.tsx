import { Link, useNavigate, useParams } from 'react-router';
import { ChevronLeft, ChevronRight, Play, RotateCcw } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { claimSessionScorer, saveMatch, scoreSessionMatch, setSessionFirstServe, startMatch } from '../lib/data/mutations';
import { useQueuePlan } from '../lib/data/usePlan';
import { useScorer } from '../lib/data/useScorer';
import { useSession } from '../lib/data/useSession';
import { rallyGameOfMatch, sortedMatches, winnerSide } from '../lib/engine/games';
import { marginLabel } from '../lib/engine/labels';
import { matchFlow } from '../lib/engine/rally';
import { maxPointsFor, scoresOf, typedLog } from '../lib/engine/scoring';
import { matchCode, shortDate } from '../lib/format';
import { SESSION_SIDES } from '../lib/teamColors';
import type { Match, Session, TeamKey } from '../lib/types';
import { MatchStats } from '../components/report/MatchStats';
import { LiveScorer } from '../components/scorer/LiveScorer';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Empty, Notice, Spinner } from '../components/ui/Card';

const matchPath = (s: Pick<Session, 'id'>, m: Pick<Match, 'id'>) => `/sessions/${s.id}/matches/${m.id}`;

/** One side of the final score: Team 1 / Team 2, the players (linked) and the score. */
function SideBlock({ m, team, won }: { m: Match; team: TeamKey; won: boolean }) {
  const { nameOf, pathOf, playersById } = useData();
  const side = SESSION_SIDES[team];
  const ids = team === 'a' ? m.teamA : m.teamB;
  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-2 rounded-[1.2rem] p-3.5 text-white"
      style={{ background: `repeating-linear-gradient(${team === 'a' ? 115 : 65}deg, rgb(255 255 255 / 0.07) 0 9px, transparent 9px 18px), ${side.fill}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold tracking-[0.14em] uppercase opacity-90">{side.name}</span>
        {won && <span className="shrink-0 rounded-full bg-volt px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-volt-ink uppercase">Won</span>}
      </div>
      <span className="font-score tabular text-[3.4rem] leading-[0.9] font-black">{(team === 'a' ? m.scoreA : m.scoreB) ?? '–'}</span>
      <ul className="space-y-1">
        {ids.map((id) => (
          <li key={id}>
            <Link to={pathOf(id)} className="flex min-w-0 items-center gap-2 text-sm font-semibold hover:underline">
              <Avatar name={nameOf(id)} photo={playersById.get(id)?.photo} size={24} />
              <span className="truncate">{nameOf(id)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A finished (or stopped) session match: the score, how it went point by point, and the matches either side. */
function SessionMatchSummary({ session, m }: { session: Session; m: Match }) {
  const { isAdmin } = useAuth();
  const me = useScorer();
  const navigate = useNavigate();
  const plan = useQueuePlan(session, 1, { checkpoint: false });
  const list = sortedMatches(session);
  const i = list.findIndex((x) => x.id === m.id);
  const prev = list[i - 1];
  const next = list[i + 1];
  const onCourt = list.find((x) => x.status === 'live') ?? null;
  const upNext = plan?.upcoming[0] ?? null;
  const flow = matchFlow(rallyGameOfMatch(m, session.pointsToWin));
  const w = winnerSide({ ...m, sessionId: session.id, date: session.date });
  const hi = Math.max(m.scoreA ?? 0, m.scoreB ?? 0);
  const lo = Math.min(m.scoreA ?? 0, m.scoreB ?? 0);
  const minutes = m.createdAt && m.completedAt ? Math.round((m.completedAt - m.createdAt) / 60_000) : null;
  const live = session.status === 'live';

  return (
    <div className="space-y-4">
      <Link to={`/sessions/${session.id}?tab=${live ? 'court' : 'matches'}`} className="inline-flex items-center gap-1 rounded-full py-1 pr-3 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft size={16} /> {session.title}
      </Link>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-score text-[2.6rem] leading-none font-black tracking-wide">{matchCode(m.number)}</h1>
          <p className="mt-1 text-sm text-muted">
            {shortDate(session.date)} · game to {session.pointsToWin}
          </p>
        </div>
        {m.status === 'unfinished' ? <Badge tone="warn">Stopped early</Badge> : <Badge tone="good">Final</Badge>}
      </div>

      <div className="flex gap-1.5">
        <SideBlock m={m} team="a" won={m.status === 'completed' && w === 'A'} />
        <SideBlock m={m} team="b" won={m.status === 'completed' && w === 'B'} />
      </div>
      {m.status === 'completed' && w && (
        <p className="text-center text-sm">
          <strong>
            {SESSION_SIDES[w === 'A' ? 'a' : 'b'].name} win {hi}–{lo}
          </strong>
          <span className="text-muted">
            {' '}
            · {marginLabel(hi, lo, session.pointsToWin)} (+{hi - lo}){minutes && minutes > 0 && minutes < 180 ? ` · ${minutes} min` : ''}
          </span>
        </p>
      )}
      {m.status === 'unfinished' && <Notice tone="warn">Stopped early, so it isn't counted in the stats.</Notice>}

      <MatchStats flow={flow} sides={SESSION_SIDES} />

      {isAdmin && live && (
        <div className="flex flex-wrap gap-2">
          {upNext && !onCourt && (
            <Button
              className="flex-1"
              onClick={() => {
                const id = startMatch(session, { teamA: upNext.teamA, teamB: upNext.teamB }, me);
                navigate(`/sessions/${session.id}/matches/${id}`);
              }}
            >
              <Play size={16} /> Start {matchCode(upNext.number)} and score it
            </Button>
          )}
          <Button variant="secondary" disabled={onCourt !== null} onClick={() => saveMatch(session, { ...m, status: 'live', scorer: { ...me, at: Date.now() } })}>
            <RotateCcw size={16} /> Reopen scoring
          </Button>
        </div>
      )}

      <nav className="flex gap-2" aria-label="Other matches">
        {prev && (
          <Link to={matchPath(session, prev)} className="flex flex-1 items-center gap-1 rounded-full border border-line px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">
            <ChevronLeft size={16} /> {matchCode(prev.number)}
          </Link>
        )}
        {next && (
          <Link to={matchPath(session, next)} className="flex flex-1 items-center justify-end gap-1 rounded-full border border-line px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">
            {matchCode(next.number)} <ChevronRight size={16} />
          </Link>
        )}
      </nav>
    </div>
  );
}

/** A session match's own page: the full-screen live scorer while it's on court, its summary afterwards. */
export default function SessionMatchPage() {
  const { id, matchId } = useParams();
  const { session, loading, error } = useSession(id);
  const me = useScorer();

  if (loading) return <Spinner />;
  if (error) return <Notice tone="bad">Couldn't load this session: {error}</Notice>;
  const m = session && matchId ? session.matches[matchId] : undefined;
  if (!session || !m) {
    return (
      <Empty title="Match not found">
        It may have been deleted.{' '}
        <Link to={session ? `/sessions/${session.id}` : '/sessions'} className="font-semibold underline">
          Back
        </Link>
      </Empty>
    );
  }
  if (m.status !== 'live' || session.status !== 'live') return <SessionMatchSummary session={session} m={m} />;

  // A score typed in before live scoring started becomes the start of the log.
  const typed = m.log ? null : typedLog(m.scoreA ?? 0, m.scoreB ?? 0);
  const log = m.log ?? typed ?? '';
  const typedPoints = typed !== null ? typed.length : (m.typedPoints ?? 0);
  const rules = { pointsToWin: session.pointsToWin, maxPoints: maxPointsFor(session.pointsToWin) };

  return (
    <LiveScorer
      matchKey={`${session.id}:${m.id}`}
      title={
        <>
          <span className="font-score text-xl leading-none font-black tracking-wide">{matchCode(m.number)}</span> · Doubles
        </>
      }
      subtitle={session.title}
      backTo={`/sessions/${session.id}`}
      backLabel="Back to the session"
      sides={{ a: { ...SESSION_SIDES.a, players: m.teamA }, b: { ...SESSION_SIDES.b, players: m.teamB } }}
      status="live"
      log={log}
      scoreA={m.scoreA ?? 0}
      scoreB={m.scoreB ?? 0}
      typedPoints={typedPoints}
      firstServe={m.firstServe ?? null}
      rules={rules}
      scorer={m.scorer ?? null}
      onPoint={(next) => scoreSessionMatch(session, m.id, next, me, typed !== null ? typedPoints : undefined)}
      onClaim={() => claimSessionScorer(session, m.id, me)}
      onFinish={() => {
        const { a, b } = scoresOf(log);
        saveMatch(session, { ...m, log, typedPoints, scoreA: a, scoreB: b, status: 'completed' });
      }}
      onFirstServe={(side) => setSessionFirstServe(session, m.id, side)}
    />
  );
}
