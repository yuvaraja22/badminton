import clsx from 'clsx';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CheckCircle2, Pencil, Play, Radio, Shuffle, UserPlus, Users } from 'lucide-react';
import { useHoldUpdates } from '../../lib/appUpdate';
import { useData } from '../../lib/data/context';
import { saveMatch, setNextPick, shuffleNext, startLiveScoring, startMatch } from '../../lib/data/mutations';
import { useQueuePlan } from '../../lib/data/usePlan';
import { useScorer } from '../../lib/data/useScorer';
import { useWinChance } from '../../lib/data/useWinChance';
import { sortedMatches } from '../../lib/engine/games';
import { maxPointsFor, validFinalScore } from '../../lib/engine/scoring';
import type { PlannedMatch } from '../../lib/engine/scheduler';
import { matchCode, oneDecimal } from '../../lib/format';
import { levelName } from '../../lib/levels';
import { checkScores, lineupComplete, lineupOptions, type LineupOption } from '../../lib/lineup';
import type { Lineup, Match, PlayerId, Session, Team } from '../../lib/types';
import { Avatar } from '../ui/Avatar';
import { Badge, LiveDot } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader, Notice } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Field';
import { AddPlayerDialog, AttendeeDialog } from './AttendanceDialogs';
import { BalanceLabel } from './BalanceLabel';
import { ChanceBar, CourtMatch, TeamStack } from './CourtView';
import { LineupFields } from './LineupFields';
import { MatchDialog } from './MatchDialog';

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
  const navigate = useNavigate();
  const me = useScorer();
  const chance = skills ? chanceOf(match.teamA, match.teamB, skills) : null;
  const [a, setA] = useState(match.scoreA?.toString() ?? '');
  const [b, setB] = useState(match.scoreB?.toString() ?? '');
  const [stopped, setStopped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // An unusual final score the admin has been warned about once (saving it again keeps it).
  const [odd, setOdd] = useState<string | null>(null);
  // Being scored point by point on someone's phone: the score follows the scorer, not these boxes.
  const scoring = Boolean(match.log) || Boolean(match.scorer);
  const scorerPath = `/sessions/${session.id}/matches/${match.id}`;
  const dirty = !scoring && (a !== (match.scoreA?.toString() ?? '') || b !== (match.scoreB?.toString() ?? '') || stopped);
  // Typed but not saved yet: a new version of the app waits instead of reloading the page.
  useHoldUpdates(isAdmin && dirty);
  const maxPoints = maxPointsFor(session.pointsToWin);

  const save = (thenStart: boolean) => {
    const status = stopped ? 'unfinished' : 'completed';
    const check = checkScores(a, b, status);
    if (!check.ok) return setError(check.message);
    setError(null);
    if (status === 'completed' && check.scoreA !== null && check.scoreB !== null) {
      const key = `${check.scoreA}-${check.scoreB}`;
      if (!validFinalScore(check.scoreA, check.scoreB, session.pointsToWin, maxPoints) && odd !== key) return setOdd(key);
    }
    saveMatch(session, { ...match, scoreA: check.scoreA, scoreB: check.scoreB, status });
    if (thenStart && next) startMatch(session, { teamA: next.teamA, teamB: next.teamB });
  };
  const warned = odd !== null && odd === `${a.trim()}-${b.trim()}`;

  const scoreBox = (value: string, set: (v: string) => void, label: string) => (
    <Input
      aria-label={label}
      type="number"
      inputMode="numeric"
      enterKeyHint="done"
      value={value}
      onChange={(e) => set(e.target.value)}
      placeholder="–"
      className="font-score tabular h-16 w-[4.75rem] shrink-0 rounded-2xl border-white/25 bg-black/25 px-1 text-center text-[2.6rem] font-black text-court-ink placeholder:text-court-ink/45 hover:border-white/40 focus:border-volt focus:ring-volt/30"
    />
  );
  const liveScore = (value: number | null) => <span className="font-score tabular text-[3rem] leading-none font-black text-court-ink">{value ?? 0}</span>;

  return (
    <section className="court-mat relative overflow-hidden rounded-[1.6rem] p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 px-1 pt-0.5 pb-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold tracking-[0.14em] text-accent-ink uppercase">
          <LiveDot /> Now playing
        </span>
        <span className="font-score text-[1.6rem] leading-none font-black tracking-wide">{matchCode(match.number)}</span>
        {isAdmin && (
          <button type="button" onClick={onEdit} className="ml-auto flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">
            <Pencil size={14} /> Edit
          </button>
        )}
      </div>
      <CourtMatch
        teamA={match.teamA}
        teamB={match.teamB}
        scoreA={scoring ? liveScore(match.scoreA) : isAdmin ? scoreBox(a, setA, 'Team 1 score') : undefined}
        scoreB={scoring ? liveScore(match.scoreB) : isAdmin ? scoreBox(b, setB, 'Team 2 score') : undefined}
        className={isAdmin || scoring ? 'min-h-60' : 'min-h-44'}
      />
      <div className="space-y-3 px-1 pt-3.5">
        {chance != null && <ChanceBar chance={chance} onCourt />}
        <BalanceLabel levelA={teamLevel(session, match.teamA, skills)} levelB={teamLevel(session, match.teamB, skills)} chance={chance} className="text-court-ink/85" />
        {scoring ? (
          <Link to={scorerPath} className="block">
            <Button variant="volt" size="lg" block>
              <Radio size={17} /> {isAdmin ? 'Open the live scorer' : 'Watch live, point by point'}
            </Button>
          </Link>
        ) : (
          isAdmin && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={stopped} onChange={(e) => setStopped(e.target.checked)} className="size-4 accent-[var(--volt)]" />
                Stopped early (not counted in stats)
              </label>
              {error && <Notice tone="bad">{error}</Notice>}
              {warned && (
                <Notice tone="warn">
                  {a}–{b} isn't a usual finish for a game to {session.pointsToWin} (win by 2, max {maxPoints}). Tap Save again to keep it.
                </Notice>
              )}
              <div className="grid grid-cols-2 gap-2 pb-1">
                <Button variant="secondary" size="lg" onClick={() => save(false)}>
                  Save result
                </Button>
                <Button variant="volt" size="lg" onClick={() => save(true)} disabled={!next}>
                  Save &amp; next <Play size={16} />
                </Button>
              </div>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold text-court-ink/90 hover:bg-white/10"
                onClick={() => {
                  startLiveScoring(session, match.id, me);
                  navigate(scorerPath);
                }}
              >
                <Radio size={15} /> Score point by point instead
              </button>
            </>
          )
        )}
      </div>
    </section>
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

export function CourtTab({ session, isAdmin }: { session: Session; isAdmin: boolean }) {
  const { nameOf, playersById } = useData();
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
  const counts = { available: 0, resting: 0, left: 0 };
  for (const [, a] of attendees) counts[a.status] += 1;
  const evenCount = plan && plan.evenNow ? plan.played[plan.available[0]] : null;

  return (
    <div className="space-y-4">
      {live && <NowPlaying key={live.id} session={session} match={live} next={next} skills={plan?.skills} isAdmin={isAdmin} onEdit={() => setEditMatch(live)} />}

      <Card className="overflow-hidden">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              Up next
              {next?.pinned && <Badge tone="info">Your lineup</Badge>}
            </span>
          }
          action={next && <span className="font-score -mt-1 text-[1.6rem] leading-none font-black tracking-wide text-muted">{matchCode(next.number)}</span>}
        />
        <div className="space-y-3.5 px-4 pt-3 pb-4">
          {plan?.blocked && <Notice tone="warn">{plan.blocked}</Notice>}
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
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <TeamStack ids={next.teamA} />
                <span className="font-score flex size-9 items-center justify-center rounded-full bg-chip text-sm font-black tracking-wider text-chip-ink">VS</span>
                <TeamStack ids={next.teamB} align="end" />
              </div>
              {plan && <ChanceBar chance={chanceOf(next.teamA, next.teamB, plan.skills)} />}
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
                <span className="font-score w-11 shrink-0 rounded-lg bg-surface-2 py-1 text-center text-[15px] leading-none font-black tracking-wide text-muted">{matchCode(m.number)}</span>
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
          {attendees.map(([id, a]) => (
            <li key={id}>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => setAttendee(id)}
                className={clsx('flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left', isAdmin && 'hover:bg-surface-2', a.status !== 'available' && 'opacity-60')}
              >
                <Avatar name={nameOf(id)} photo={playersById.get(id)?.photo} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{nameOf(id)}</span>
                  <span className="tabular text-xs text-muted">
                    {plan && plan.skills[id] !== a.level ? `Rating ${oneDecimal(plan.skills[id])}` : levelName(a.level)} · {plan?.played[id] ?? 0} game{(plan?.played[id] ?? 0) === 1 ? '' : 's'}
                  </span>
                </span>
                {a.status === 'resting' && <Badge tone="warn">Resting</Badge>}
                {a.status === 'left' && <Badge>Left</Badge>}
                {a.status === 'available' && onCourt.has(id) && <Badge tone="live">On court</Badge>}
                {a.status === 'available' && !onCourt.has(id) && upNext.has(id) && <Badge tone="info">Up next</Badge>}
              </button>
            </li>
          ))}
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
