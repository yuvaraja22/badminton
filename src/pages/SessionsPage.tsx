import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { CalendarDays, ChevronRight, Plus, Trophy } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { summarizeHistory } from '../lib/engine/alltime';
import { todayISO } from '../lib/format';
import { Badge, LiveDot } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, Empty, PageTitle, Spinner } from '../components/ui/Card';
import { Select } from '../components/ui/Field';
import { DateStub } from '../components/ui/DateStub';
import { StartDialog } from '../components/play/StartDialog';
import { TournamentRow } from '../components/tournament/TournamentRow';

interface Entry {
  key: string;
  date: string;
  /** 0 = being played now, 1 = coming up, 2 = done. */
  stage: 0 | 1 | 2;
  row: ReactNode;
}

/** Play: sessions and tournaments in one list. Live first, then what's coming up, then the rest newest first. */
export default function SessionsPage() {
  const { sessionHistory, nameOf, liveSessions, players, tournaments, ready } = useData();
  const { isAdmin } = useAuth();
  const [playerId, setPlayerId] = useState('');
  const [starting, setStarting] = useState(false);
  const summaries = useMemo(() => summarizeHistory(sessionHistory, nameOf), [sessionHistory, nameOf]);

  if (!ready) return <Spinner />;

  const entries: Entry[] = [];
  for (const s of liveSessions) {
    if (playerId && !s.attendees[playerId]) continue;
    entries.push({
      key: s.id,
      date: s.date,
      stage: 0,
      row: (
        <Link to={`/sessions/${s.id}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2">
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
      ),
    });
  }
  for (const t of tournaments ?? []) {
    if (playerId && !t.teams.a.players.includes(playerId) && !t.teams.b.players.includes(playerId)) continue;
    const stage = t.status === 'live' ? 0 : t.status === 'upcoming' && t.date >= todayISO() ? 1 : 2;
    entries.push({ key: t.id, date: t.date, stage, row: <TournamentRow t={t} /> });
  }
  for (const s of summaries) {
    if (playerId && !s.playerIds.includes(playerId)) continue;
    entries.push({
      key: s.id,
      date: s.date,
      stage: 2,
      row: (
        <Link to={`/sessions/${s.id}`} className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2">
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
      ),
    });
  }
  // Coming up: soonest first. Everything else: newest first.
  entries.sort((a, b) => a.stage - b.stage || (a.stage === 1 ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  const done = entries.filter((e) => e.stage === 2).length;

  return (
    <div>
      <PageTitle
        title="Play"
        subtitle={`Sessions and tournaments · ${done} played`}
        action={
          isAdmin && (
            <Button onClick={() => setStarting(true)}>
              <Plus size={16} /> New
            </Button>
          )
        }
      />
      <Select value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="mb-4" aria-label="Filter by player">
        <option value="">All players</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            With {p.name}
          </option>
        ))}
      </Select>

      {entries.length === 0 ? (
        <Empty icon={<CalendarDays size={28} />} title={playerId ? 'Nothing with this player yet' : 'Nothing played yet'}>
          {isAdmin && !playerId && 'Tap New to start a session or set up a tournament.'}
        </Empty>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {entries.map((e) => (
            <div key={e.key}>{e.row}</div>
          ))}
        </Card>
      )}
      <StartDialog open={starting} onClose={() => setStarting(false)} />
    </div>
  );
}
