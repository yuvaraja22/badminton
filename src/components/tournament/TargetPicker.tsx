import { useState } from 'react';
import { cn } from '../../lib/cn';
import { maxPointsFor } from '../../lib/engine/tournament';
import { Input } from '../ui/Field';

const QUICK = [10, 11, 15, 21];
const MIN = 3;
const MAX = 30;

/** Points to win a game: quick picks or any number, with the deuce rule that follows. */
export function TargetPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [other, setOther] = useState(QUICK.includes(value) ? '' : String(value));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {QUICK.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => {
              setOther('');
              onChange(n);
            }}
            className={cn(
              'font-score h-11 min-w-14 rounded-full border px-4 text-xl leading-none font-black transition',
              value === n ? 'border-transparent bg-chip text-chip-ink' : 'border-line hover:bg-surface-2',
            )}
          >
            {n}
          </button>
        ))}
        <Input
          type="number"
          inputMode="numeric"
          min={MIN}
          max={MAX}
          value={other}
          placeholder="Other"
          aria-label="Other target"
          className="h-11 w-24 text-center"
          onChange={(e) => {
            setOther(e.target.value);
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= MIN && n <= MAX) onChange(n);
          }}
        />
      </div>
      <p className="text-sm text-muted">
        First to {value}, win by 2 (max {maxPointsFor(value)}).
      </p>
    </div>
  );
}
