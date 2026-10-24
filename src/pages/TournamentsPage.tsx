import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronRight, Plus, Swords } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { createTournament } from '../lib/data/mutations';
import { teamScore } from '../lib/engine/tournament';
import { nextWeekendISO } from '../lib/format';
import { teamName } from '../lib/teamColors';
import type { Tournament } from '../lib/types';
import { SessionsSwitch } from '../components/layout/SessionsSwitch';
import { TeamDot, TournamentStatusBadge } from '../components/tournament/TeamBits';
import { Button } from '../components/ui/Button';
import { Card, Empty, PageTitle, Spinner } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input } from '../components/ui/Field';
import { DateStub } from '../components/ui/DateStub';

function TournamentRow({ t }: { t: Tournament }) {
  const score = teamScore(t);
  const count = Object.keys(t.matches).length;
  return (
    <Link to={`/tournaments/${t.id}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2">
      <DateStub date={t.date} tone={t.status === 'completed' ? 'paper' : 'chip'} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-bold tracking-tight">{t.name}</span>
          <TournamentStatusBadge t={t} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <TeamDot t={t} team="a" />
            {teamName(t, 'a')}
            {score.played > 0 && (
              <strong className="font-score tabular text-base text-ink">
                {score.won.a}–{score.won.b}
              </strong>
            )}
            {score.played === 0 && 'vs'}
            {teamName(t, 'b')}
            <TeamDot t={t} team="b" />
          </span>
          <span aria-hidden>·</span>
          <span>
            {count} match{count === 1 ? '' : 'es'}
          </span>
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-muted" />
    </Link>
  );
}

function NewTournamentForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [name, setName] = useState('Team Tournament');
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

export default function TournamentsPage() {
  const { tournaments } = useData();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <SessionsSwitch current="tournaments" />
      <PageTitle
        title="Tournaments"
        subtitle="Team against team: doubles and singles, scored live."
        action={
          isAdmin && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} /> New
            </Button>
          )
        }
      />
      {tournaments === null ? (
        <Spinner />
      ) : tournaments.length === 0 ? (
        <Empty icon={<Swords size={28} />} title="No tournaments yet">
          {isAdmin ? 'Tap New to set one up: two teams, their players, then the matches.' : 'They appear here once an admin sets one up.'}
        </Empty>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {tournaments.map((t) => (
            <TournamentRow key={t.id} t={t} />
          ))}
        </Card>
      )}
      <Dialog open={creating} onClose={() => setCreating(false)} title="New tournament">
        {creating && <NewTournamentForm onCreated={(id) => navigate(`/tournaments/${id}?tab=teams`)} />}
      </Dialog>
    </div>
  );
}
