import clsx from 'clsx';
import { useState } from 'react';
import { CheckCircle2, Pencil, Play, Shuffle, UserPlus, Users } from 'lucide-react';
import { useAuth, useData } from '../../lib/data/context';
import { saveMatch, setLeaveAfter, setNextPick, shuffleNext, startMatch } from '../../lib/data/mutations';
import { useQueuePlan } from '../../lib/data/usePlan';
import { useWinChance } from '../../lib/data/useWinChance';
import { statusAt } from '../../lib/engine/attendance';
import { lastMatchNumber, sortedMatches } from '../../lib/engine/games';
import type { PlannedMatch } from '../../lib/engine/scheduler';
import { matchCode, oneDecimal } from '../../lib/format';
import { levelName } from '../../lib/levels';
import { checkScores, lineupComplete, lineupOptions, type LineupOption } from '../../lib/lineup';
import type { Attendee, Lineup, Match, PlayerId, Session, Team } from '../../lib/types';
import { Avatar } from '../ui/Avatar';
import { Badge, LiveDot } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader, Notice } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Field';
import { AddPlayerDialog, AttendeeDialog } from './AttendanceDialogs';
import { BalanceLabel } from './BalanceLabel';
import { LeaveAfterSelect } from './LeaveAfterSelect';
import { LineupFields } from './LineupFields';
import { MatchDialog } from './MatchDialog';

function TeamNames({ team, strong }: { team: Team; strong?: boolean }) {
  const { nameOf } = useData();
  return (
    <div className={clsx('truncate text-[17px]', strong ? 'font-bold' : 'font-semibold')}>
      {nameOf(team[0])} &amp; {nameOf(team[1])}
    </div>
  );
}

/** Team strength as the scheduler sees it: rating-based skill when known, else the session level. */
function teamLevel(session: Session, team: Team, skills: Record<PlayerId, number> | undefined): number {
  const skill = (id: PlayerId) => skills?.[id] ?? session.attendees[id]?.level ?? 3;
  return skill(team[0]) + skill(team[1]);
}

