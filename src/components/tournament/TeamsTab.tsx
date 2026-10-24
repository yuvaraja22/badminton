import { useState } from 'react';
import { Link } from 'react-router';
import { Check, UserPlus } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useData } from '../../lib/data/context';
import { createPlayer, setTeamDetails, setTeamPlayers } from '../../lib/data/mutations';
import { matchesFor, playerTeam } from '../../lib/engine/tournament';
import { listJoin, matchCode } from '../../lib/format';
import { TEAM_COLOR_KEYS, TEAM_COLORS, confusablePair, teamFill, teamName } from '../../lib/teamColors';
import { toast } from '../../lib/toast';
import type { PlayerId, TeamKey, Tournament } from '../../lib/types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card, CardHeader, Notice } from '../ui/Card';
import { Field, Input } from '../ui/Field';
import { TeamDot } from './TeamBits';

type Spot = TeamKey | 'both' | 'out';

function TeamSettings({ t, team }: { t: Tournament; team: TeamKey }) {
  const [name, setName] = useState(t.teams[team].name ?? '');
  const other: TeamKey = team === 'a' ? 'b' : 'a';
  const save = () => {
    const value = name.trim() || null;
    if (value !== t.teams[team].name) setTeamDetails(t.id, team, { name: value });
  };
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 font-bold text-white" style={{ background: teamFill(t, team) }}>
        {teamName(t, team)}
      </div>
      <div className="space-y-3 p-4">
        <Field label="Team name (optional)">
          <Input
            value={name}
            maxLength={30}
            placeholder={team === 'a' ? 'Team A' : 'Team B'}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium">Colour</span>
          <div className="flex flex-wrap gap-2">
            {TEAM_COLOR_KEYS.map((c) => {
              const on = t.teams[team].color === c;
              const taken = t.teams[other].color === c;
              return (
                <button
                  key={c}
                  type="button"
                  disabled={taken}
                  aria-pressed={on}
                  aria-label={`${TEAM_COLORS[c].label}${taken ? `, used by ${teamName(t, other)}` : ''}`}
                  title={TEAM_COLORS[c].label}
                  onClick={() => setTeamDetails(t.id, team, { color: c })}
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

function PlayersCard({ t }: { t: Tournament }) {
  const { players, nameOf } = useData();
  const [newName, setNewName] = useState('');
  const listed = new Set([...t.teams.a.players, ...t.teams.b.players]);
  const rows = players.filter((p) => p.active || listed.has(p.id));
  const both = t.teams.a.players.filter((id) => t.teams.b.players.includes(id)).length;

  const assign = (id: PlayerId, spot: Spot) => {
    const current = playerTeam(t, id) ?? 'out';
    if (current === spot) return;
    // Taking someone off a team they already play for would break those matches.
    for (const team of ['a', 'b'] as const) {
      const leaving = (current === team || current === 'both') && spot !== team && spot !== 'both';
      const clash = leaving ? matchesFor(t, id, team) : [];
      if (clash.length) {
        toast(`${nameOf(id)} plays for ${teamName(t, team)} in ${listJoin(clash.map((m) => matchCode(m.order)))}. Change ${clash.length === 1 ? 'that match' : 'those matches'} first.`, 'error');
        return;
      }
    }
    const a = t.teams.a.players.filter((x) => x !== id);
    const b = t.teams.b.players.filter((x) => x !== id);
    if (spot === 'a' || spot === 'both') a.push(id);
    if (spot === 'b' || spot === 'both') b.push(id);
    setTeamPlayers(t.id, a, b);
  };

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    if (players.some((p) => p.name.trim().toLowerCase() === name.toLowerCase())) return toast(`${name} already exists. Pick them in the list.`, 'error');
    createPlayer({ name, level: 3 });
    setNewName('');
  };

  return (
    <Card>
      <CardHeader
        title="Players"
        subtitle={`${teamName(t, 'a')}: ${t.teams.a.players.length} · ${teamName(t, 'b')}: ${t.teams.b.players.length}${both ? ` (${both} on both)` : ''}. A player on Both can play for either team; each match says which.`}
      />
      <ul className="divide-y divide-line px-2 pt-2">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-2 py-2">
            <Avatar name={p.name} photo={p.photo} size={32} />
            <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
            <SpotPicker t={t} name={p.name} value={playerTeam(t, p.id) ?? 'out'} onChange={(s) => assign(p.id, s)} />
          </li>
        ))}
      </ul>
      <div className="flex gap-2 border-t border-line p-4">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="New player's name" aria-label="New player's name" />
        <Button variant="secondary" onClick={add} disabled={!newName.trim()}>
          <UserPlus size={16} /> Add
        </Button>
      </div>
    </Card>
  );
}

/** Read-only team lists for everyone else. */
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
  if (!isAdmin) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <TeamList t={t} team="a" />
        <TeamList t={t} team="b" />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TeamSettings t={t} team="a" />
        <TeamSettings t={t} team="b" />
      </div>
      {confusablePair(t.teams.a.color, t.teams.b.color) && (
        <Notice tone="warn">
          {TEAM_COLORS[t.teams.a.color].label} and {TEAM_COLORS[t.teams.b.color].label.toLowerCase()} are hard to tell apart for colour-blind players. Blue and
          orange work for everyone.
        </Notice>
      )}
      <PlayersCard t={t} />
    </div>
  );
}
