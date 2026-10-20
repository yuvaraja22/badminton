import type { LineupOption } from '../../lib/lineup';
import type { Lineup, PlayerId, Team } from '../../lib/types';
import { Select } from '../ui/Field';

/** Four player pickers (two per team). Picking someone already in another slot swaps the two. */
export function LineupFields({ value, onChange, options }: { value: Lineup; onChange: (v: Lineup) => void; options: LineupOption[] }) {
  const slots: PlayerId[] = [...value.teamA, ...value.teamB];
  const level = (id: PlayerId) => options.find((o) => o.id === id)?.level ?? 0;
  const setSlot = (i: number, id: PlayerId) => {
    const next = [...slots];
    const j = next.indexOf(id);
    if (j >= 0 && j !== i) next[j] = next[i];
    next[i] = id;
    onChange({ teamA: [next[0], next[1]] as Team, teamB: [next[2], next[3]] as Team });
  };
  const team = (label: string, offset: number) => (
    <fieldset className="rounded-xl border border-line p-3">
      <legend className="px-1 text-xs font-bold uppercase text-muted">
        {label} · level {(level(slots[offset]) + level(slots[offset + 1])).toFixed(1)}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {[offset, offset + 1].map((i) => (
          <Select key={i} value={slots[i]} onChange={(e) => setSlot(i, e.target.value)} aria-label={`${label} player ${i - offset + 1}`}>
            {!slots[i] && <option value="">Choose…</option>}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
      </div>
    </fieldset>
  );
  return (
    <div className="space-y-3">
      {team('Team 1', 0)}
      {team('Team 2', 2)}
    </div>
  );
}
