import clsx from 'clsx';
import { Link } from 'react-router';
import { useData } from '../../lib/data/context';
import type { PairLine, PlayerLine } from '../../lib/engine/stats';
import { oneDecimal, pct, pctRound } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { DiffPill } from '../ui/Badge';

type Row = PlayerLine & { sessions?: number; mvps?: number };

function rankClass(rank: number) {
  return rank === 1
    ? 'bg-[#f7ecb5] text-[#6b5512] ring-[#d4b13c]'
    : rank === 2
      ? 'bg-[#e6ebf5] text-[#33405f] ring-[#8c9cc4]'
      : rank === 3
        ? 'bg-[#f6e1d1] text-[#6b3f1f] ring-[#c98a5b]'
        : 'bg-surface-2 text-muted ring-line';
}

/** On phones: rank, player, W-L, win %, diff. Wider screens add games, PPG, sessions and MVPs. */
export function StandingsTable({ rows, showSessions }: { rows: Row[]; showSessions?: boolean }) {
  const { nameOf, pathOf, playersById } = useData();
  const wide = 'hidden sm:table-cell';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm sm:min-w-[560px]">
        <thead>
          <tr className="text-[11px] font-bold uppercase text-muted">
            <th className="py-2 pr-1 pl-4 text-left">#</th>
            <th className="px-2 py-2 text-left">Player</th>
            {showSessions && <th className={clsx(wide, 'px-2 py-2')}>Sess.</th>}
            <th className={clsx(wide, 'px-2 py-2')}>P</th>
            <th className={clsx(wide, 'px-2 py-2')}>W</th>
            <th className={clsx(wide, 'px-2 py-2')}>L</th>
            <th className="px-2 py-2 sm:hidden">W-L</th>
            <th className="px-2 py-2">Win %</th>
            <th className="px-2 py-2 pr-4 sm:pr-2">Diff</th>
            <th className={clsx(wide, 'px-2 py-2')}>PPG</th>
            {showSessions && <th className={clsx(wide, 'py-2 pr-4 pl-2')}>MVP</th>}
          </tr>
        </thead>
        <tbody className="tabular text-center">
          {rows.map((r, i) => (
            <tr key={r.playerId} className={clsx('border-t border-line', !r.qualified && 'text-muted')}>
              <td className="py-2 pr-1 pl-4 text-left">
                <span className={clsx('inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ring-1', rankClass(r.qualified ? i + 1 : 99))}>
                  {i + 1}
                </span>
              </td>
              <td className="w-full max-w-0 px-2 py-2 text-left">
                <Link to={pathOf(r.playerId)} className="flex min-w-0 items-center gap-2 font-semibold hover:underline">
                  <Avatar name={nameOf(r.playerId)} photo={playersById.get(r.playerId)?.photo} size={24} />
                  <span className="truncate">{nameOf(r.playerId)}</span>
                </Link>
              </td>
              {showSessions && <td className={clsx(wide, 'px-2')}>{r.sessions ?? 0}</td>}
              <td className={clsx(wide, 'px-2')}>{r.played}</td>
              <td className={clsx(wide, 'px-2 font-semibold')}>{r.won}</td>
              <td className={clsx(wide, 'px-2')}>{r.lost}</td>
              <td className="px-2 font-semibold whitespace-nowrap sm:hidden">
                {r.won}-{r.lost}
              </td>
              <td className="px-2 font-semibold">{pct(r.winRate)}</td>
              <td className="px-2 pr-4 sm:pr-2">
                <DiffPill value={r.diff} />
              </td>
              <td className={clsx(wide, 'px-2')}>{oneDecimal(r.ppg)}</td>
              {showSessions && <td className={clsx(wide, 'py-2 pr-4 pl-2')}>{r.mvps ? `★ ${r.mvps}` : '–'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PartnershipList({ rows, limit }: { rows: PairLine[]; limit?: number }) {
  const { nameOf } = useData();
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <ul className="tabular divide-y divide-line text-sm">
      {shown.map((p) => (
        <li key={p.pair.join('|')} className="flex items-center justify-between gap-2 px-4 py-2.5">
          <span className="min-w-0 truncate font-semibold">
            {nameOf(p.pair[0])} &amp; {nameOf(p.pair[1])}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="text-muted">
              {p.won}-{p.lost} ({pctRound(p.winRate)})
            </span>
            <DiffPill value={p.diff} />
          </span>
        </li>
      ))}
    </ul>
  );
}
