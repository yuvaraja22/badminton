import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteMatch, saveMatch } from '../../lib/data/mutations';
import { newId } from '../../lib/ids';
import { checkScores, lineupComplete } from '../../lib/lineup';
import { maxPointsFor, validFinalScore } from '../../lib/engine/scoring';
import { matchCode } from '../../lib/format';
import type { Lineup, Match, Session } from '../../lib/types';
import { sortedMatches } from '../../lib/engine/games';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Field, Input } from '../ui/Field';
import { Segmented } from '../ui/Segmented';
import type { LineupOption } from '../../lib/lineup';
import { LineupFields } from './LineupFields';

/** Edit any match (players, score, status) or add a result that was played without the app. */
export function MatchDialog({
  open,
  onClose,
  session,
  match,
  options,
}: {
  open: boolean;
  onClose: () => void;
  session: Session;
  /** null = add a new result */
  match: Match | null;
  options: LineupOption[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title={match ? `Edit ${matchCode(match.number)}` : 'Add a result'}>
      {open && <MatchForm key={match?.id ?? 'new'} session={session} match={match} options={options} onDone={onClose} />}
    </Dialog>
  );
}

function MatchForm({ session, match, options, onDone }: { session: Session; match: Match | null; options: LineupOption[]; onDone: () => void }) {
  const [lineup, setLineup] = useState<Lineup>(match ? { teamA: match.teamA, teamB: match.teamB } : { teamA: ['', ''], teamB: ['', ''] });
  const [scoreA, setScoreA] = useState(match?.scoreA?.toString() ?? '');
  const [scoreB, setScoreB] = useState(match?.scoreB?.toString() ?? '');
  const [status, setStatus] = useState<Match['status']>(match?.status ?? 'completed');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // An unusual final score the admin has been warned about once (saving it again keeps it).
  const [odd, setOdd] = useState<string | null>(null);
  const maxPoints = maxPointsFor(session.pointsToWin);
  const warned = odd !== null && odd === `${scoreA.trim()}-${scoreB.trim()}`;

  const save = () => {
    if (!lineupComplete(lineup)) return setError('Pick four different players.');
    const check = checkScores(scoreA, scoreB, status);
    if (!check.ok) return setError(check.message);
    setError(null);
    if (status === 'completed' && check.scoreA !== null && check.scoreB !== null) {
      const key = `${check.scoreA}-${check.scoreB}`;
      if (!validFinalScore(check.scoreA, check.scoreB, session.pointsToWin, maxPoints) && odd !== key) return setOdd(key);
    }
    const base: Match = match ?? {
      id: newId(),
      number: (sortedMatches(session).at(-1)?.number ?? 0) + 1,
      teamA: lineup.teamA,
      teamB: lineup.teamB,
      scoreA: null,
      scoreB: null,
      status,
      available: [],
      createdAt: Date.now(),
      completedAt: null,
    };
    saveMatch(session, { ...base, teamA: lineup.teamA, teamB: lineup.teamB, scoreA: check.scoreA, scoreB: check.scoreB, status });
    onDone();
  };

  return (
    <div className="space-y-4">
      <LineupFields value={lineup} onChange={setLineup} options={options} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Team 1 score">
          <Input inputMode="numeric" type="number" value={scoreA} onChange={(e) => setScoreA(e.target.value)} placeholder="21" />
        </Field>
        <Field label="Team 2 score">
          <Input inputMode="numeric" type="number" value={scoreB} onChange={(e) => setScoreB(e.target.value)} placeholder="17" />
        </Field>
      </div>
      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { value: 'completed', label: 'Finished' },
          { value: 'unfinished', label: 'Stopped early' },
          ...(session.status === 'live' ? [{ value: 'live' as const, label: 'On court' }] : []),
        ]}
      />
      {error && <Notice tone="bad">{error}</Notice>}
      {warned && status === 'completed' && (
        <Notice tone="warn">
          {scoreA}–{scoreB} isn't a usual finish for a game to {session.pointsToWin} (win by 2, max {maxPoints}). Tap Save again to keep it.
        </Notice>
      )}
      <div className="flex items-center justify-between gap-2 pt-1">
        {match ? (
          confirmDelete ? (
            <Button
              variant="danger"
              onClick={() => {
                deleteMatch(session, match.id);
                onDone();
              }}
            >
              Really delete?
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-bad">
              <Trash2 size={16} /> Delete
            </Button>
          )
        ) : (
          <span />
        )}
        <Button onClick={save}>Save</Button>
      </div>
    </div>
  );
}
