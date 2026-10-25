import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Search, UserPlus, Users } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { allTimeStats } from '../lib/engine/alltime';
import { oneDecimal, pct } from '../lib/format';
import { levelName } from '../lib/levels';
import { PlayerDialog } from '../components/players/PlayerDialog';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Empty, PageTitle, Spinner } from '../components/ui/Card';
import { Input, Toggle } from '../components/ui/Field';
import { Segmented } from '../components/ui/Segmented';

export default function PlayersPage() {
  const { players, history, nameOf, pathOf, ready, ratings } = useData();
  const { isAdmin } = useAuth();
  // In the address, so the order stays when you open a player and come back.
  const [params, setParams] = useSearchParams();
  const sort = params.get('sort') === 'az' ? 'az' : 'rating';
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showGuests, setShowGuests] = useState(false);
  const [adding, setAdding] = useState(false);
  const lines = useMemo(() => new Map(allTimeStats(history, nameOf, { minGames: 0 }).standings.map((l) => [l.playerId, l])), [history, nameOf]);

  if (!ready) return <Spinner />;

  const archived = players.filter((p) => !p.active).length;
  const guests = players.filter((p) => p.guest && p.active).length;
  const shown = players.filter((p) => (showArchived || p.active) && (showGuests || !p.guest || !p.active) && p.name.toLowerCase().includes(q.trim().toLowerCase()));
  // `players` is A–Z. By rating: the number on each card, highest first; players without one last (A–Z among equals).
  const list =
    sort === 'az'
      ? shown
      : [...shown].sort((a, b) => {
          const x = ratings.get(a.id)?.level;
          const y = ratings.get(b.id)?.level;
          return x == null || y == null ? Number(x == null) - Number(y == null) : y - x;
        });

  return (
    <div>
      <PageTitle
        title="Players"
        subtitle={`${players.length - archived - guests} active${guests ? ` · ${guests} guest${guests === 1 ? '' : 's'}` : ''}${archived ? ` · ${archived} archived` : ''}`}
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
        <Segmented
          value={sort}
          onChange={(s) => setParams(s === 'az' ? { sort: 'az' } : {}, { replace: true })}
          options={[
            { value: 'rating', label: 'By rating' },
            { value: 'az', label: 'A–Z' },
          ]}
          label="Sort players"
          className="shrink-0"
        />
        {guests > 0 && <Toggle checked={showGuests} onChange={setShowGuests} label="Show guests" />}
        {archived > 0 && <Toggle checked={showArchived} onChange={setShowArchived} label="Show archived" />}
      </div>

      {!players.length ? (
        <Empty icon={<Users size={28} />} title="No players yet">
          {isAdmin ? 'Add your regulars here, or create them while starting a session.' : 'Players appear once an admin adds them.'}
        </Empty>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((p) => {
              const l = lines.get(p.id);
              const r = ratings.get(p.id);
              return (
                <li key={p.id}>
                  <Link
                    to={pathOf(p.id)}
                    className="group relative flex h-full flex-col items-center overflow-hidden rounded-[1.4rem] border border-line bg-surface px-3 pt-4 pb-3.5 text-center shadow-[var(--shadow-card)] transition hover:-translate-y-0.5"
                  >
                    <span aria-hidden className="court-mat absolute inset-x-0 top-0 h-13" />
                    {r && (
                      <span className="font-score absolute top-1.5 right-3 text-lg leading-none font-black text-court-ink" title="Skill rating">
                        {oneDecimal(r.level)}
                      </span>
                    )}
                    <Avatar name={p.name} photo={p.photo} size={60} className="relative ring-4" />
                    <span className="mt-2 w-full truncate font-bold tracking-tight">{p.name}</span>
                    <span className="text-xs text-muted">{levelName(p.level)}</span>
                    {l ? (
                      <>
                        <span className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(3, l.winRate * 100)}%` }} />
                        </span>
                        <span className="tabular mt-1 text-xs text-muted">
                          {l.won}-{l.lost} · {pct(l.winRate, 0)} wins
                        </span>
                      </>
                    ) : (
                      <span className="mt-2.5 text-xs text-muted">No matches yet</span>
                    )}
                    {!p.active && <Badge className="mt-1.5">Archived</Badge>}
                    {p.active && p.guest && <Badge className="mt-1.5">Guest</Badge>}
                  </Link>
                </li>
              );
            })}
          </ul>
          {!list.length && <p className="px-4 py-6 text-center text-sm text-muted">No players match “{q}”.</p>}
        </>
      )}
      <PlayerDialog open={adding} onClose={() => setAdding(false)} player={null} />
    </div>
  );
}
