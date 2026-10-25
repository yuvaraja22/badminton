import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarPlus, Check, Minus, MoreVertical, Pencil, Play, Plus, Repeat, Share2, Trash2, X } from 'lucide-react';
import { useAuth, useData } from '../../lib/data/context';
import {
  cancelPlannedSession,
  createTournament,
  markPlannedStarted,
  planSession,
  rollWeeklyPlans,
  setRsvp,
  skipPlannedWeek,
  updatePlannedSession,
} from '../../lib/data/mutations';
import { rsvpLists } from '../../lib/engine/rsvp';
import { DEFAULT_TOURNAMENT_NAME } from '../../lib/engine/tournament';
import { addDaysISO, dateParts, dayDate, formatTime, longDate, nextWeekendISO, shortDate, todayISO } from '../../lib/format';
import { usingEmulators } from '../../lib/firebase';
import { cn } from '../../lib/cn';
import { shareLink } from '../../lib/share';
import { MAX_GUESTS, type PlannedSession } from '../../lib/types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card, Notice } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Field, Input, Toggle } from '../ui/Field';
import { Menu } from '../ui/Menu';
import { Segmented } from '../ui/Segmented';
import { StartDialog } from '../play/StartDialog';

function PlanForm({ planned, onDone }: { planned: PlannedSession | null; onDone: () => void }) {
  const [kind, setKind] = useState<PlannedSession['kind']>(planned?.kind ?? 'session');
  const [name, setName] = useState(planned?.name ?? DEFAULT_TOURNAMENT_NAME);
  const [date, setDate] = useState(planned?.date ?? nextWeekendISO());
  const [time, setTime] = useState(planned?.time ?? '');
  const [note, setNote] = useState(planned?.note ?? '');
  const [cap, setCap] = useState(planned?.cap ? String(planned.cap) : '');
  const [weekly, setWeekly] = useState(planned?.repeat === 'weekly');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (!date) return setError('Pick a date.');
    if (date < todayISO()) return setError('Pick today or a future date.');
    if (kind === 'tournament' && !name.trim()) return setError('Give the tournament a name.');
    const limit = cap.trim() ? Number(cap) : null;
    if (limit !== null && (!Number.isInteger(limit) || limit < 4 || limit > 99)) return setError('The most players has to be a whole number from 4 to 99, or empty for no limit.');
    const input = {
      kind,
      name: kind === 'tournament' ? name.trim() : null,
      date,
      time: time || null,
      note: note.trim() || null,
      cap: limit,
      repeat: weekly ? ('weekly' as const) : null,
    };
    if (planned) updatePlannedSession(planned.id, input);
    else planSession(input);
    onDone();
  };
  return (
    <div className="space-y-4">
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'session', label: 'Session' },
          { value: 'tournament', label: 'Tournament' },
        ]}
      />
      {kind === 'tournament' && (
        <Field label="Tournament name">
          <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <Input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time (optional)">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Note (optional)" hint="e.g. court number, venue, who's bringing shuttles.">
        <Input value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} placeholder="Court 2, bring shuttles" />
      </Field>
      <Field label="Most players (optional)" hint="Guests count too. Anyone after that goes on a waitlist and moves up when someone drops out.">
        <Input type="number" inputMode="numeric" min={4} max={99} value={cap} onChange={(e) => setCap(e.target.value)} placeholder="No limit" />
      </Field>
      <Toggle checked={weekly} onChange={setWeekly} label="Repeat every week (the next one is planned when this one starts)" />
      {error && <Notice tone="bad">{error}</Notice>}
      <Button block onClick={save}>
        {planned ? 'Save' : `Plan ${kind}`}
      </Button>
    </div>
  );
}

/** "+ guests" stepper next to I'm in. */
function GuestStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-full border border-line px-1.5 py-1 text-sm">
      <span className="pl-2 text-muted">Bringing guests</span>
      <span className="inline-flex items-center gap-1">
        <button type="button" aria-label="One guest fewer" disabled={value <= 0} onClick={() => onChange(value - 1)} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30">
          <Minus size={15} />
        </button>
        <span className="font-score tabular w-5 text-center text-lg font-black">{value}</span>
        <button type="button" aria-label="One guest more" disabled={value >= MAX_GUESTS} onClick={() => onChange(value + 1)} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2 disabled:opacity-30">
          <Plus size={15} />
        </button>
      </span>
    </div>
  );
}

