import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarPlus, Check, MoreVertical, Pencil, Play, Trash2, X } from 'lucide-react';
import { useAuth, useData } from '../../lib/data/context';
import { cancelPlannedSession, planSession, setRsvp, updatePlannedSession } from '../../lib/data/mutations';
import { dayDate, formatTime, longDate, nextWeekendISO, todayISO } from '../../lib/format';
import { usingEmulators } from '../../lib/firebase';
import { cn } from '../../lib/cn';
import type { PlannedSession } from '../../lib/types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card, Notice } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Field, Input } from '../ui/Field';
import { Menu } from '../ui/Menu';

function PlanForm({ planned, onDone }: { planned: PlannedSession | null; onDone: () => void }) {
  const [date, setDate] = useState(planned?.date ?? nextWeekendISO());
  const [time, setTime] = useState(planned?.time ?? '');
  const [note, setNote] = useState(planned?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (!date) return setError('Pick a date.');
    if (date < todayISO()) return setError('Pick today or a future date.');
    const input = { date, time: time || null, note: note.trim() || null };
    if (planned) updatePlannedSession(planned.id, input);
    else planSession(input);
    onDone();
  };
  return (
    <div className="space-y-4">
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
        {planned ? 'Save' : 'Plan session'}
      </Button>
    </div>
  );
}

/**
 * The next planned session: who's in, an RSVP for linked players, and admin controls
 * (plan, edit, cancel, start). Admins see a "Plan" prompt when nothing is planned.
 */
export function NextSessionCard() {
  const { planned, nameOf, playersById } = useData();
  const { isAdmin, playerId, user, signIn } = useAuth();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'plan' | 'edit' | 'cancel' | null>(null);
  const next = planned.find((p) => p.date >= todayISO()) ?? null;

  if (!next) {
    if (!isAdmin) return null;
    return (
      <Card className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <h2 className="font-bold">Next session</h2>
          <p className="text-sm text-muted">Plan it so players can say whether they're coming.</p>
        </div>
        <Button variant="secondary" onClick={() => setDialog('plan')}>
          <CalendarPlus size={16} /> Plan
        </Button>
        <Dialog open={dialog === 'plan'} onClose={() => setDialog(null)} title="Plan the next session">
          {dialog === 'plan' && <PlanForm planned={null} onDone={() => setDialog(null)} />}
        </Dialog>
      </Card>
    );
  }

  const entries = Object.entries(next.rsvps).filter(([id]) => playersById.has(id));
  const ins = entries.filter(([, r]) => r.status === 'in').sort((a, b) => a[1].at - b[1].at).map(([id]) => id);
  const outs = entries.filter(([, r]) => r.status === 'out').map(([id]) => id);
  const mine = playerId ? (next.rsvps[playerId]?.status ?? null) : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">Next session</h2>
          <p className="mt-1 text-lg font-bold">{dayDate(next.date)}</p>
          {(next.time || next.note) && (
            <p className="text-sm text-muted">{[next.time && formatTime(next.time), next.note].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        {isAdmin && (
          <Menu
            trigger={<MoreVertical size={20} />}
            items={[
              { label: 'Edit', icon: <Pencil size={16} />, onClick: () => setDialog('edit') },
              { label: 'Cancel session', icon: <Trash2 size={16} />, danger: true, onClick: () => setDialog('cancel') },
            ]}
          />
        )}
      </div>

      <div className="space-y-3 px-4 pt-3 pb-4">
        <p className="text-sm">
          <span className="font-semibold text-good">{ins.length} in</span>
          {outs.length > 0 && <span className="text-muted"> · {outs.length} can't make it</span>}
        </p>
        {ins.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {ins.map((id) => (
              <li key={id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pr-2.5 pl-0.5 text-sm">
                <Avatar name={nameOf(id)} photo={playersById.get(id)?.photo} size={24} />
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
          <Button block onClick={() => navigate(`/sessions/new?event=${next.id}`)}>
            <Play size={16} /> Start this session{ins.length ? ` with ${ins.length} players` : ''}
          </Button>
        )}
      </div>

      <Dialog open={dialog === 'edit'} onClose={() => setDialog(null)} title="Edit the planned session">
        {dialog === 'edit' && <PlanForm planned={next} onDone={() => setDialog(null)} />}
      </Dialog>
      <Dialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        title="Cancel this session?"
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
              Cancel session
            </Button>
          </div>
        }
      >
        <p className="text-sm">The plan for {longDate(next.date)} and everyone's answers will be removed.</p>
      </Dialog>
    </Card>
  );
}
