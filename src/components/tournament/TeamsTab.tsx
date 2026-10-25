import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check, Pencil, UserPlus } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useData } from '../../lib/data/context';
import { createPlayer, saveTeams } from '../../lib/data/mutations';
import { playerTeam, tournamentMatches } from '../../lib/engine/tournament';
import { matchCode } from '../../lib/format';
import { TEAM_COLOR_KEYS, TEAM_COLORS, confusablePair, teamFill, teamName } from '../../lib/teamColors';
import { toast } from '../../lib/toast';
import type { PlayerId, TeamColor, TeamKey, Tournament, TournamentTeam } from '../../lib/types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card, CardHeader, Notice } from '../ui/Card';
import { Field, Input } from '../ui/Field';
import { TeamDot } from './TeamBits';

type Spot = TeamKey | 'both' | 'out';
type Draft = Record<TeamKey, TournamentTeam>;
const KEYS: TeamKey[] = ['a', 'b'];

function TeamSettings({ preview, team, onName, onColor }: { preview: Tournament; team: TeamKey; onName: (v: string) => void; onColor: (c: TeamColor) => void }) {
  const other: TeamKey = team === 'a' ? 'b' : 'a';
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 font-bold text-white" style={{ background: teamFill(preview, team) }}>
        {teamName(preview, team)}
      </div>
      <div className="space-y-3 p-4">
        <Field label="Team name (optional)">
          <Input value={preview.teams[team].name ?? ''} maxLength={30} placeholder={team === 'a' ? 'Team A' : 'Team B'} onChange={(e) => onName(e.target.value)} />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Colour</span>
          <div className="flex flex-wrap gap-2">
            {TEAM_COLOR_KEYS.map((c) => {
              const on = preview.teams[team].color === c;
              const taken = preview.teams[other].color === c;
              return (
                <button
                  key={c}
                  type="button"
                  disabled={taken}
                  aria-pressed={on}
                  aria-label={`${TEAM_COLORS[c].label}${taken ? `, used by ${teamName(preview, other)}` : ''}`}
                  title={TEAM_COLORS[c].label}
                  onClick={() => onColor(c)}
                  className={cn(
                    'inline-flex size-9 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-surface transition disabled:opacity-20',
                    on && 'ring-2 ring-ink',
                  )}
                  style={{ background: TEAM_COLORS[c].fill }}
                >
                  {on && <Check size={16} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SpotPicker({ t, value, onChange, name }: { t: Tournament; value: Spot; onChange: (s: Spot) => void; name: string }) {
  const options: { value: Spot; label: string; aria: string; team?: TeamKey }[] = [
    { value: 'a', label: 'A', aria: teamName(t, 'a'), team: 'a' },
    { value: 'b', label: 'B', aria: teamName(t, 'b'), team: 'b' },
    { value: 'both', label: 'Both', aria: 'Both teams (common player)' },
    { value: 'out', label: 'Out', aria: 'Not playing' },
  ];
  return (
    <div role="radiogroup" aria-label={`${name}'s team`} className="flex shrink-0 rounded-full border border-line bg-surface-2 p-0.5">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.aria}
            onClick={() => onChange(o.value)}
            className={cn('inline-flex h-8 min-w-11 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-semibold transition', on ? 'bg-chip text-chip-ink shadow-sm' : 'text-muted hover:text-ink')}
          >
            {o.team && <TeamDot t={t} team={o.team} className="size-2" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Admin form: team names, colours and who plays for whom. Nothing is saved until Save teams (the first
 * time) or Update teams, so it is clear when the teams are done.
 */
function TeamsForm({ t, first, onSaved, onCancel }: { t: Tournament; first: boolean; onSaved: () => void; onCancel: () => void }) {
  const { players, nameOf } = useData();
  const [draft, setDraft] = useState<Draft>(() => ({ a: { ...t.teams.a }, b: { ...t.teams.b } }));
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const preview: Tournament = { ...t, teams: draft };

  const change = (team: TeamKey, patch: Partial<TournamentTeam>) => {
    setError(null);
    setDraft((d) => ({ ...d, [team]: { ...d[team], ...patch } }));
  };
  const spotOf = (id: PlayerId): Spot => playerTeam(preview, id) ?? 'out';
  const assign = (id: PlayerId, spot: Spot) => {
    setError(null);
    setDraft((d) => {
      const a = d.a.players.filter((x) => x !== id);
      const b = d.b.players.filter((x) => x !== id);
      if (spot === 'a' || spot === 'both') a.push(id);
      if (spot === 'b' || spot === 'both') b.push(id);
      return { a: { ...d.a, players: a }, b: { ...d.b, players: b } };
    });
  };

  const listed = new Set([...t.teams.a.players, ...t.teams.b.players, ...draft.a.players, ...draft.b.players]);
  // From a planned tournament: who said they're in comes first.
  const invited = new Set(t.invited);
  const rows = players.filter((p) => p.active || listed.has(p.id) || invited.has(p.id));
  const groups = invited.size
    ? [
        { title: `Said they're in (${rows.filter((p) => invited.has(p.id)).length})`, rows: rows.filter((p) => invited.has(p.id)) },
        { title: 'Everyone else', rows: rows.filter((p) => !invited.has(p.id)) },
      ]
    : [{ title: null, rows }];
  const both = draft.a.players.filter((id) => draft.b.players.includes(id)).length;

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    if (players.some((p) => p.name.trim().toLowerCase() === name.toLowerCase())) return toast(`${name} already exists. Pick them in the list.`, 'error');
    createPlayer({ name, level: 3 });
    setNewName('');
  };

  const save = () => {
    if (KEYS.some((k) => !draft[k].players.length)) return setError('Each team needs at least one player.');
    // Someone already in matches for a team has to stay on it (or those matches change first).
    for (const m of tournamentMatches(t)) {
      for (const k of KEYS) {
        const gone = m[k].find((id) => !draft[k].players.includes(id));
        if (gone) return setError(`${nameOf(gone)} plays for ${teamName(t, k)} in ${matchCode(m.order)}. Keep them on the team, or change that match first.`);
      }
    }
    saveTeams(t.id, {
      a: { ...draft.a, name: draft.a.name?.trim() || null },
      b: { ...draft.b, name: draft.b.name?.trim() || null },
    });
    toast(first ? 'Teams saved' : 'Teams updated', 'success');
    onSaved();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {KEYS.map((k) => (
          <TeamSettings key={k} preview={preview} team={k} onName={(v) => change(k, { name: v })} onColor={(c) => change(k, { color: c })} />
        ))}
      </div>
      {confusablePair(draft.a.color, draft.b.color) && (
        <Notice tone="warn">
          {TEAM_COLORS[draft.a.color].label} and {TEAM_COLORS[draft.b.color].label.toLowerCase()} are hard to tell apart for colour-blind players. Blue and orange
          work for everyone.
        </Notice>
      )}
      <Card>
        <CardHeader
          title="Players"
          subtitle={`${teamName(preview, 'a')}: ${draft.a.players.length} · ${teamName(preview, 'b')}: ${draft.b.players.length}${both ? ` (${both} on both)` : ''}. A player on Both can play for either team; each match says which.`}
        />
        {groups.map((g) => (
          <div key={g.title ?? 'all'} className="px-2 pt-2">
            {g.title && <h3 className="kicker px-2 pt-2 pb-1">{g.title}</h3>}
            <ul className="divide-y divide-line">
              {g.rows.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-2 py-2">
                  <Avatar name={p.name} photo={p.photo} size={32} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                  <SpotPicker t={preview} name={p.name} value={spotOf(p.id)} onChange={(s) => assign(p.id, s)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="flex gap-2 border-t border-line p-4">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="New player's name" aria-label="New player's name" />
          <Button variant="secondary" onClick={add} disabled={!newName.trim()}>
            <UserPlus size={16} /> Add
          </Button>
        </div>
      </Card>
      {error && <Notice tone="bad">{error}</Notice>}
      <div className="flex gap-2">
        {!first && (
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button size="lg" className="flex-1" onClick={save}>
          <Check size={18} /> {first ? 'Save teams' : 'Update teams'}
        </Button>
      </div>
    </div>
  );
}

/** Read-only team lists: what everyone sees, and admins between edits. */
function TeamList({ t, team }: { t: Tournament; team: TeamKey }) {
  const { nameOf, playersById, pathOf } = useData();
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 font-bold text-white" style={{ background: teamFill(t, team) }}>
        {teamName(t, team)}
      </div>
      <ul className="divide-y divide-line">
        {t.teams[team].players.map((id) => (
          <li key={id}>
            <Link to={pathOf(id)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
              <Avatar name={nameOf(id)} photo={playersById.get(id)?.photo} size={30} />
              <span className="min-w-0 flex-1 truncate font-semibold">{nameOf(id)}</span>
              {playerTeam(t, id) === 'both' && <span className="text-xs text-muted">both teams</span>}
            </Link>
          </li>
        ))}
        {!t.teams[team].players.length && <li className="px-4 py-3 text-sm text-muted">No players yet.</li>}
      </ul>
    </Card>
  );
}

export function TeamsTab({ t, isAdmin }: { t: Tournament; isAdmin: boolean }) {
  const [, setParams] = useSearchParams();
  const first = !t.teams.a.players.length && !t.teams.b.players.length;
  const [editing, setEditing] = useState(first);

  if (isAdmin && editing) {
    return (
      <TeamsForm
        t={t}
        first={first}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          // Next step after the first save: the matches.
          if (first) setParams({ tab: 'schedule' }, { replace: true });
        }}
      />
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TeamList t={t} team="a" />
        <TeamList t={t} team="b" />
      </div>
      {isAdmin && (
        <Button variant="secondary" block onClick={() => setEditing(true)}>
          <Pencil size={16} /> Edit teams
        </Button>
      )}
    </div>
  );
}