/** One planned session or tournament: who's in, the waitlist, an RSVP for linked players and admin controls. */
function PlannedCard({ next, compact }: { next: PlannedSession; compact?: boolean }) {
  const { nameOf, playersById } = useData();
  const { isAdmin, playerId, user, signIn } = useAuth();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'edit' | 'cancel' | null>(null);

  const lists = rsvpLists(next, (id) => playersById.has(id));
  const mine = playerId ? (next.rsvps[playerId] ?? null) : null;
  const myStatus = mine?.status ?? null;
  const tournament = next.kind === 'tournament';
  const what = tournament ? 'tournament' : 'session';
  const waitPlace = playerId ? lists.waitlist.indexOf(playerId) : -1;
  const guestsTotal = Object.entries(lists.guests)
    .filter(([id]) => lists.confirmed.includes(id))
    .reduce((s, [, g]) => s + g, 0);

  const start = () => {
    if (!tournament) return navigate(`/sessions/new?event=${next.id}`);
    // The tournament takes over the plan; everyone who said they're in is listed first when picking teams.
    const id = createTournament({ name: next.name ?? DEFAULT_TOURNAMENT_NAME, date: next.date, invited: lists.confirmed });
    markPlannedStarted(next, id);
    navigate(`/tournaments/${id}?tab=teams`);
  };

  const invite = () => {
    const when = [dayDate(next.date), next.time && formatTime(next.time), next.note].filter(Boolean).join(' · ');
    const count = `${lists.spots} in so far${next.cap ? ` (of ${next.cap})` : ''}`;
    shareLink({
      title: tournament ? (next.name ?? 'Badminton tournament') : 'Badminton',
      text: `${tournament ? `${next.name}: ` : 'Badminton: '}${when}. ${count}. Say if you're in:`,
      url: window.location.origin,
    });
  };

  const people = (ids: string[], muted?: boolean) => (
    <ul className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <li key={id} className={cn('inline-flex items-center gap-1.5 rounded-full border border-line py-0.5 pr-3 pl-0.5 text-sm font-semibold', muted ? 'bg-surface text-muted' : 'bg-surface-2/70')}>
          <Avatar name={nameOf(id)} photo={playersById.get(id)?.photo} size={26} />
          {nameOf(id)}
          {lists.guests[id] ? <span className="font-normal text-muted">+{lists.guests[id]}</span> : null}
        </li>
      ))}
    </ul>
  );

  const menu = isAdmin && (
    <div className="-mt-2 -mr-2">
      <Menu
        trigger={<MoreVertical size={20} />}
        items={[
          { label: 'Edit', icon: <Pencil size={16} />, onClick: () => setDialog('edit') },
          { label: `Cancel ${what}`, icon: <Trash2 size={16} />, danger: true, onClick: () => setDialog('cancel') },
        ]}
      />
    </div>
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex items-stretch">
        {/* Ticket stub: the date, with notches cut where it tears off. */}
        <div className={cn('relative flex shrink-0 flex-col items-center justify-center bg-chip text-chip-ink', compact ? 'w-18 py-3' : 'w-24 py-4')}>
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase opacity-75">{dateParts(next.date).weekday}</span>
          <span className={cn('font-score leading-[0.95] font-black', compact ? 'text-[2.4rem]' : 'text-[3.2rem]')}>{dateParts(next.date).day}</span>
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase opacity-75">{dateParts(next.date).month}</span>
          <span aria-hidden className="absolute -top-2.5 -right-2.5 size-5 rounded-full bg-bg" />
          <span aria-hidden className="absolute -right-2.5 -bottom-2.5 size-5 rounded-full bg-bg" />
        </div>
        <div className="min-w-0 flex-1 border-l-2 border-dashed border-line px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="kicker flex items-center gap-1.5">
              {compact ? `Also coming up` : `Next ${what}`}
              {next.repeat === 'weekly' && (
                <span className="inline-flex items-center gap-1 normal-case tracking-normal" title="Planned again every week">
                  <Repeat size={12} aria-hidden /> weekly
                </span>
              )}
            </h2>
            {menu}
          </div>
          <p className="mt-1 text-lg leading-tight font-bold tracking-tight">{tournament ? next.name : dayDate(next.date)}</p>
          {(tournament || next.time || next.note) && (
            <p className="mt-0.5 text-sm text-muted">{[tournament && dayDate(next.date), next.time && formatTime(next.time), next.note].filter(Boolean).join(' · ')}</p>
          )}
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-score text-2xl leading-none font-black text-good">{lists.spots}</span>
            <span className="font-semibold text-good">
              in{next.cap ? ` of ${next.cap}` : ''}
              {guestsTotal > 0 ? ` (incl. ${guestsTotal} guest${guestsTotal === 1 ? '' : 's'})` : ''}
            </span>
            {lists.waitlist.length > 0 && <span className="text-warn">· {lists.waitlist.length} waiting</span>}
            {lists.out.length > 0 && <span className="text-muted">· {lists.out.length} can't make it</span>}
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-line px-4 pt-3.5 pb-4">
        {lists.confirmed.length > 0 && people(lists.confirmed)}
        {lists.waitlist.length > 0 && (
          <div>
            <h3 className="kicker mb-1.5">Waitlist</h3>
            {people(lists.waitlist, true)}
          </div>
        )}
        {lists.out.length > 0 && <p className="text-xs text-muted">Can't make it: {lists.out.map(nameOf).join(', ')}</p>}

        {playerId && playersById.has(playerId) ? (
          <div className="space-y-2">
            {waitPlace >= 0 && (
              <Notice tone="warn">
                You're #{waitPlace + 1} on the waitlist. You'll move up automatically if someone drops out.
              </Notice>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant={myStatus === 'in' ? 'good' : 'secondary'} onClick={() => setRsvp(next.id, playerId, myStatus === 'in' ? null : 'in', 0, mine)} aria-pressed={myStatus === 'in'}>
                <Check size={16} /> I'm in
              </Button>
              <Button
                variant="secondary"
                className={cn(myStatus === 'out' && 'border-bad/50 bg-bad-bg text-bad')}
                onClick={() => setRsvp(next.id, playerId, myStatus === 'out' ? null : 'out', 0, mine)}
                aria-pressed={myStatus === 'out'}
              >
                <X size={16} /> Can't make it
              </Button>
            </div>
            {myStatus === 'in' && <GuestStepper value={mine?.guests ?? 0} onChange={(g) => setRsvp(next.id, playerId, 'in', g, mine)} />}
          </div>
        ) : !user ? (
          <Button variant="secondary" size="sm" onClick={() => signIn(usingEmulators ? 'admin@example.com' : undefined)}>
            Sign in to RSVP
          </Button>
        ) : (
          !isAdmin && <p className="text-xs text-muted">To RSVP, open your profile under Players and tap “This is me”.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={invite}>
            <Share2 size={15} /> Share invite
          </Button>
          {isAdmin && (
            <Button size="sm" className="flex-1" onClick={start}>
              <Play size={15} /> {tournament ? 'Set up the teams' : 'Start this session'}
              {lists.confirmed.length ? ` with ${lists.confirmed.length}` : ''}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={dialog === 'edit'} onClose={() => setDialog(null)} title={`Edit the planned ${what}`}>
        {dialog === 'edit' && <PlanForm planned={next} onDone={() => setDialog(null)} />}
      </Dialog>
      <Dialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title={`Cancel this ${what}?`}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Keep it
            </Button>
            {next.repeat === 'weekly' && (
              <Button
                variant="secondary"
                onClick={() => {
                  skipPlannedWeek(next);
                  setDialog(null);
                }}
              >
                Skip this week
              </Button>
            )}
            <Button
              variant="danger"
              onClick={() => {
                cancelPlannedSession(next.id);
                setDialog(null);
              }}
            >
              {next.repeat === 'weekly' ? 'Stop repeating' : `Cancel ${what}`}
            </Button>
          </div>
        }
      >
        <p className="text-sm">
          {next.repeat === 'weekly'
            ? `Skip this week moves it to ${shortDate(addDaysISO(next.date, 7))} and clears everyone's answers. Stop repeating removes it altogether.`
            : `The plan for ${longDate(next.date)} and everyone's answers will be removed.`}
        </p>
      </Dialog>
    </Card>
  );
}

/**
 * What's next: the planned sessions and tournaments (soonest first, the rest smaller underneath), with
 * who's in, a waitlist when there's a limit, RSVPs for linked players and admin controls. With nothing
 * planned, admins can plan one or start right now.
 */
export function NextSessionCard() {
  const { planned } = useData();
  const { isAdmin } = useAuth();
  const [dialog, setDialog] = useState<'plan' | 'start' | null>(null);
  const upcoming = planned.filter((p) => p.date >= todayISO());

  // A weekly plan whose day went by without being started moves on by itself (admins' phones do it).
  useEffect(() => {
    if (isAdmin) rollWeeklyPlans(planned);
  }, [isAdmin, planned]);

  if (!upcoming.length) {
    if (!isAdmin) return null;
    return (
      <Card className="p-4">
        <h2 className="kicker">Next up</h2>
        <p className="mt-1 text-sm text-muted">Plan a session or tournament so players can say if they're in, or start one now.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setDialog('plan')}>
            <CalendarPlus size={16} /> Plan
          </Button>
          <Button onClick={() => setDialog('start')}>
            <Play size={16} /> Start now
          </Button>
        </div>
        <Dialog open={dialog === 'plan'} onClose={() => setDialog(null)} title="Plan what's next">
          {dialog === 'plan' && <PlanForm planned={null} onDone={() => setDialog(null)} />}
        </Dialog>
        <StartDialog open={dialog === 'start'} onClose={() => setDialog(null)} />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <PlannedCard next={upcoming[0]} />
      {upcoming.slice(1).map((p) => (
        <PlannedCard key={p.id} next={p} compact />
      ))}
      {isAdmin && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setDialog('plan')}>
            <CalendarPlus size={15} /> Plan another
          </Button>
        </div>
      )}
      <Dialog open={dialog === 'plan'} onClose={() => setDialog(null)} title="Plan what's next">
        {dialog === 'plan' && <PlanForm planned={null} onDone={() => setDialog(null)} />}
      </Dialog>
    </div>
  );
}
