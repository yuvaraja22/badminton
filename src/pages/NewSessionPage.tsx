import clsx from 'clsx';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Info, Play, UserPlus } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { createPlayer, createSession, updatePlayer } from '../lib/data/mutations';
import { defaultSessionTitle, todayISO } from '../lib/format';
import { levelName } from '../lib/levels';
import type { PlayerId } from '../lib/types';
import { AdminOnly } from '../components/AdminOnly';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, Notice, PageTitle, Spinner } from '../components/ui/Card';
import { Field, Input, LevelStepper, Select } from '../components/ui/Field';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export default function NewSessionPage() {
  const { players, config, ready, liveSessions } = useData();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState<string | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [order, setOrder] = useState<PlayerId[]>([]);
  const [levels, setLevels] = useState<Record<PlayerId, number>>({});
  const [newName, setNewName] = useState('');
  const [newLevel, setNewLevel] = useState(3);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <Spinner />;
  if (!isAdmin) return <AdminOnly what="start a session" />;

  const effectiveTitle = title ?? defaultSessionTitle(date, config.groupName);
  const pointsToWin = points ?? config.pointsToWin;
  const active = players.filter((p) => p.active);
  const n = order.length;

  const toggle = (id: PlayerId, level: number) => {
    if (order.includes(id)) {
      setOrder(order.filter((x) => x !== id));
    } else {
      setOrder([...order, id]);
      setLevels((l) => ({ ...l, [id]: l[id] ?? level }));
    }
  };

  const addNew = () => {
    const name = newName.trim();
    if (!name) return;
    if (players.some((p) => p.name.trim().toLowerCase() === name.toLowerCase())) {
      setError(`${name} already exists. Tick them in the list instead.`);
      return;
    }
    const id = createPlayer({ name, level: newLevel });
    setOrder((o) => [...o, id]);
    setLevels((l) => ({ ...l, [id]: newLevel }));
    setNewName('');
    setError(null);
  };

  const start = () => {
    // Levels chosen here become each player's default for next time.
    for (const pid of order) {
      const p = players.find((x) => x.id === pid);
      if (p && levels[pid] !== undefined && levels[pid] !== p.level) updatePlayer(pid, { level: levels[pid] });
    }
    const id = createSession({
      date,
      title: effectiveTitle,
      pointsToWin,
      players: order.map((pid) => ({ id: pid, level: levels[pid] ?? 3 })),
    });
    navigate(`/sessions/${id}`);
  };

  const cycle = n >= 4 ? n / gcd(n, 4) : 0;

  return (
    <div className="space-y-4 pb-24">
      <PageTitle title="New session" subtitle="Tick who's here and check their levels. You can add late arrivals later." />
      {liveSessions.length > 0 && <Notice tone="warn">“{liveSessions[0].title}” is still live. You can run two sessions, but you may want to end that one first.</Notice>}

      <Card className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Game to">
            <Select value={pointsToWin} onChange={(e) => setPoints(Number(e.target.value))}>
              {[11, 15, 21].map((p) => (
                <option key={p} value={p}>
                  {p} points
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Title" hint="Shown at the top of the report.">
          <Input value={effectiveTitle} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      </Card>

      <Card>
        <CardHeader
          title={`Who's playing · ${n} selected`}
          subtitle="Levels run from Amateur Low to Professional High and balance the teams. They're remembered for next time."
        />
        <ul className="divide-y divide-line px-2 pt-2 pb-1">
          {active.map((p) => {
            const on = order.includes(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 px-2 py-2">
                <button
                  type="button"
                  onClick={() => toggle(p.id, p.level)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-pressed={on}
                  aria-label={`${p.name}${on ? ', playing' : ''}`}
                >
                  <span
                    className={clsx(
                      'inline-flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition',
                      on ? 'border-primary bg-primary text-primary-ink' : 'border-line',
                    )}
                  >
                    {on && <Check size={15} strokeWidth={3} />}
                  </span>
                  <Avatar name={p.name} photo={p.photo} size={32} />
                  <span className="truncate font-semibold">{p.name}</span>
                </button>
                {on ? (
                  <LevelStepper value={levels[p.id] ?? p.level} onChange={(v) => setLevels((l) => ({ ...l, [p.id]: v }))} label={`${p.name}'s level`} />
                ) : (
                  <span className="text-right text-xs text-muted">{levelName(p.level)}</span>
                )}
              </li>
            );
          })}
          {!active.length && <li className="px-2 py-4 text-sm text-muted">No players yet. Add them below.</li>}
        </ul>
        <div className="border-t border-line p-4">
          <div className="mb-1.5 text-sm font-medium">Add a new player</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNew()}
              placeholder="Name"
              className="min-w-40 flex-1"
            />
            <LevelStepper value={newLevel} onChange={setNewLevel} />
            <Button variant="secondary" onClick={addNew} disabled={!newName.trim()}>
              <UserPlus size={16} /> Add
            </Button>
          </div>
          {error && <Notice tone="bad" className="mt-2">{error}</Notice>}
        </div>
      </Card>

      {n >= 4 && (
        <div className="flex items-start gap-2 rounded-xl bg-info-bg px-3 py-2.5 text-sm">
          <Info size={17} className="mt-px shrink-0" />
          <span>
            With {n} players everyone has played the same number of games after every {cycle} matches (
            {[1, 2, 3, 4].map((k) => k * cycle).join(', ')}…).
          </span>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4">
        <div className="mx-auto max-w-3xl">
          <Button
            size="lg"
            block
            onClick={start}
            disabled={n < 4 || !date || !effectiveTitle.trim()}
            className="shadow-lg disabled:border disabled:border-line disabled:bg-surface-2 disabled:text-muted disabled:opacity-100"
          >
            <Play size={18} /> {n < 4 ? `Select at least 4 players (${n})` : `Start session with ${n} players`}
          </Button>
        </div>
      </div>
    </div>
  );
}
