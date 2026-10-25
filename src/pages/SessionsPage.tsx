import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, ChevronRight, Plus, Trophy } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { summarizeHistory } from '../lib/engine/alltime';
import { Badge, LiveDot } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, Empty, PageTitle, Spinner } from '../components/ui/Card';
import { SessionsSwitch } from '../components/layout/SessionsSwitch';
import { Select } from '../components/ui/Field';
import { DateStub } from '../components/ui/DateStub';

export default function SessionsPage() {
  const { sessionHistory, nameOf, liveSessions, players, ready } = useData();
  const { isAdmin } = useAuth();
  const [playerId, setPlayerId] = useState('');
  const summaries = useMemo(() => summarizeHistory(sessionHistory, nameOf), [sessionHistory, nameOf]);

  if (!ready) return <Spinner />;

  const live = liveSessions.filter((s) => !playerId || s.attendees[playerId]);
  const done = summaries.filter((s) => !playerId || s.playerIds.includes(playerId));

  return (
    <div>
      <SessionsSwitch current="sessions" />
      <PageTitle
        title="Sessions"
        subtitle={`${summaries.length} completed`}
        action={
          isAdmin && (
            <Link to="/sessions/new">
              <Button>
                <Plus size={16} /> New
              </Button>
            </Link>
          )
        }
      />
      <Select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="mb-4" aria-label="Filter by player">
        <option value="">All players</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            Sessions with {p.name}
          </option>
        ))}
      </Select>

      {!live.length && !done.length && <Empty icon={<CalendarDays size={28} />} title="No sessions yet" />}

      <Card className="divide-y divide-line overflow-hidden">
        {live.map((s) => (
          <Link key={s.id} to={`/sessions/${s.id}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2">
            <DateStub date={s.date} tone="chip" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-bold tracking-tight">{s.title}</span>
                <Badge tone="live">
                  <LiveDot /> Live
                </Badge>
              </div>
              <div className="text-sm text-muted">{Object.keys(s.matches).length} matches so far</div>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        ))}
        {done.map((s) => (
          <Link key={s.id} to={`/sessions/${s.id}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2">
            <DateStub date={s.date} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold tracking-tight">{s.title}</div>
              <div className="text-sm text-muted">
                {s.matchCount} matches · {s.playerIds.length} players
              </div>
              {s.mvpId && (
                <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold">
                  <span className="inline-flex size-4.5 items-center justify-center rounded-full bg-volt text-volt-ink">
                    <Trophy size={10} strokeWidth={2.75} aria-hidden />
                  </span>
                  MVP {nameOf(s.mvpId)}
                </span>
              )}
            </div>
            <ChevronRight size={18} className="shrink-0 text-muted" />
          </Link>
        ))}
      </Card>
    </div>
  );
}
