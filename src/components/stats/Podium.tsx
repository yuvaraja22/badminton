import { Link } from 'react-router';
import { Crown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useData } from '../../lib/data/context';
import type { PlayerLine } from '../../lib/engine/stats';
import { pctRound } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { rankClass } from './rankClass';

/** The top three ranked players on a floodlit podium (2nd, 1st, 3rd). Nothing until three have qualified. */
export function Podium({ rows }: { rows: PlayerLine[] }) {
  const { nameOf, pathOf, playersById } = useData();
  const top = rows.filter((r) => r.qualified).slice(0, 3);
  if (top.length < 3) return null;
  const places = [
    { line: top[1], rank: 2, step: 'h-16', size: 60 },
    { line: top[0], rank: 1, step: 'h-24', size: 76 },
    { line: top[2], rank: 3, step: 'h-11', size: 60 },
  ];
  return (
    <section className="court-mat relative overflow-hidden rounded-[1.6rem] px-3 pt-6 shadow-[var(--shadow-card)]" aria-label="Top three">
      <span aria-hidden className="pointer-events-none absolute -top-28 left-1/2 h-64 w-80 -translate-x-1/2 rounded-full bg-volt/25 blur-3xl" />
      <ol className="relative grid grid-cols-3 items-end gap-2">
        {places.map(({ line, rank, step, size }) => (
          <li key={line.playerId} className={cn('min-w-0', rank === 1 ? 'order-2' : rank === 2 ? 'order-1' : 'order-3')}>
            <Link to={pathOf(line.playerId)} className="group flex flex-col items-center text-center">
              {rank === 1 && <Crown size={22} className="mb-1 text-volt drop-shadow" aria-hidden />}
              <Avatar
                name={nameOf(line.playerId)}
                photo={playersById.get(line.playerId)?.photo}
                size={size}
                className={cn('transition group-hover:-translate-y-0.5', rank === 1 ? 'ring-4 ring-volt' : 'ring-2 ring-court-ink/50')}
              />
              <span className="mt-2 max-w-full truncate px-1 text-[15px] font-bold tracking-tight">{nameOf(line.playerId)}</span>
              <span className="tabular text-xs opacity-80">
                {line.won}-{line.lost} · {pctRound(line.winRate)}
              </span>
              <span
                className={cn(
                  'mt-2.5 flex w-full items-start justify-center rounded-t-2xl pt-1.5 ring-0 shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]',
                  step,
                  rankClass(rank),
                )}
              >
                <span className="font-score text-[2.6rem] leading-none font-black" aria-label={`Rank ${rank}`}>
                  {rank}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
