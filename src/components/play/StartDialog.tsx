import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { CalendarDays, ChevronRight, Swords } from 'lucide-react';
import { createTournament } from '../../lib/data/mutations';
import { DEFAULT_TOURNAMENT_NAME } from '../../lib/engine/tournament';
import { nextWeekendISO } from '../../lib/format';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field, Input } from '../ui/Field';

function NewTournamentForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState(DEFAULT_TOURNAMENT_NAME);
  const [date, setDate] = useState(nextWeekendISO());
  return (
    <div className="space-y-4">
      <Field label="Name">
        <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Date">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <p className="text-sm text-muted">Next you'll pick the two teams and their players, then add the matches.</p>
      <Button block disabled={!name.trim() || !date} onClick={() => onCreated(createTournament({ name, date }))}>
        Create tournament
      </Button>
    </div>
  );
}

function Choice({ icon, title, text, onClick }: { icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3.5 rounded-2xl border border-line p-4 text-left transition hover:bg-surface-2">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-chip text-chip-ink">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold tracking-tight">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </button>
  );
}

/** Start something now: a session (the app plans fair matches) or a team tournament (your own schedule). */
export function StartDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<'choose' | 'tournament'>('choose');
  const close = () => {
    setStep('choose');
    onClose();
  };
  return (
    <Dialog open={open} onClose={close} title={step === 'tournament' ? 'New tournament' : 'Start'}>
      {open && step === 'choose' && (
        <div className="space-y-2.5">
          <Choice
            icon={<CalendarDays size={20} />}
            title="Session"
            text="Pick who's here; the app plans fair matches."
            onClick={() => {
              close();
              navigate('/sessions/new');
            }}
          />
          <Choice icon={<Swords size={20} />} title="Tournament" text="Two teams, your own schedule, live scoring." onClick={() => setStep('tournament')} />
        </div>
      )}
      {open && step === 'tournament' && (
        <NewTournamentForm
          onCreated={(id) => {
            close();
            navigate(`/tournaments/${id}?tab=teams`);
          }}
        />
      )}
    </Dialog>
  );
}
