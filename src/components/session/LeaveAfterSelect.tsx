import { lastMatchNumber, sortedMatches } from '../../lib/engine/games';
import { leaveChoices } from '../../lib/lineup';
import type { Session } from '../../lib/types';
import { Select } from '../ui/Field';

/** Leaving early: "Staying to the end", or the last match someone can play. */
export function LeaveAfterSelect({
  session,
  value,
  onChange,
  label,
  className,
}: {
  session: Session;
  value: number | null;
  onChange: (leaveAfter: number | null) => void;
  label: string;
  className?: string;
}) {
  const live = sortedMatches(session).some((m) => m.status === 'live');
  const choices = leaveChoices(lastMatchNumber(session), live, value);
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={className} aria-label={label}>
      <option value="">Staying to the end</option>
      {choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </Select>
  );
}
