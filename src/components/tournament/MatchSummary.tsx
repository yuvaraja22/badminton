import { Link, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, Play, RotateCcw } from 'lucide-react';
import { useAuth, useData } from '../../lib/data/context';
import { resumeTournamentMatch, startTournamentMatch } from '../../lib/data/mutations';
import { useScorer } from '../../lib/data/useScorer';
import { marginLabel } from '../../lib/engine/labels';
import { matchFlow } from '../../lib/engine/rally';
import { liveMatch, matchPath, matchWinner, nextMatch, rallyGameOf, rulesFor, tournamentMatches } from '../../lib/engine/tournament';
import { formatTime, matchCode } from '../../lib/format';
import { teamFill, teamName, tournamentSides } from '../../lib/teamColors';
import type { TeamKey, Tournament, TournamentMatch } from '../../lib/types';
import { MatchStats } from '../report/MatchStats';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

/** One side of the scoreboard: team, players (linked to their profiles) and score. */
function SideBlock({ t, m, team, won }: { t: Tournament; m: TournamentMatch; team: TeamKey; won: boolean }) {
  const { nameOf, pathOf, playersById } = useData();
  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-2 rounded-[1.2rem] p-3.5 text-white"
      style={{ background: `repeating-linear-gradient(${team === 'a' ? 115 : 65}deg, rgb(255 255 255 / 0.07) 0 9px, transparent 9px 18px), ${teamFill(t, team)}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold tracking-[0.14em] uppercase opacity-90">{teamName(t, team)}</span>
        {won && <span className="shrink-0 rounded-full bg-volt px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-volt-ink uppercase">Won</span>}
      </div>
      <span className="font-score tabular text-[3.4rem] leading-[0.9] font-black">{team === 'a' ? m.scoreA : m.scoreB}</span>
      <ul className="space-y-1">
        {m[team].map((id) => (
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

/**
 * A finished match: the score, how it went point by point and the numbers behind it, with links to the
 * matches either side. Admins can start the next match or reopen this one.
 */
export function MatchSummary({ t, m }: { t: Tournament; m: TournamentMatch }) {
  const { isAdmin } = useAuth();
  const me = useScorer();
  const navigate = useNavigate();
  const flow = matchFlow(rallyGameOf(t, m));
  const winner = matchWinner(m);
  const rules = rulesFor(t, m);
  const list = tournamentMatches(t);
  const i = list.findIndex((x) => x.id === m.id);
  const prev = list[i - 1];
  const next = list[i + 1];
  const onCourt = liveMatch(t);
  const upNext = nextMatch(t);
  const minutes = m.startedAt && m.completedAt ? Math.round((m.completedAt - m.startedAt) / 60_000) : null;
  const hi = Math.max(m.scoreA, m.scoreB);
  const lo = Math.min(m.scoreA, m.scoreB);

  return (
    <div className="space-y-4">
      <Link to={`/tournaments/${t.id}`} className="inline-flex items-center gap-1 rounded-full py-1 pr-3 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft size={16} /> {t.name}
      </Link>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-score text-[2.6rem] leading-none font-black tracking-wide">{matchCode(m.order)}</h1>
          <p className="mt-1 text-sm text-muted">
            {m.kind === 'doubles' ? 'Doubles' : 'Singles'}
            {m.time ? ` · ${formatTime(m.time)}` : ''}
            {rules.pointsToWin !== t.pointsToWin ? ` · game to ${rules.pointsToWin}` : ''}
          </p>
        </div>
        <Badge tone="good">Final</Badge>
      </div>

      <div className="flex gap-1.5">
        <SideBlock t={t} m={m} team="a" won={winner === 'a'} />
        <SideBlock t={t} m={m} team="b" won={winner === 'b'} />
      </div>
      {winner && (
        <p className="text-center text-sm">
          <strong>
            {teamName(t, winner)} win {hi}–{lo}
          </strong>
          <span className="text-muted">
            {' '}
            · {marginLabel(hi, lo, rules.pointsToWin)} (+{hi - lo}){minutes && minutes > 0 && minutes < 180 ? ` · ${minutes} min` : ''}
          </span>
        </p>
      )}

      <MatchStats flow={flow} sides={tournamentSides(t)} />

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          {upNext && !onCourt && (
            <Button
              className="flex-1"
              onClick={() => {
                startTournamentMatch(t, upNext.id, me);
                navigate(`/tournaments/${t.id}/matches/${upNext.id}`);
              }}
            >
              <Play size={16} /> Start {matchCode(upNext.order)}
            </Button>
          )}
          <Button variant="secondary" disabled={onCourt !== null} onClick={() => resumeTournamentMatch(t, m.id, me)}>
            <RotateCcw size={16} /> Reopen scoring
          </Button>
        </div>
      )}

      <nav className="flex gap-2" aria-label="Other matches">
        {prev && (
          <Link to={matchPath(t, prev.order)!} className="flex flex-1 items-center gap-1 rounded-full border border-line px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">
            <ChevronLeft size={16} /> {matchCode(prev.order)}
          </Link>
        )}
        {next && (
          <Link to={matchPath(t, next.order)!} className="flex flex-1 items-center justify-end gap-1 rounded-full border border-line px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">
            {matchCode(next.order)} <ChevronRight size={16} />
          </Link>
        )}
      </nav>
    </div>
  );
}
