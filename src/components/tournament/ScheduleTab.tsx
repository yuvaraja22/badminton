import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowDown, ArrowUp, Clock, Hash, MoreVertical, Pencil, Play, Plus, RotateCcw, Trash2, Tv } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useData } from '../../lib/data/context';
import {
  addTournamentMatch,
  deleteTournamentMatch,
  editTournamentMatch,
  fillTournamentTimes,
  moveTournamentMatch,
  resetTournamentMatch,
  setTournamentMatchScore,
  setTournamentMatchTime,
  startTournamentMatch,
} from '../../lib/data/mutations';
import { useScorer } from '../../lib/data/useScorer';
import {
  addMinutes,
  backToBack,
  checkMatch,
  liveMatch,
  matchWinner,
  maxPointsFor,
  minutesBetween,
  nextTime,
  playerRecords,
  playerTeam,
  rulesFor,
  sideSize,
  tournamentMatches,
  validFinalScore,
} from '../../lib/engine/tournament';
import { formatTime, listJoin, matchCode } from '../../lib/format';
import { teamFill, teamName } from '../../lib/teamColors';
import { toast } from '../../lib/toast';
import type { MatchKind, PlayerId, TeamKey, Tournament, TournamentMatch } from '../../lib/types';
import { Badge, LiveDot } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader, Notice } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Field, Input, Select, Toggle } from '../ui/Field';
import { Menu, type MenuItem } from '../ui/Menu';
import { Segmented } from '../ui/Segmented';
import { TargetPicker } from './TargetPicker';
import { SideNames, TeamDot } from './TeamBits';

const nextOrder = (t: Tournament) => Math.max(0, ...Object.values(t.matches).map((m) => m.order)) + 1;

