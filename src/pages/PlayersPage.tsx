import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Search, UserPlus, Users } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { allTimeStats } from '../lib/engine/alltime';
import { pct } from '../lib/format';
import { levelName } from '../lib/levels';
import { PlayerDialog } from '../components/players/PlayerDialog';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, Empty, PageTitle, Spinner } from '../components/ui/Card';
import { Input, Toggle } from '../components/ui/Field';

export default function PlayersPage() {
  const { players, history, nameOf, ready } = useData();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const lines = useMemo(() => new Map(allTimeStats(history, nameOf, { minGames: 0 }).standings.map((l) => [l.playerId, l])), [history, nameOf]);

  if (!ready) return <Spinner />;

  const archived = players.filter((p) => !p.active).length;
  const list = players.filter((p) => (showArchived || p.active) && p.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div>
      <PageTitle
        title="Players"
        subtitle={`${players.length - archived} active${archived ? ` · ${archived} archived` : ''}`}
        action={
          isAdmin && (
            <Button onClick={() => setAdding(true)}>
              <UserPlus size={16} /> Add
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players" className="pl-9" aria-label="Search players" />
        </div>
        {archived > 0 && <Toggle checked={showArchived} onChange={setShowArchived} label="Show archived" />}
      </div>

      {!players.length ? (
        <Empty icon={<Users size={28} />} title="No players yet">
          {isAdmin ? 'Add your regulars here, or create them while starting a session.' : 'Players appear once an admin adds them.'}
        </Empty>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {list.map((p) => {
            const l = lines.get(p.id);
            return (
              <Link key={p.id} to={`/players/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <Avatar name={p.name} photo={p.photo} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{p.name}</span>
                    {!p.active && <Badge>Archived</Badge>}
                  </div>
                  <div className="tabular text-sm text-muted">
                    {levelName(p.level)}
                    {l ? ` · ${l.won}-${l.lost} · ${pct(l.winRate)}` : ' · no matches yet'}
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-muted" />
              </Link>
            );
          })}
          {!list.length && <p className="px-4 py-6 text-center text-sm text-muted">No players match “{q}”.</p>}
        </Card>
      )}
      <PlayerDialog open={adding} onClose={() => setAdding(false)} player={null} />
    </div>
  );
}
