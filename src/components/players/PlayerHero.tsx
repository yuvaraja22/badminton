import type { ReactNode } from 'react';
import { useData } from '../../lib/data/context';
import type { PlayerLine } from '../../lib/engine/stats';
import { oneDecimal, pct, signed } from '../../lib/format';
import type { Player } from '../../lib/types';
import { PhotoButton } from './PhotoButton';

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <div className="text-[10.5px] font-bold tracking-[0.16em] uppercase opacity-70">{label}</div>
      <div className="font-score tabular mt-0.5 text-[2.4rem] leading-none font-black whitespace-nowrap">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs opacity-70">{sub}</div>}
    </div>
  );
}

/**
 * A player's card, sports-poster style: photo, name, skill rating and record on the court green,
 * with the name written large behind.
 */
export function PlayerHero({
  player,
  line,
  kicker,
  badges,
  actions,
}: {
  player: Player;
  line: PlayerLine | null;
  kicker?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  const rating = useData().ratings.get(player.id);
  const first = player.name.split(/\s+/)[0] ?? player.name;
  return (
    <section className="court-mat relative overflow-hidden rounded-[1.6rem] p-4 shadow-[var(--shadow-card)]">
      <span
        aria-hidden
        className="font-score pointer-events-none absolute -right-2 -bottom-7 text-[8.5rem] leading-none font-black whitespace-nowrap uppercase opacity-15 [-webkit-text-stroke:2px_var(--court-ink)] [color:transparent]"
      >
        {first}
      </span>
      <span aria-hidden className="pointer-events-none absolute -top-20 -left-10 size-56 rounded-full bg-volt/20 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <PhotoButton player={player} size={84} className="ring-4 ring-volt" />
        <div className="min-w-0 flex-1">
          {kicker && <p className="text-sm opacity-75">{kicker}</p>}
          <h1 className="truncate pb-1 text-[2.3rem] leading-[0.95] font-extrabold tracking-[-0.04em]">{player.name}</h1>
          {badges && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{badges}</div>}
        </div>
      </div>
      <div className="relative mt-5 grid grid-cols-3 divide-x divide-white/15">
        <Figure
          label="Rating"
          value={rating ? oneDecimal(rating.level) : '–'}
          sub={rating ? (rating.provisional ? 'Provisional' : `${rating.games} games`) : 'No games yet'}
        />
        <Figure label="Win rate" value={line ? pct(line.winRate, 0) : '–'} sub={line ? `${line.won}-${line.lost} record` : undefined} />
        <Figure label="Point diff" value={line ? signed(line.diff) : '–'} sub={line ? `${line.played} matches` : undefined} />
      </div>
      {actions && <div className="relative mt-4 flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}