/** Add or edit a match: doubles or singles, each side picked from its own team (the common player is on both). */
function MatchForm({ t, match, onDone }: { t: Tournament; match: TournamentMatch | null; onDone: () => void }) {
  const { nameOf } = useData();
  const [kind, setKind] = useState<MatchKind>(match?.kind ?? 'doubles');
  const [a, setA] = useState<PlayerId[]>(match?.a ?? []);
  const [b, setB] = useState<PlayerId[]>(match?.b ?? []);
  const [time, setTime] = useState(match ? (match.time ?? '') : (nextTime(t) ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const n = sideSize(kind);
  const order = match?.order ?? nextOrder(t);

  const pick = (team: TeamKey, id: PlayerId) => {
    const [current, set] = team === 'a' ? [a, setA] : [b, setB];
    setError(null);
    setAdded(null);
    if (current.includes(id)) set(current.filter((x) => x !== id));
    else set(current.length < n ? [...current, id] : [...current.slice(1), id]);
  };

  const changeKind = (k: MatchKind) => {
    setKind(k);
    setA((x) => x.slice(0, sideSize(k)));
    setB((x) => x.slice(0, sideSize(k)));
  };

  const complete = a.length === n && b.length === n;
  const repeat = complete ? backToBack(t, order, [...a, ...b]) : [];
  const before = tournamentMatches(t).filter((m) => m.order < order).at(-1);

  const save = () => {
    const problem = checkMatch(t, kind, a, b, nameOf);
    if (problem) return setError(problem);
    const at = time || null;
    if (match) {
      editTournamentMatch(t, match.id, { kind, a, b, time: at });
      return onDone();
    }
    addTournamentMatch(t, { kind, a, b, time: at });
    setAdded(`${matchCode(order)} added. Pick the next one, or tap Done.`);
    setA([]);
    setB([]);
    if (at) setTime(addMinutes(at, t.schedule.minutes));
  };

  const side = (team: TeamKey, chosen: PlayerId[], other: PlayerId[]) => (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
        <TeamDot t={t} team={team} /> {teamName(t, team)}
        <span className="text-muted">· pick {n === 2 ? 'two' : 'one'}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {t.teams[team].players.map((id) => {
          const on = chosen.includes(id);
          const taken = other.includes(id);
          return (
            <button
              key={id}
              type="button"
              disabled={taken}
              aria-pressed={on}
              onClick={() => pick(team, id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-40',
                on ? 'border-transparent text-white' : 'border-line hover:bg-surface-2',
              )}
              style={on ? { background: teamFill(t, team) } : undefined}
            >
              {nameOf(id)}
              {playerTeam(t, id) === 'both' && <span className="font-normal opacity-75"> · both</span>}
            </button>
          );
        })}
        {!t.teams[team].players.length && <span className="text-sm text-muted">No players on this team yet (Teams tab).</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Segmented
        value={kind}
        onChange={changeKind}
        options={[
          { value: 'doubles', label: 'Doubles' },
          { value: 'singles', label: 'Singles' },
        ]}
      />
      {side('a', a, b)}
      {side('b', b, a)}
      <Field label="Time (tentative)">
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      {repeat.length > 0 && before && (
        <Notice tone="warn">
          {listJoin(repeat.map(nameOf))} also {repeat.length === 1 ? 'plays' : 'play'} {matchCode(before.order)}, right before this one.
        </Notice>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
      {added && <Notice tone="good">{added}</Notice>}
      {match ? (
        <Button block onClick={save}>
          Save
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onDone}>
            Done
          </Button>
          <Button onClick={save}>
            <Plus size={16} /> Add {matchCode(order)}
          </Button>
        </div>
      )}
    </div>
  );
}

function TimesForm({ t, onDone }: { t: Tournament; onDone: () => void }) {
  const [start, setStart] = useState(t.schedule.start ?? '07:00');
  const [minutes, setMinutes] = useState(t.schedule.minutes || 15);
  const count = Object.keys(t.matches).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First match at">
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Each match">
          <Select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            {[10, 12, 15, 20, 25, 30].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-sm text-muted">
        {count > 1 && start
          ? `Sets all ${count} times: ${formatTime(start)}, ${formatTime(addMinutes(start, minutes))} … ${formatTime(addMinutes(start, minutes * (count - 1)))}. You can still change any match afterwards.`
          : 'New matches get their times from here. You can change any of them later.'}
      </p>
      <Button
        block
        disabled={!start}
        onClick={() => {
          fillTournamentTimes(t, start, minutes);
          onDone();
        }}
      >
        {count ? 'Fill in the times' : 'Save'}
      </Button>
    </div>
  );
}

function MatchTimeForm({ t, m, onDone }: { t: Tournament; m: TournamentMatch; onDone: () => void }) {
  const [time, setTime] = useState(m.time ?? '');
  const [shift, setShift] = useState(true);
  const later = tournamentMatches(t).filter((x) => x.order > m.order && x.time).length;
  const delta = m.time && time ? minutesBetween(m.time, time) : 0;
  return (
    <div className="space-y-4">
      <Field label={`${matchCode(m.order)} starts at`}>
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      {m.time && later > 0 && (
        <Toggle
          checked={shift}
          onChange={setShift}
          label={`Move the ${later} later match${later === 1 ? '' : 'es'} too${delta ? ` (${delta > 0 ? '+' : '−'}${Math.abs(delta)} min)` : ''}`}
        />
      )}
      <Button
        block
        onClick={() => {
          setTournamentMatchTime(t, m.id, time || null, shift && later > 0);
          onDone();
        }}
      >
        Save
      </Button>
    </div>
  );
}

/** Type in a final score: a match scored on paper, or a correction. */
function ScoreForm({ t, m, onDone }: { t: Tournament; m: TournamentMatch; onDone: () => void }) {
  const [a, setA] = useState(m.status === 'scheduled' ? '' : String(m.scoreA));
  const [b, setB] = useState(m.status === 'scheduled' ? '' : String(m.scoreB));
  const [target, setTarget] = useState(rulesFor(t, m).pointsToWin);
  const [na, nb] = [Number(a), Number(b)];
  const filled = a !== '' && b !== '' && [na, nb].every((x) => Number.isInteger(x) && x >= 0 && x <= 99);
  const tied = filled && na === nb;
  const unusual = filled && !tied && !validFinalScore(na, nb, target, maxPointsFor(target));
  const box = (team: TeamKey, value: string, set: (v: string) => void) => (
    <Field
      label={
        <span className="inline-flex items-center gap-1.5">
          <TeamDot t={t} team={team} /> {teamName(t, team)}
        </span>
      }
    >
      <Input type="number" inputMode="numeric" min={0} max={99} value={value} onChange={(e) => set(e.target.value)} className="font-score tabular h-16 text-center text-4xl font-black" />
    </Field>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {box('a', a, setA)}
        {box('b', b, setB)}
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-medium">Game to</span>
        <TargetPicker value={target} onChange={setTarget} />
      </div>
      {tied && <Notice tone="bad">A match needs a winner.</Notice>}
      {unusual && (
        <Notice tone="warn">
          That isn't a finished game to {target} (win by 2, max {maxPointsFor(target)}). It will be saved as entered.
        </Notice>
      )}
      <Button
        block
        disabled={!filled || tied}
        onClick={() => {
          setTournamentMatchScore(t, m.id, na, nb, target);
          onDone();
        }}
      >
        Save final score
      </Button>
    </div>
  );
}

function PlayerCounts({ t }: { t: Tournament }) {
  const { nameOf } = useData();
  const rank = { a: 0, both: 1, b: 2 };
  const lines = playerRecords(t).sort((x, y) => rank[x.team] - rank[y.team] || nameOf(x.playerId).localeCompare(nameOf(y.playerId)));
  if (!lines.length) return null;
  return (
    <Card>
      <CardHeader title="Matches per player" subtitle="Helps keep the schedule fair. Counts every match in the schedule." />
      <table className="tabular mt-2 w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="px-4 py-1.5 text-left font-semibold">Player</th>
            <th className="px-2 py-1.5 font-semibold">Doubles</th>
            <th className="px-2 py-1.5 font-semibold">Singles</th>
            <th className="px-4 py-1.5 font-semibold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lines.map((l) => (
            <tr key={l.playerId}>
              <td className="px-4 py-2">
                <span className="flex items-center gap-2">
                  {(l.team === 'a' || l.team === 'both') && <TeamDot t={t} team="a" />}
                  {(l.team === 'b' || l.team === 'both') && <TeamDot t={t} team="b" />}
                  <span className="truncate">{nameOf(l.playerId)}</span>
                  {l.team === 'both' && <span className="text-xs text-muted">both teams</span>}
                </span>
              </td>
              <td className="px-2 py-2 text-center">{l.doubles}</td>
              <td className="px-2 py-2 text-center">{l.singles}</td>
              <td className="px-4 py-2 text-center font-semibold">{l.doubles + l.singles}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

type DialogState =
  | { kind: 'add' }
  | { kind: 'times' }
  | { kind: 'edit' | 'time' | 'score' | 'delete' | 'reset'; m: TournamentMatch }
  | null;

export function ScheduleTab({ t, isAdmin }: { t: Tournament; isAdmin: boolean }) {
  const navigate = useNavigate();
  const scorer = useScorer();
  const [dialog, setDialog] = useState<DialogState>(null);
  const list = tournamentMatches(t);
  const live = liveMatch(t);
  const doubles = list.filter((m) => m.kind === 'doubles').length;
  const noTeams = !t.teams.a.players.length || !t.teams.b.players.length;
  const hrefOf = (m: TournamentMatch) => `/tournaments/${t.id}/matches/${m.id}`;
  const close = () => setDialog(null);

  const start = (m: TournamentMatch) => {
    if (live && live.id !== m.id) return toast(`${matchCode(live.order)} is still on court. Finish it first.`, 'error');
    startTournamentMatch(t, m.id, scorer);
    navigate(hrefOf(m));
  };

  const actions = (m: TournamentMatch, i: number): MenuItem[] => [
    ...(m.status === 'scheduled' && !live ? [{ label: 'Start and score', icon: <Play size={16} />, onClick: () => start(m) }] : []),
    ...(m.status !== 'scheduled' ? [{ label: m.status === 'live' ? 'Open the scorer' : 'Open', icon: <Tv size={16} />, onClick: () => navigate(hrefOf(m)) }] : []),
    { label: m.status === 'completed' ? 'Edit the score' : 'Enter the final score', icon: <Hash size={16} />, onClick: () => setDialog({ kind: 'score', m }) },
    { label: 'Change players', icon: <Pencil size={16} />, onClick: () => setDialog({ kind: 'edit', m }) },
    { label: 'Change the time', icon: <Clock size={16} />, onClick: () => setDialog({ kind: 'time', m }) },
    ...(i > 0 ? [{ label: 'Move up', icon: <ArrowUp size={16} />, onClick: () => moveTournamentMatch(t, m.id, -1) }] : []),
    ...(i < list.length - 1 ? [{ label: 'Move down', icon: <ArrowDown size={16} />, onClick: () => moveTournamentMatch(t, m.id, 1) }] : []),
    ...(m.status !== 'scheduled' ? [{ label: 'Reset to not played', icon: <RotateCcw size={16} />, onClick: () => setDialog({ kind: 'reset', m }) }] : []),
    { label: 'Delete match', icon: <Trash2 size={16} />, danger: true, onClick: () => setDialog({ kind: 'delete', m }) },
  ];

  const confirm = dialog && (dialog.kind === 'delete' || dialog.kind === 'reset') ? dialog : null;

  return (
    <div className="space-y-4">
      {isAdmin && noTeams && <Notice tone="warn">Add players to both teams first, on the Teams tab.</Notice>}
      <Card>
        <CardHeader
          title={`${list.length} match${list.length === 1 ? '' : 'es'}`}
          subtitle={`${doubles} doubles · ${list.length - doubles} singles${t.schedule.start ? ` · from ${formatTime(t.schedule.start)}, ${t.schedule.minutes} min each` : ''}`}
        />
        {isAdmin && (
          <div className="flex gap-2 px-4 pt-3">
            <Button size="sm" className="flex-1" disabled={noTeams} onClick={() => setDialog({ kind: 'add' })}>
              <Plus size={15} /> Add matches
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setDialog({ kind: 'times' })} aria-label="Match times">
              <Clock size={15} /> Times
            </Button>
          </div>
        )}
        {list.length === 0 ? (
          <p className="px-4 pt-2 pb-4 text-sm text-muted">{isAdmin ? 'No matches yet. Tap Add matches to add the first one.' : 'The schedule appears here once it is set.'}</p>
        ) : (
          <ol className="divide-y divide-line pt-2">
            {list.map((m, i) => {
              const winner = matchWinner(m);
              return (
                <li key={m.id} className={cn('px-4 py-3', m.status === 'live' && 'bg-accent/5')}>
                  <div className="flex min-h-8 items-center gap-2">
                    <span className="font-score text-lg leading-none font-black tracking-wide">{matchCode(m.order)}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted">
                      {m.time ? formatTime(m.time) : 'No time'} · {m.kind === 'doubles' ? 'Doubles' : 'Singles'}
                      {rulesFor(t, m).pointsToWin !== t.pointsToWin && ` · to ${rulesFor(t, m).pointsToWin}`}
                    </span>
                    {m.status === 'completed' && (
                      <span className="font-score tabular text-xl leading-none font-black">
                        {m.scoreA}–{m.scoreB}
                      </span>
                    )}
                    {m.status === 'live' && (
                      <Link to={hrefOf(m)}>
                        <Badge tone="live">
                          <LiveDot /> {m.scoreA}–{m.scoreB}
                        </Badge>
                      </Link>
                    )}
                    {m.status === 'scheduled' && isAdmin && !live && (
                      <Button size="sm" variant="secondary" onClick={() => start(m)}>
                        <Play size={14} /> Start
                      </Button>
                    )}
                    {isAdmin && <Menu trigger={<MoreVertical size={18} />} items={actions(m, i)} label={`${matchCode(m.order)} actions`} />}
                  </div>
                  <Link to={hrefOf(m)} className="mt-1 block space-y-1 text-sm">
                    <SideNames t={t} team="a" ids={m.a} strong={winner === 'a'} />
                    <SideNames t={t} team="b" ids={m.b} strong={winner === 'b'} />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
        {/* A second Add at the end, so a long schedule doesn't need scrolling back up. */}
        {isAdmin && list.length >= 3 && (
          <div className="border-t border-line p-3">
            <Button size="sm" variant="secondary" block disabled={noTeams} onClick={() => setDialog({ kind: 'add' })}>
              <Plus size={15} /> Add {matchCode(list.length + 1)}
            </Button>
          </div>
        )}
      </Card>

      {isAdmin && list.length > 0 && <PlayerCounts t={t} />}

      <Dialog open={dialog?.kind === 'add' || dialog?.kind === 'edit'} onClose={close} title={dialog?.kind === 'edit' ? `Change ${matchCode(dialog.m.order)}` : 'Add matches'}>
        {(dialog?.kind === 'add' || dialog?.kind === 'edit') && <MatchForm t={t} match={dialog.kind === 'edit' ? dialog.m : null} onDone={close} />}
      </Dialog>
      <Dialog open={dialog?.kind === 'times'} onClose={close} title="Match times">
        {dialog?.kind === 'times' && <TimesForm t={t} onDone={close} />}
      </Dialog>
      <Dialog open={dialog?.kind === 'time'} onClose={close} title="Change the time">
        {dialog?.kind === 'time' && <MatchTimeForm t={t} m={dialog.m} onDone={close} />}
      </Dialog>
      <Dialog open={dialog?.kind === 'score'} onClose={close} title={dialog?.kind === 'score' ? `${matchCode(dialog.m.order)} final score` : ''}>
        {dialog?.kind === 'score' && <ScoreForm t={t} m={dialog.m} onDone={close} />}
      </Dialog>
      <Dialog
        open={confirm !== null}
        onClose={close}
        title={confirm ? `${confirm.kind === 'delete' ? 'Delete' : 'Reset'} ${matchCode(confirm.m.order)}?` : ''}
        footer={
          confirm && (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>
                Keep it
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm.kind === 'delete') deleteTournamentMatch(t, confirm.m.id);
                  else resetTournamentMatch(t, confirm.m.id);
                  close();
                }}
              >
                {confirm.kind === 'delete' ? 'Delete match' : 'Reset'}
              </Button>
            </div>
          )
        }
      >
        {confirm && (
          <p className="text-sm">
            {confirm.kind === 'delete'
              ? 'The match is removed from the schedule and the later matches move up. Their times stay as they are.'
              : 'The score is cleared and the match goes back to not played.'}
          </p>
        )}
      </Dialog>
    </div>
  );
}