function NowPlaying({
  session,
  match,
  next,
  skills,
  isAdmin,
  onEdit,
}: {
  session: Session;
  match: Match;
  next: PlannedMatch | null;
  skills: Record<PlayerId, number> | undefined;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const chanceOf = useWinChance();
  const chance = skills ? chanceOf(match.teamA, match.teamB, skills) : null;
  const [a, setA] = useState(match.scoreA?.toString() ?? '');
  const [b, setB] = useState(match.scoreB?.toString() ?? '');
  const [stopped, setStopped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = (thenStart: boolean) => {
    const status = stopped ? 'unfinished' : 'completed';
    const check = checkScores(a, b, status);
    if (!check.ok) return setError(check.message);
    setError(null);
    saveMatch(session, { ...match, scoreA: check.scoreA, scoreB: check.scoreB, status });
    if (thenStart && next) startMatch(session, { teamA: next.teamA, teamB: next.teamB });
  };

  const scoreBox = (value: string, set: (v: string) => void, label: string) => (
    <Input
      aria-label={label}
      type="number"
      inputMode="numeric"
      enterKeyHint="done"
      value={value}
      onChange={(e) => set(e.target.value)}
      placeholder="–"
      className="tabular h-14 w-20 shrink-0 text-center text-2xl font-bold"
    />
  );

  return (
    <Card className="overflow-hidden border-accent/40">
      <div className="flex items-center justify-between bg-accent/10 px-4 py-2.5">
        <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-accent">
          <LiveDot /> Now playing · {matchCode(match.number)}
        </span>
        {isAdmin && (
          <button type="button" onClick={onEdit} className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
            <Pencil size={14} /> Edit
          </button>
        )}
      </div>
      <div className="space-y-3 px-4 py-4">
        {isAdmin ? (
          <>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase text-muted">Team 1</div>
                <TeamNames team={match.teamA} strong />
              </div>
              {scoreBox(a, setA, 'Team 1 score')}
            </div>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase text-muted">Team 2</div>
                <TeamNames team={match.teamB} strong />
              </div>
              {scoreBox(b, setB, 'Team 2 score')}
            </div>
            <BalanceLabel levelA={teamLevel(session, match.teamA, skills)} levelB={teamLevel(session, match.teamB, skills)} chance={chance} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={stopped} onChange={(e) => setStopped(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Stopped early (not counted in stats)
            </label>
            {error && <Notice tone="bad">{error}</Notice>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="lg" onClick={() => save(false)}>
                Save result
              </Button>
              <Button size="lg" onClick={() => save(true)} disabled={!next}>
                Save &amp; next <Play size={16} />
              </Button>
            </div>
          </>
        ) : (
          <>
            <TeamNames team={match.teamA} strong />
            <div className="text-center text-xs font-bold uppercase text-muted">vs</div>
            <TeamNames team={match.teamB} strong />
            <BalanceLabel levelA={teamLevel(session, match.teamA, skills)} levelB={teamLevel(session, match.teamB, skills)} chance={chance} />
          </>
        )}
      </div>
    </Card>
  );
}

function LineupDialog({ open, onClose, session, initial, options }: { open: boolean; onClose: () => void; session: Session; initial: Lineup; options: LineupOption[] }) {
  return (
    <Dialog open={open} onClose={onClose} title="Change the next lineup">
      {open && <LineupForm session={session} initial={initial} options={options} onDone={onClose} />}
    </Dialog>
  );
}

function LineupForm({ session, initial, options, onDone }: { session: Session; initial: Lineup; options: LineupOption[]; onDone: () => void }) {
  const [lineup, setLineup] = useState<Lineup>(initial);
  const ok = lineupComplete(lineup);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Pick anyone who is playing. The matches after this one re-plan automatically around your choice.</p>
      <LineupFields value={lineup} onChange={setLineup} options={options} />
      <div className="flex gap-2">
        {session.nextPick && (
          <Button
            variant="secondary"
            onClick={() => {
              setNextPick(session, null);
              onDone();
            }}
          >
            Use suggestion
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!ok}
          onClick={() => {
            setNextPick(session, lineup);
            onDone();
          }}
        >
          Save lineup
        </Button>
      </div>
    </div>
  );
}

/** Leaving early, in the player list: "leaves after M10", "last game" (on court now) or "left after M10". */
function departureNote(a: Attendee, nextNumber: number, onCourt: boolean): string | null {
  if (a.leaveAfter == null || a.status === 'left') return null;
  if (nextNumber <= a.leaveAfter) return `leaves after ${matchCode(a.leaveAfter)}`;
  if (a.status !== 'available') return null;
  return onCourt ? 'last game' : `left after ${matchCode(a.leaveAfter)}`;
}

/** The signed-in player's own departure: they pick their last match, the planner fits in their games. */
function YourDeparture({ session, playerId, onCourt }: { session: Session; playerId: PlayerId; onCourt: boolean }) {
  const a = session.attendees[playerId];
  const gone = !onCourt && statusAt(a, lastMatchNumber(session) + 1) === 'left';
  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{gone ? "You've left this session" : 'Leaving early?'}</div>
        <p className="text-xs text-muted">
          {gone ? 'Changed your mind? Pick “Staying to the end” to play again.' : 'Pick your last match. The planner makes sure you get your fair share of games before then.'}
        </p>
      </div>
      <LeaveAfterSelect session={session} value={a.leaveAfter ?? null} onChange={(v) => setLeaveAfter(session, playerId, v)} label="Your last match" className="h-9 w-auto text-sm" />
    </Card>
  );
}

export function CourtTab({ session, isAdmin }: { session: Session; isAdmin: boolean }) {
  const { nameOf, playersById } = useData();
  const { playerId: myId } = useAuth();
  const plan = useQueuePlan(session, 5);
  const chanceOf = useWinChance();
  const matches = sortedMatches(session);
  const live = matches.find((m) => m.status === 'live') ?? null;
  const next = plan?.upcoming[0] ?? null;
  const [lineupOpen, setLineupOpen] = useState(false);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [attendee, setAttendee] = useState<PlayerId | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const attendees = Object.entries(session.attendees).sort(([, a], [, b]) => a.order - b.order);
  const onCourt = new Set(live ? [...live.teamA, ...live.teamB] : []);
  const upNext = new Set(next ? [...next.teamA, ...next.teamB] : []);
  const nextNumber = lastMatchNumber(session) + 1;
  // On court (possibly in their last match before leaving) counts as playing.
  const playing = (id: PlayerId, a: Attendee) => onCourt.has(id) && a.status === 'available';
  const statusOf = (id: PlayerId, a: Attendee) => (playing(id, a) ? 'available' : statusAt(a, nextNumber));
  const counts = { available: 0, resting: 0, left: 0 };
  for (const [id, a] of attendees) counts[statusOf(id, a)] += 1;
  const me = myId ? session.attendees[myId] : undefined;
  const evenCount = plan && plan.evenNow ? plan.played[plan.available[0]] : null;

  return (
    <div className="space-y-4">
      {live && <NowPlaying key={live.id} session={session} match={live} next={next} skills={plan?.skills} isAdmin={isAdmin} onEdit={() => setEditMatch(live)} />}

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              Up next{next ? ` · ${matchCode(next.number)}` : ''}
              {next?.pinned && <Badge tone="info">Your lineup</Badge>}
            </span>
          }
        />
        <div className="space-y-3 px-4 pt-3 pb-4">
          {plan?.blocked && <Notice tone="warn">{plan.blocked}</Notice>}
          {plan?.endsAfter != null && (
            <Notice tone="warn">Fewer than four players stay after {matchCode(plan.endsAfter)}, so no matches are planned after it.</Notice>
          )}
          {plan && !plan.nextPickValid && (
            <Notice tone="warn">
              Your saved lineup includes someone who is resting or has left, so the suggestion is shown instead.{' '}
              {isAdmin && (
                <button type="button" className="font-semibold underline" onClick={() => setNextPick(session, null)}>
                  Clear it
                </button>
              )}
            </Notice>
          )}
          {next && (
            <>
              <div className="space-y-1.5">
                <TeamNames team={next.teamA} />
                <div className="text-xs font-bold uppercase text-muted">vs</div>
                <TeamNames team={next.teamB} />
              </div>
              <BalanceLabel levelA={next.levelA} levelB={next.levelB} chance={plan ? chanceOf(next.teamA, next.teamB, plan.skills) : null} />
              {isAdmin && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="secondary" size="sm" onClick={() => setLineupOpen(true)}>
                    <Users size={15} /> Change players
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => shuffleNext(session)} disabled={!plan || plan.alternatives < 2}>
                    <Shuffle size={15} /> Shuffle
                  </Button>
                  {!live && (
                    <Button size="sm" className="ml-auto" onClick={() => startMatch(session, { teamA: next.teamA, teamB: next.teamB })}>
                      Start {matchCode(next.number)} <Play size={15} />
                    </Button>
                  )}
                </div>
              )}
              {isAdmin && live && <p className="text-xs text-muted">Save {matchCode(live.number)}’s result to put this match on court.</p>}
            </>
          )}
        </div>
      </Card>

      {plan && plan.upcoming.length > 1 && (
        <Card>
          <CardHeader title="After that" subtitle="Re-planned automatically whenever anything changes." />
          <ol className="divide-y divide-line px-4 pt-2 pb-1">
            {plan.upcoming.slice(1).map((m) => (
              <li key={m.number} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-9 shrink-0 font-bold text-muted">{matchCode(m.number)}</span>
                <span className="min-w-0 flex-1">
                  {nameOf(m.teamA[0])} &amp; {nameOf(m.teamA[1])} <span className="text-muted">vs</span> {nameOf(m.teamB[0])} &amp;{' '}
                  {nameOf(m.teamB[1])}
                </span>
                <BalanceLabel levelA={m.levelA} levelB={m.levelB} chance={chanceOf(m.teamA, m.teamB, plan.skills)} short className="shrink-0" />
              </li>
            ))}
          </ol>
          {(plan.checkpoint || evenCount !== null) && (
            <div className="flex items-start gap-2 border-t border-line px-4 py-3 text-sm">
              <CheckCircle2 size={18} className="mt-px shrink-0 text-good" />
              <span>
                {evenCount !== null && matches.length > 0 && <>Everyone playing is even right now ({evenCount} games each). </>}
                {plan.checkpoint &&
                  (plan.checkpoint.games !== null ? (
                    <>
                      Stop after <strong>{matchCode(plan.checkpoint.afterMatch)}</strong> and everyone will have played{' '}
                      <strong>{plan.checkpoint.games}</strong>.
                    </>
                  ) : (
                    <>
                      After <strong>{matchCode(plan.checkpoint.afterMatch)}</strong> everyone will have had a fair share of games.
                    </>
                  ))}
              </span>
            </div>
          )}
        </Card>
      )}

      {myId && me && me.status !== 'left' && <YourDeparture session={session} playerId={myId} onCourt={onCourt.has(myId)} />}

      <Card>
        <CardHeader
          title="Players"
          subtitle={`${counts.available} playing${counts.resting ? ` · ${counts.resting} resting` : ''}${counts.left ? ` · ${counts.left} left` : ''}`}
          action={
            isAdmin && (
              <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
                <UserPlus size={15} /> Add
              </Button>
            )
          }
        />
        <ul className="divide-y divide-line px-2 pt-2 pb-1">
          {attendees.map(([id, a]) => {
            const status = statusOf(id, a);
            const note = departureNote(a, nextNumber, playing(id, a));
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setAttendee(id)}
                  className={clsx('flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left', isAdmin && 'hover:bg-surface-2', status !== 'available' && 'opacity-60')}
                >
                  <Avatar name={nameOf(id)} photo={playersById.get(id)?.photo} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{nameOf(id)}</span>
                    <span className="tabular text-xs text-muted">
                      {plan && plan.skills[id] !== a.level ? `Rating ${oneDecimal(plan.skills[id])}` : levelName(a.level)} · {plan?.played[id] ?? 0} game
                      {(plan?.played[id] ?? 0) === 1 ? '' : 's'}
                      {note && ` · ${note}`}
                    </span>
                  </span>
                  {status === 'resting' && <Badge tone="warn">Resting</Badge>}
                  {status === 'left' && <Badge>Left</Badge>}
                  {playing(id, a) && <Badge tone="live">On court</Badge>}
                  {status === 'available' && !onCourt.has(id) && upNext.has(id) && <Badge tone="info">Up next</Badge>}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {next && (
        <LineupDialog
          open={lineupOpen}
          onClose={() => setLineupOpen(false)}
          session={session}
          initial={{ teamA: next.teamA, teamB: next.teamB }}
          options={lineupOptions(session, nameOf, true, plan?.skills)}
        />
      )}
      <MatchDialog open={editMatch !== null} onClose={() => setEditMatch(null)} session={session} match={editMatch} options={lineupOptions(session, nameOf, false, plan?.skills)} />
      <AttendeeDialog session={session} playerId={attendee} onClose={() => setAttendee(null)} />
      <AddPlayerDialog session={session} open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
