import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Play, Target } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import {
  claimTournamentScorer,
  finishTournamentMatch,
  scoreTournamentMatch,
  setMatchTarget,
  setTournamentFirstServe,
  startTournamentMatch,
} from '../lib/data/mutations';
import { useScorer } from '../lib/data/useScorer';
import { gameState, liveMatch, maxPointsFor, rulesFor } from '../lib/engine/tournament';
import { formatTime, matchCode } from '../lib/format';
import { teamFill, teamName } from '../lib/teamColors';
import type { TeamKey, Tournament, TournamentMatch } from '../lib/types';
import { Button } from '../components/ui/Button';
import { Empty, Notice, Spinner } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { LiveScorer } from '../components/scorer/LiveScorer';
import { MatchSummary } from '../components/tournament/MatchSummary';
import { TargetPicker } from '../components/tournament/TargetPicker';

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

/** A tournament match's own page: the live scorer while it's on court, its summary once finished. */
export default function TournamentScorerPage() {
  const { id, matchId } = useParams();
  const { tournaments } = useData();
  const { isAdmin } = useAuth();
  const me = useScorer();
  const [targetOpen, setTargetOpen] = useState(false);

  const t = tournaments?.find((x) => x.id === id);
  const m = t && matchId ? t.matches[matchId] : undefined;

  if (tournaments === null) return <Spinner />;
  if (!t || !m) {
    return (
      <Empty title="Match not found">
        It may have been deleted.{' '}
        <Link to={t ? `/tournaments/${t.id}` : '/sessions'} className="font-semibold underline">
          Back
        </Link>
      </Empty>
    );
  }

  // A finished match gets its summary page; the full-screen board is for scoring.
  if (m.status === 'completed') return <MatchSummary t={t} m={m} />;

  const rules = rulesFor(t, m);
  const onCourt = liveMatch(t);
  const courtBusy = onCourt !== null && onCourt.id !== m.id;
  const over = gameState(m.scoreA, m.scoreB, rules.pointsToWin, rules.maxPoints).over;

  return (
    <>
      <LiveScorer
        matchKey={`${t.id}:${m.id}`}
        title={
          <>
            <span className="font-score text-xl leading-none font-black tracking-wide">{matchCode(m.order)}</span> · {m.kind === 'doubles' ? 'Doubles' : 'Singles'}
          </>
        }
        subtitle={`${t.name}${m.time ? ` · ${formatTime(m.time)}` : ''}`}
        backTo={`/tournaments/${t.id}`}
        backLabel="Back to the tournament"
        sides={{
          a: { name: teamName(t, 'a'), fill: teamFill(t, 'a'), players: m.a },
          b: { name: teamName(t, 'b'), fill: teamFill(t, 'b'), players: m.b },
        }}
        status={m.status}
        log={m.log}
        scoreA={m.scoreA}
        scoreB={m.scoreB}
        typedPoints={m.typedPoints}
        firstServe={m.firstServe}
        rules={rules}
        scorer={m.scorer}
        notStarted={m.time ? `Starts around ${formatTime(m.time)}` : 'Not started yet'}
        onPoint={(log) => scoreTournamentMatch(t, m.id, log, me)}
        onClaim={() => claimTournamentScorer(t, m.id, me)}
        onFinish={() => finishTournamentMatch(t, m.id)}
        onFirstServe={(side) => setTournamentFirstServe(t, m.id, side)}
        actions={
          isAdmin && (
            <>
              {!over && (
                <Button variant="secondary" size="lg" onClick={() => setTargetOpen(true)} aria-label={`Game to ${rules.pointsToWin}. Change the target`}>
                  <Target size={18} /> {rules.pointsToWin}
                </Button>
              )}
              {m.status === 'scheduled' && (
                <Button size="lg" className="flex-1" disabled={courtBusy} onClick={() => startTournamentMatch(t, m.id, me)}>
                  <Play size={18} /> {courtBusy ? `${matchCode(onCourt!.order)} is on court` : 'Start match'}
                </Button>
              )}
            </>
          )
        }
      />
      <Dialog open={targetOpen} onClose={() => setTargetOpen(false)} title="Game to">
        {targetOpen && <TargetForm t={t} m={m} onDone={() => setTargetOpen(false)} />}
      </Dialog>
    </>
  );
}
