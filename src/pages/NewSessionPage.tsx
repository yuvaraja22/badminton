import clsx from 'clsx';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Check, Info, Play, UserPlus } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { createPlayer, createSession, markPlannedStarted, updatePlayer } from '../lib/data/mutations';
import { establishedLevel } from '../lib/engine/rating';
import { defaultSessionTitle, oneDecimal, todayISO } from '../lib/format';
import { levelName } from '../lib/levels';
import type { PlannedSession, Player, PlayerId } from '../lib/types';
import { AdminOnly } from '../components/AdminOnly';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, Notice, PageTitle, Spinner } from '../components/ui/Card';
import { Field, Input, LevelStepper, Select } from '../components/ui/Field';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export default function NewSessionPage() {
  const { planned, ready } = useData();
  const { isAdmin } = useAuth();
  const [params] = useSearchParams();
  if (!ready) return <Spinner />;
  if (!isAdmin) return <AdminOnly what="start a session" />;
  // Started from a planned session: pre-fill its date and the players who said they're in.
  const eventId = params.get('event');
  const event = (eventId && planned.find((p) => p.id === eventId)) || null;
  return <NewSessionForm key={event?.id ?? 'new'} event={event} />;
}

function NewSessionForm({ event }: { event: PlannedSession | null }) {
  const { players, config, liveSessions, ratings } = useData();
  const navigate = useNavigate();
  const rsvpIn = event
    ? Object.entries(event.rsvps)
        .filter(([id, r]) => r.status === 'in' && players.some((p) => p.id === id && p.active))
        .sort((a, b) => a[1].at - b[1].at)
        .map(([id]) => id)
    : [];
  const [date, setDate] = useState(event && event.date >= todayISO() ? event.date : todayISO());
  const [title, setTitle] = useState<string | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [order, setOrder] = useState<PlayerId[]>(rsvpIn);
  const [levels, setLevels] = useState<Record<PlayerId, number>>(() =>
    Object.fromEntries(rsvpIn.map((id) => [id, players.find((p) => p.id === id)?.level ?? 3])),
  );
  // Players whose level was changed here: balanced by that level today instead of their skill rating.
  const [overrides, setOverrides] = useState<Set<PlayerId>>(() => new Set());
  const [newName, setNewName] = useState('');
  const [newLevel, setNewLevel] = useState(3);
  const [error, setError] = useState<string | null>(null);

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

  const changeLevel = (id: PlayerId, level: number) => {
    setLevels((l) => ({ ...l, [id]: level }));
    setOverrides((o) => new Set(o).add(id));
  };

  const backToRating = (p: Player) => {
    setLevels((l) => ({ ...l, [p.id]: p.level }));
    setOverrides((o) => {
      const next = new Set(o);
      next.delete(p.id);
      return next;
    });
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
      players: order.map((pid) => ({ id: pid, level: levels[pid] ?? 3, levelOverride: overrides.has(pid) })),
    });
    if (event) markPlannedStarted(event.id, id);
    navigate(`/sessions/${id}`);
  };

  const cycle = n >= 4 ? n / gcd(n, 4) : 0;

  return (
    <div className="space-y-4 pb-24">
      <PageTitle title="New session" subtitle="Tick who's here and check their levels. You can add late arrivals later." />
      {event && (
        <Notice tone="good">
          From the planned session: {rsvpIn.length} {rsvpIn.length === 1 ? 'player said' : 'players said'} they're in and {rsvpIn.length === 1 ? 'is' : 'are'} ticked below. Add or untick anyone who turned up differently.
        </Notice>
      )}
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
          subtitle="Levels run from Amateur Low to Professional High. Players with a skill rating (8+ games) are balanced by it unless you change their level here. Changed levels are remembered for next time."
        />
        <ul className="divide-y divide-line px-2 pt-2 pb-1">
          {active.map((p) => {
            const on = order.includes(p.id);
            const rated = establishedLevel(ratings.get(p.id));
            return (
              <li key={p.id} className="px-2 py-2">
                <div className="flex items-center gap-3">
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
                    <LevelStepper value={levels[p.id] ?? p.level} onChange={(v) => changeLevel(p.id, v)} label={`${p.name}'s level`} />
                  ) : (
                    <span className="text-right text-xs text-muted">{levelName(p.level)}</span>
                  )}
                </div>
                {on && rated !== null && (
                  <p className="mt-1 pl-20 text-xs text-muted">
                    {overrides.has(p.id) ? (
                      <>
                        Balanced by this level today ·{' '}
                        <button type="button" onClick={() => backToRating(p)} className="font-semibold text-primary-text hover:underline">
                          Use rating {oneDecimal(rated)}
                        </button>
                      </>
                    ) : (
                      `Balanced by rating ${oneDecimal(rated)}`
                    )}
                  </p>
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
        <div className="flex items-start gap-2 rounded-2xl bg-info-bg px-3.5 py-2.5 text-sm">
          <Info size={17} className="mt-px shrink-0" />
          <span>
            With {n} players everyone has played the same number of games after every {cycle} matches (
            {[1, 2, 3, 4].map((k) => k * cycle).join(', ')}…).
          </span>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 px-4">
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
