import clsx from 'clsx';
import { useState } from 'react';
import { addAttendee, createPlayer, setAttendeeLevel, setAttendeeStatus, type JoinMode } from '../../lib/data/mutations';
import { useData } from '../../lib/data/context';
import { sortedMatches } from '../../lib/engine/games';
import { establishedLevel } from '../../lib/engine/rating';
import { oneDecimal } from '../../lib/format';
import type { AttendeeStatus, PlayerId, Session } from '../../lib/types';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Field, Input, LevelStepper, Select } from '../ui/Field';
import { Segmented } from '../ui/Segmented';

function JoinModeChoice({ value, onChange, missedLabel }: { value: JoinMode; onChange: (m: JoinMode) => void; missedLabel: string }) {
  const option = (mode: JoinMode, title: string, body: string) => (
    <button
      type="button"
      onClick={() => onChange(mode)}
      aria-pressed={value === mode}
      className={clsx(
        'w-full rounded-2xl border p-3 text-left transition',
        value === mode ? 'border-primary bg-info-bg ring-2 ring-primary/20' : 'border-line hover:bg-surface-2',
      )}
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-0.5 text-sm text-muted">{body}</div>
    </button>
  );
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">How should the next matches treat them? ({missedLabel})</p>
      {option('fair', 'Join fairly', 'An equal share of games from now on, no extra games to make up for the missed ones.')}
      {option('catchUp', 'Catch up', 'Priority until their game count is level with everyone else. They may play several in a row.')}
    </div>
  );
}

const lastNumber = (s: Session) => sortedMatches(s).at(-1)?.number ?? 0;

/** Change a session player's level or status (rest / left / back). */
export function AttendeeDialog({ session, playerId, onClose }: { session: Session; playerId: PlayerId | null; onClose: () => void }) {
  const { nameOf } = useData();
  return (
    <Dialog open={playerId !== null} onClose={onClose} title={playerId ? nameOf(playerId) : ''}>
      {playerId && session.attendees[playerId] && <AttendeeForm key={playerId} session={session} playerId={playerId} onDone={onClose} />}
    </Dialog>
  );
}

function AttendeeForm({ session, playerId, onDone }: { session: Session; playerId: PlayerId; onDone: () => void }) {
  const { ratings } = useData();
  const a = session.attendees[playerId];
  const rated = establishedLevel(ratings.get(playerId));
  const [level, setLevel] = useState(a.level);
  // Rated players: balance by their rating, or by a level set for this session.
  const [byLevel, setByLevel] = useState(a.levelOverride === true);
  const [status, setStatus] = useState<AttendeeStatus>(a.status);
  const [mode, setMode] = useState<JoinMode>('fair');
  const last = lastNumber(session);
  const returning = a.status !== 'available' && status === 'available';
  const missed = last - a.since;

  const save = () => {
    const override = rated === null ? a.levelOverride === true || level !== a.level : byLevel;
    if (level !== a.level || override !== (a.levelOverride === true)) setAttendeeLevel(session, playerId, level, override);
    if (status !== a.status) setAttendeeStatus(session, playerId, status, mode);
    onDone();
  };

  return (
    <div className="space-y-4">
      {rated === null ? (
        <Field label="Level for this session" hint="Used to balance teams. The player's profile level is not changed.">
          <LevelStepper value={level} onChange={setLevel} />
        </Field>
      ) : (
        <div>
          <span className="mb-1.5 block text-sm font-medium">Balance teams by</span>
          <Segmented
            value={byLevel ? 'level' : 'rating'}
            onChange={(v) => setByLevel(v === 'level')}
            options={[
              { value: 'rating', label: `Rating ${oneDecimal(rated)}` },
              { value: 'level', label: 'Level for today' },
            ]}
          />
          {byLevel && (
            <div className="mt-2">
              <LevelStepper value={level} onChange={setLevel} />
            </div>
          )}
          <p className="mt-1.5 text-xs text-muted">
            {byLevel ? 'Used for the rest of this session. The profile level is not changed.' : 'Their skill rating from past games.'}
          </p>
        </div>
      )}
      <div>
        <span className="mb-1.5 block text-sm font-medium">Status</span>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'available', label: 'Playing' },
            { value: 'resting', label: 'Resting' },
            { value: 'left', label: 'Left' },
          ]}
        />
        <p className="mt-1.5 text-xs text-muted">Resting or left players are skipped by “Next match”. Their results so far still count.</p>
      </div>
      {returning && missed > 0 && (
        <JoinModeChoice value={mode} onChange={setMode} missedLabel={`away for ${missed} match${missed === 1 ? '' : 'es'}`} />
      )}
      <Button block onClick={save}>
        Save
      </Button>
    </div>
  );
}

/** Add a late arrival: an existing player or a brand-new profile. */
export function AddPlayerDialog({ session, open, onClose }: { session: Session; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Add a player to this session">
      {open && <AddPlayerForm session={session} onDone={onClose} />}
    </Dialog>
  );
}

function AddPlayerForm({ session, onDone }: { session: Session; onDone: () => void }) {
  const { players, ratings } = useData();
  const candidates = players.filter((p) => p.active && !session.attendees[p.id]);
  const [choice, setChoice] = useState<string>(candidates[0]?.id ?? 'new');
  const [name, setName] = useState('');
  const [level, setLevel] = useState(candidates[0]?.level ?? 3);
  // A level changed here is used for this session instead of the player's rating.
  const [levelChanged, setLevelChanged] = useState(false);
  const rated = choice === 'new' ? null : establishedLevel(ratings.get(choice));
  const [mode, setMode] = useState<JoinMode>('fair');
  const [error, setError] = useState<string | null>(null);
  const last = lastNumber(session);

  const pick = (id: string) => {
    setChoice(id);
    const p = players.find((x) => x.id === id);
    if (p) setLevel(p.level);
    setLevelChanged(false);
  };

  const add = () => {
    let id = choice;
    if (choice === 'new') {
      const trimmed = name.trim();
      if (!trimmed) return setError('Enter a name.');
      if (players.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase())) return setError('A player with that name already exists. Pick them from the list.');
      id = createPlayer({ name: trimmed, level });
    }
    addAttendee(session, id, level, mode, levelChanged);
    onDone();
  };

  return (
    <div className="space-y-4">
      <Field label="Player">
        <Select value={choice} onChange={(e) => pick(e.target.value)}>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="new">+ New player…</option>
        </Select>
      </Field>
      {choice === 'new' && (
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hardesh" autoFocus />
        </Field>
      )}
      <Field
        label="Level"
        hint={rated !== null && (levelChanged ? 'Balanced by this level today.' : `Balanced by their rating (${oneDecimal(rated)}) unless you change the level.`)}
      >
        <LevelStepper
          value={level}
          onChange={(v) => {
            setLevel(v);
            setLevelChanged(true);
          }}
        />
      </Field>
      {last > 0 && <JoinModeChoice value={mode} onChange={setMode} missedLabel={`${last} match${last === 1 ? '' : 'es'} already played`} />}
      {error && <Notice tone="bad">{error}</Notice>}
      <Button block onClick={add}>
        Add to session
      </Button>
    </div>
  );
}
