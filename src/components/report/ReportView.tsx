import clsx from 'clsx';
import type { ReactNode } from 'react';
import { oneDecimal, pct, pctRound, signed } from '../../lib/format';
import type { SessionReport } from '../../lib/engine/report';

/** The session report, laid out like the group's original PDF reports (always on light "paper"). */

const NAVY = '#1f2a44';

function winColor(rate: number) {
  if (rate > 0.5) return '#3c7a4a';
  if (rate === 0.5) return '#b07f2f';
  return '#a83c3c';
}

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: 'bg-[#f7ecb5] border-[#d4b13c] text-[#6b5512]',
    2: 'bg-[#e6ebf5] border-[#8c9cc4] text-[#33405f]',
    3: 'bg-[#f6e1d1] border-[#c98a5b] text-[#6b3f1f]',
  };
  return (
    <span
      className={clsx(
        'inline-flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold',
        styles[rank] ?? 'border-[#d3d6de] bg-white text-[#5b6274]',
      )}
    >
      {rank}
    </span>
  );
}

function Diff({ value }: { value: number }) {
  return (
    <span
      className={clsx(
        'inline-flex min-w-12 justify-center rounded-md px-2 py-1 text-[13px] font-bold',
        value > 0 ? 'bg-[#dff0e3] text-[#2f7a47]' : value < 0 ? 'bg-[#f6dede] text-[#a83c3c]' : 'bg-[#eeeef2] text-[#5b6274]',
      )}
    >
      {signed(value)}
    </span>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-7 mb-3 flex items-center gap-2.5 border-b border-[#e3e1db] pb-2 text-[13px] font-extrabold uppercase tracking-wide sm:text-[15px]">
      <span className="size-2.5 bg-[#b23a3a]" />
      {children}
    </h3>
  );
}

function SummaryCard({ color, label, value, lines }: { color: string; label: string; value: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-[#e3e1db] bg-white px-3 pt-3 pb-3.5 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]" style={{ borderTop: `4px solid ${color}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wide sm:text-[11px]" style={{ color }}>
        {label}
      </div>
      <div className="mt-1.5 text-lg leading-tight font-extrabold sm:text-2xl">{value}</div>
      {lines.map((l) => (
        <div key={l} className="mt-1 text-[11px] leading-snug text-[#5b6274] sm:text-xs">
          {l}
        </div>
      ))}
    </div>
  );
}

function Takeaway({ text }: { text: string }) {
  const i = text.indexOf(': ');
  if (i > 0 && i < 48) {
    return (
      <>
        <strong>{text.slice(0, i + 1)}</strong> {text.slice(i + 2)}
      </>
    );
  }
  return <>{text}</>;
}

export function ReportView({ report, takeaways, inProgress }: { report: SessionReport; takeaways: string[]; inProgress?: boolean }) {
  const { mvp, bestPair, tightest } = report;
  const totalLines = [`${report.totalPoints} total points scored`, `${report.playerCount} players`];
  if (report.unfinishedCount) {
    totalLines.push(`(+${report.unfinishedCount} match${report.unfinishedCount === 1 ? '' : 'es'} left unfinished)`);
  }
  return (
    <article className="overflow-hidden rounded-2xl bg-[#fbfaf7] p-3 shadow-sm ring-1 ring-black/5 sm:p-6" style={{ color: NAVY }}>
      <header className="relative overflow-hidden rounded-xl px-5 py-5 text-white sm:px-7 sm:py-6" style={{ background: NAVY }}>
        <span className="absolute inset-y-0 left-0 w-1.5 bg-[#b23a3a]" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl leading-tight font-extrabold uppercase sm:text-3xl">{report.title}</h2>
            <p className="mt-1.5 text-xs text-white/75 sm:text-sm">{report.subtitle}</p>
          </div>
          <span className="rounded-full border border-white/40 bg-white/10 px-4 py-1.5 text-[11px] font-bold uppercase whitespace-nowrap sm:text-xs">
            {inProgress ? 'In progress' : 'Session summary'} • {report.matchCount} matches
          </span>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard color="#3f5ba9" label="Total matches" value={String(report.matchCount)} lines={totalLines} />
        <SummaryCard
          color="#c98a4b"
          label={mvp?.undefeated ? 'Undefeated MVP' : 'MVP'}
          value={mvp ? `${mvp.name} (${mvp.won}-${mvp.lost})` : '—'}
          lines={mvp ? [mvp.line] : ['No results yet']}
        />
        <SummaryCard
          color="#3e8a75"
          label="Best partnership"
          value={bestPair?.label ?? '—'}
          lines={bestPair ? [bestPair.line] : ['Needs 2+ games together']}
        />
        <SummaryCard
          color="#7a5ea8"
          label="Tightest contest"
          value={tightest?.score ?? '—'}
          lines={tightest ? [tightest.line] : ['No results yet']}
        />
      </div>

      <SectionTitle>Player standings &amp; performance leaderboard</SectionTitle>
      {/* Phones: one compact row per player. Wider screens (and the PDF) get the full table. */}
      <ul className="tabular divide-y divide-[#eceae4] rounded-xl border border-[#e3e1db] bg-white sm:hidden">
        {report.standings.map((s) => (
          <li key={s.playerId} className={clsx('flex items-center gap-3 px-3 py-2.5', !s.qualified && 'text-[#8a8f9c]')}>
            <RankBadge rank={s.rank} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">
                {s.name}
                {s.isNew && <span className="ml-1 text-xs font-semibold text-[#3e8a75]">(New)</span>}
              </div>
              <div className="text-xs text-[#6b7180]">
                {s.played} played · {oneDecimal(s.ppg)} PPG
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-[#e8e9ee]">
                <div className="h-1.5 rounded-full" style={{ width: `${Math.max(3, s.winRate * 100)}%`, background: winColor(s.winRate) }} />
              </div>
            </div>
            <div className="w-14 text-right">
              <div className="font-bold">
                {s.won}-{s.lost}
              </div>
              <div className="text-xs font-bold" style={{ color: winColor(s.winRate) }}>
                {pct(s.winRate)}
              </div>
            </div>
            <Diff value={s.diff} />
          </li>
        ))}
        {!report.standings.length && <li className="px-3 py-6 text-center text-sm text-[#6b7180]">No completed matches yet.</li>}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-[#e3e1db] bg-white sm:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-[#f1f2f5] text-[11px] font-bold uppercase text-[#6b7180]">
              <th className="px-3 py-3 text-left">Rank</th>
              <th className="px-3 py-3 text-left">Player</th>
              <th className="px-2 py-3">Played</th>
              <th className="px-2 py-3">Won</th>
              <th className="px-2 py-3">Lost</th>
              <th className="px-2 py-3">Win rate (%)</th>
              <th className="px-2 py-3">Pts for</th>
              <th className="px-2 py-3">Pts against</th>
              <th className="px-2 py-3">Diff</th>
              <th className="px-2 py-3">PPG</th>
            </tr>
          </thead>
          <tbody className="tabular text-center">
            {report.standings.map((s) => (
              <tr key={s.playerId} className={clsx('border-t border-[#eceae4]', !s.qualified && 'text-[#8a8f9c]')}>
                <td className="px-3 py-2.5 text-left">
                  <RankBadge rank={s.rank} />
                </td>
                <td className="px-3 py-2.5 text-left">
                  <div className="font-bold">
                    {s.name}
                    {s.isNew && <span className="ml-1 text-xs font-semibold text-[#3e8a75]">(New)</span>}
                  </div>
                  {s.rank === 1 && mvp && <div className="text-xs font-semibold text-[#c98a4b]">Top performer</div>}
                  {!s.qualified && <div className="text-xs">Few games</div>}
                </td>
                <td className="px-2">{s.played}</td>
                <td className="px-2 font-bold">{s.won}</td>
                <td className="px-2 text-[#a83c3c]">{s.lost}</td>
                <td className="px-2">
                  <div className="mx-auto w-28">
                    <div className="h-1.5 rounded-full bg-[#e8e9ee]">
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.max(3, s.winRate * 100)}%`, background: winColor(s.winRate) }} />
                    </div>
                    <div className="mt-1 text-left text-[13px] font-bold" style={{ color: winColor(s.winRate) }}>
                      {pct(s.winRate)}
                    </div>
                  </div>
                </td>
                <td className="px-2">{s.pointsFor}</td>
                <td className="px-2">{s.pointsAgainst}</td>
                <td className="px-2">
                  <Diff value={s.diff} />
                </td>
                <td className="px-2 font-bold">{oneDecimal(s.ppg)}</td>
              </tr>
            ))}
            {!report.standings.length && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-[#6b7180]">
                  No completed matches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl border border-[#e3e1db] bg-white p-4 sm:p-5">
          <h4 className="mb-3 text-[13px] font-extrabold uppercase">Partnership performance</h4>
          <ul className="tabular text-sm">
            {report.partnerships.map((p) => (
              <li key={p.label} className="flex items-center justify-between gap-2 border-t border-[#eceae4] py-2 first:border-t-0">
                <span className="min-w-0 truncate font-bold">{p.label}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-[13px]">
                    {p.won} - {p.lost} ({pctRound(p.winRate)})
                  </span>
                  <Diff value={p.diff} />
                </span>
              </li>
            ))}
            {!report.partnerships.length && <li className="text-[#6b7180]">No completed matches yet.</li>}
          </ul>
        </section>
        <section className="rounded-xl border border-[#e3e1db] bg-white p-4 sm:p-5">
          <h4 className="mb-3 text-[13px] font-extrabold uppercase">Key session takeaways</h4>
          <ul className="list-disc space-y-2 pl-5 text-[13.5px] leading-relaxed marker:text-[#5b6274]">
            {takeaways.map((t, i) => (
              <li key={i}>
                <Takeaway text={t} />
              </li>
            ))}
            {!takeaways.length && <li className="list-none text-[#6b7180]">Takeaways appear once a few matches are done.</li>}
          </ul>
        </section>
      </div>

      <SectionTitle>Complete match-by-match log ({report.log.length} games)</SectionTitle>
      <ul className="tabular divide-y divide-[#eceae4] rounded-xl border border-[#e3e1db] bg-white sm:hidden">
        {report.log.map((r) => {
          const done = r.status === 'completed';
          return (
            <li key={r.number} className={clsx('px-3 py-2.5', !done && 'bg-[#f4f4f6]')}>
              <div className="flex items-center gap-3">
                <span className="w-9 shrink-0 text-xs font-bold">{r.code}</span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className={clsx('flex justify-between gap-2', r.winner === 'A' && 'font-bold')}>
                    <span className="truncate">{r.team1}</span>
                    <span className={clsx(!done && 'text-[#7a8090]')}>{r.scoreA ?? '–'}</span>
                  </div>
                  <div className={clsx('flex justify-between gap-2', r.winner === 'B' && 'font-bold')}>
                    <span className="truncate">{r.team2}</span>
                    <span className={clsx(!done && 'text-[#7a8090]')}>
                      {r.scoreB ?? '–'}
                      {r.status === 'unfinished' && '*'}
                    </span>
                  </div>
                </div>
              </div>
              <div className={clsx('mt-1 pl-12 text-xs', r.winner ? 'text-[#3c7a4a]' : 'text-[#6b7180]')}>
                {r.winner && <span className="font-bold">Team {r.winner === 'A' ? 1 : 2} · </span>}
                <span className="text-[#5b6274]">{r.context}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-[#e3e1db] bg-white sm:block">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="bg-[#f1f2f5] text-left text-[11px] font-bold uppercase text-[#6b7180]">
              <th className="px-3 py-3">Match</th>
              <th className="px-3 py-3">Team 1</th>
              <th className="px-3 py-3 text-center">Score</th>
              <th className="px-3 py-3">Team 2</th>
              <th className="px-3 py-3">Winner</th>
              <th className="px-3 py-3">Result &amp; context</th>
            </tr>
          </thead>
          <tbody>
            {report.log.map((r) => {
              const done = r.status === 'completed';
              return (
                <tr key={r.number} className={clsx('border-t border-[#eceae4]', !done && 'bg-[#f4f4f6]')}>
                  <td className="px-3 py-3 font-bold">{r.code}</td>
                  <td className={clsx('px-3 py-3', r.winner === 'A' && 'font-bold')}>{r.team1}</td>
                  <td className={clsx('tabular px-3 py-3 text-center font-bold whitespace-nowrap', !done && 'text-[#7a8090]')}>
                    {r.scoreA ?? '–'} : {r.scoreB ?? '–'}
                    {r.status === 'unfinished' && '*'}
                  </td>
                  <td className={clsx('px-3 py-3', r.winner === 'B' && 'font-bold')}>{r.team2}</td>
                  <td className="px-3 py-3 font-bold text-[#3c7a4a]">
                    {r.winner ? `Team ${r.winner === 'A' ? 1 : 2}` : <span className="text-[#7a8090]">—</span>}
                  </td>
                  <td className="px-3 py-3 text-[13px]">{r.context}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 px-1 text-[11px] text-[#6b7180]">
        {report.unfinishedCount > 0 && '* Match not completed; excluded from player standings, partnership records and totals. '}
        Margins are shown as winning score minus losing score.
      </p>
      <footer className="mt-6 flex justify-between border-t border-[#e3e1db] pt-3 text-[11px] text-[#6b7180]">
        <span>{report.footer}</span>
      </footer>
    </article>
  );
}
