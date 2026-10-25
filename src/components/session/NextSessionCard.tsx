import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarPlus, Check, MoreVertical, Pencil, Play, Trash2, X } from 'lucide-react';
import { useAuth, useData } from '../../lib/data/context';
import { cancelPlannedSession, createTournament, markPlannedStarted, planSession, setRsvp, updatePlannedSession } from '../../lib/data/mutations';
import { dateParts, dayDate, formatTime, longDate, nextWeekendISO, todayISO } from '../../lib/format';
import { usingEmulators } from '../../lib/firebase';
import { cn } from '../../lib/cn';
import type { PlannedSession } from '../../lib/types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card, Notice } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Field, Input } from '../ui/Field';
import { Menu } from '../ui/Menu';
import { Segmented } from '../ui/Segmented';
import { DEFAULT_TOURNAMENT_NAME } from '../../lib/engine/tournament';
import { StartDialog } from '../play/StartDialog';

function PlanForm({ planned, onDone }: { planned: PlannedSession | null; onDone: () => void }) {
  const [kind, setKind] = useState<PlannedSession['kind']>(planned?.kind ?? 'session');
  const [name, setName] = useState(planned?.name ?? DEFAULT_TOURNAMENT_NAME);
  const [date, setDate] = useState(planned?.date ?? nextWeekendISO());
  const [time, setTime] = useState(planned?.time ?? '');
  const [note, setNote] = useState(planned?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (!date) return setError('Pick a date.');
    if (date < todayISO()) return setError('Pick today or a future date.');
    if (kind === 'tournament' && !name.trim()) return setError('Give the tournament a name.');
    const input = { kind, name: kind === 'tournament' ? name.trim() : null, date, time: time || null, note: note.trim() || null };
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
      {error && <Notice tone="bad">{error}</Notice>}
      <Button block onClick={save}>
        {planned ? 'Save' : `Plan ${kind}`}
      </Button>
    </div>
  );
}

/**
 * What's next: the planned session or tournament with who's in, an RSVP for linked players, and admin
 * controls (plan, edit, cancel, start). With nothing planned, admins can plan one or start right now.
 */
export function NextSessionCard() {
  const { planned, nameOf, playersById } = useData();
  const { isAdmin, playerId, user, signIn } = useAuth();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'plan' | 'start' | 'edit' | 'cancel' | null>(null);
  const next = planned.find((p) => p.date >= todayISO()) ?? null;

  if (!next) {
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

  const entries = Object.entries(next.rsvps).filter(([id]) => playersById.has(id));
  const ins = entries.filter(([, r]) => r.status === 'in').sort((a, b) => a[1].at - b[1].at).map(([id]) => id);
  const outs = entries.filter(([, r]) => r.status === 'out').map(([id]) => id);
  const mine = playerId ? (next.rsvps[playerId]?.status ?? null) : null;
  const tournament = next.kind === 'tournament';
  const what = tournament ? 'tournament' : 'session';

  const start = () => {
    if (!tournament) return navigate(`/sessions/new?event=${next.id}`);
    // The tournament takes over the plan; everyone who said they're in is listed first when picking teams.
    const id = createTournament({ name: next.name ?? DEFAULT_TOURNAMENT_NAME, date: next.date, invited: ins });
    markPlannedStarted(next.id, id);
    navigate(`/tournaments/${id}?tab=teams`);
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-stretch">
        {/* Ticket stub: the date, with notches cut where it tears off. */}
        <div className="relative flex w-24 shrink-0 flex-col items-center justify-center bg-chip py-4 text-chip-ink">
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase opacity-75">{dateParts(next.date).weekday}</span>
          <span className="font-score text-[3.2rem] leading-[0.95] font-black">{dateParts(next.date).day}</span>
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase opacity-75">{dateParts(next.date).month}</span>
          <span aria-hidden className="absolute -top-2.5 -right-2.5 size-5 rounded-full bg-bg" />
          <span aria-hidden className="absolute -right-2.5 -bottom-2.5 size-5 rounded-full bg-bg" />
        </div>
        <div className="min-w-0 flex-1 border-l-2 border-dashed border-line px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="kicker">Next {what}</h2>
            {isAdmin && (
              <div className="-mt-2 -mr-2">
                <Menu
                  trigger={<MoreVertical size={20} />}
                  items={[
                    { label: 'Edit', icon: <Pencil size={16} />, onClick: () => setDialog('edit') },
                    { label: `Cancel ${what}`, icon: <Trash2 size={16} />, danger: true, onClick: () => setDialog('cancel') },
                  ]}
                />
              </div>
            )}
          </div>
          <p className="mt-1 text-lg leading-tight font-bold tracking-tight">{tournament ? next.name : dayDate(next.date)}</p>
          {(tournament || next.time || next.note) && (
            <p className="mt-0.5 text-sm text-muted">
              {[tournament && dayDate(next.date), next.time && formatTime(next.time), next.note].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="mt-2 flex items-baseline gap-2 text-sm">
            <span className="font-score text-2xl leading-none font-black text-good">{ins.length}</span>
            <span className="font-semibold text-good">in</span>
            {outs.length > 0 && <span className="text-muted">· {outs.length} can't make it</span>}
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-line px-4 pt-3.5 pb-4">
        {ins.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {ins.map((id) => (
              <li key={id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/70 py-0.5 pr-3 pl-0.5 text-sm font-semibold">
                <Avatar name={nameOf(id)} photo={playersById.get(id)?.photo} size={26} />
                {nameOf(id)}
              </li>
            ))}
          </ul>
        )}
        {outs.length > 0 && <p className="text-xs text-muted">Can't make it: {outs.map(nameOf).join(', ')}</p>}

        {playerId && playersById.has(playerId) ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={mine === 'in' ? 'good' : 'secondary'}
              onClick={() => setRsvp(next.id, playerId, mine === 'in' ? null : 'in')}
              aria-pressed={mine === 'in'}
            >
              <Check size={16} /> I'm in
            </Button>
            <Button
              variant="secondary"
              className={cn(mine === 'out' && 'border-bad/50 bg-bad-bg text-bad')}
              onClick={() => setRsvp(next.id, playerId, mine === 'out' ? null : 'out')}
              aria-pressed={mine === 'out'}
            >
              <X size={16} /> Can't make it
            </Button>
          </div>
        ) : !user ? (
          <Button variant="secondary" size="sm" onClick={() => signIn(usingEmulators ? 'admin@example.com' : undefined)}>
            Sign in to RSVP
          </Button>
        ) : (
          !isAdmin && <p className="text-xs text-muted">To RSVP, ask an admin to link {user.email} to your player profile.</p>
        )}

        {isAdmin && (
          <Button block onClick={start}>
            <Play size={16} /> {tournament ? 'Set up the teams' : 'Start this session'}
            {ins.length ? ` with ${ins.length} players` : ''}
          </Button>
        )}
      </div>

      <Dialog open={dialog === 'edit'} onClose={() => setDialog(null)} title={`Edit the planned ${what}`}>
        {dialog === 'edit' && <PlanForm planned={next} onDone={() => setDialog(null)} />}
      </Dialog>
      <Dialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title={`Cancel this ${what}?`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                cancelPlannedSession(next.id);
                setDialog(null);
              }}
            >
              Cancel {what}
            </Button>
          </div>
        }
      >
        <p className="text-sm">The plan for {longDate(next.date)} and everyone's answers will be removed.</p>
      </Dialog>
    </Card>
  );
}
