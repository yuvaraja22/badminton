import clsx from 'clsx';
import { Link } from 'react-router';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useData } from '../../lib/data/context';
import type { PlayerRating } from '../../lib/engine/rating';
import { oneDecimal } from '../../lib/format';
import { levelName } from '../../lib/levels';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';

/** Change over the player's latest session; hidden when it is too small to matter. */
function Trend({ change }: { change: number }) {
  if (Math.abs(change) < 0.05) return null;
  const up = change > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-xs font-semibold', up ? 'text-good' : 'text-bad')} title="Change over their latest session">
      <Icon size={13} aria-hidden />
      {up ? '+' : '−'}
      {oneDecimal(Math.abs(change))}
    </span>
  );
}

/** Rating board, as ordered by ratingStandings: established players first, then provisional ones. */
export function RatingTable({ rows }: { rows: PlayerRating[] }) {
  const { nameOf, pathOf, playersById } = useData();
  return (
    <ul className="tabular divide-y divide-line text-sm">
      {rows.map((r, i) => {
        // Established players come first, so their position is their rank.
        return (
          <li key={r.playerId} className={clsx('flex items-center gap-3 px-4 py-2.5', r.provisional && 'text-muted')}>
            <span className="font-score w-5 shrink-0 text-center text-base font-black text-muted">{r.provisional ? '–' : i + 1}</span>
            <Link to={pathOf(r.playerId)} className="flex min-w-0 flex-1 items-center gap-2 font-semibold hover:underline">
              <Avatar name={nameOf(r.playerId)} photo={playersById.get(r.playerId)?.photo} size={24} />
              <span className="truncate">{nameOf(r.playerId)}</span>
            </Link>
            <span className="flex shrink-0 items-center gap-2">
              <Trend change={r.lastChange} />
              {r.provisional && <Badge>Provisional</Badge>}
              <span className="hidden text-xs text-muted sm:inline">{levelName(r.level)}</span>
              <span className="font-score w-10 text-right text-2xl leading-none font-black text-ink">{oneDecimal(r.level)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
