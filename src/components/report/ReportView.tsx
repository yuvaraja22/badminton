import clsx from 'clsx';
import type { ReactNode } from 'react';
import { oneDecimal, pct, pctRound, signed } from '../../lib/format';
import type { SessionReport } from '../../lib/engine/report';
import { CourtLines } from '../session/CourtView';

/** The session report, laid out like the group's original PDF reports (always on light "paper"). */

const INK = '#0f1f1a';

function winColor(rate: number) {
  if (rate > 0.5) return '#1b6f3f';
  if (rate === 0.5) return '#8a5a0c';
  return '#b8321f';
}

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: 'bg-[#d4f53c] border-[#0f1f1a]/15 text-[#0f1f1a]',
    2: 'bg-[#dfe4e2] border-[#24302b]/15 text-[#24302b]',
    3: 'bg-[#ecc9a4] border-[#4a2a10]/15 text-[#4a2a10]',
  };
  return (
    <span
      className={clsx(
        'font-score inline-flex size-8 items-center justify-center rounded-full border-2 text-base font-black',
        styles[rank] ?? 'border-[#e0d9c8] bg-white text-[#5b6862]',
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
        'font-score inline-flex min-w-12 justify-center rounded-full px-2 py-0.5 text-[15px] font-bold tracking-wide',
        value > 0 ? 'bg-[#dcefdc] text-[#1b6f3f]' : value < 0 ? 'bg-[#f9e0d9] text-[#b8321f]' : 'bg-[#ece7d9] text-[#5b6862]',
      )}
    >
      {signed(value)}
    </span>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-7 mb-3 flex items-center gap-2.5 border-b border-[#e0d9c8] pb-2 text-[13px] font-extrabold tracking-[0.1em] uppercase sm:text-[15px]">
      <span className="h-2.5 w-5 rounded-sm bg-[#d4f53c] ring-1 ring-black/10" />
      {children}
    </h3>
  );
}

function SummaryCard({ color, label, value, lines, highlight }: { color: string; label: string; value: string; lines: string[]; highlight?: boolean }) {
  return (
    <div
      className={clsx(
        'rounded-2xl border px-3 pt-3 pb-3.5 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        highlight ? 'border-[#0f1f1a]/10 bg-[#d4f53c]' : 'border-[#e0d9c8] bg-white',
      )}
      style={highlight ? undefined : { borderTop: `4px solid ${color}` }}
    >
      <div className="text-[10px] font-bold tracking-[0.12em] uppercase sm:text-[11px]" style={{ color: highlight ? INK : color }}>
        {label}
      </div>
      <div className="mt-1.5 text-lg leading-tight font-extrabold tracking-tight sm:text-2xl">{value}</div>
      {lines.map((l) => (
        <div key={l} className={clsx('mt-1 text-[11px] leading-snug sm:text-xs', highlight ? 'text-[#0f1f1a]/75' : 'text-[#5b6862]')}>
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
    <article className="overflow-hidden rounded-[1.4rem] bg-[#fffdf8] p-3 shadow-[0_8px_24px_-12px_rgb(15_31_26/0.25)] ring-1 ring-black/5 sm:p-6" style={{ color: INK }}>
      <header
        className="relative overflow-hidden rounded-2xl px-5 py-5 text-[#f6f3ea] sm:px-7 sm:py-6"
        style={{ background: 'repeating-linear-gradient(90deg, rgb(255 255 255 / 0.03) 0 22px, transparent 22px 44px), linear-gradient(160deg, #11624b, #0b4a38)' }}
      >
        <CourtLines className="inset-y-3 -right-[30%] w-[70%] text-[#f6f3ea] opacity-30" />
        <span className="absolute inset-y-0 left-0 w-1.5 bg-[#d4f53c]" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[1.6rem] leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-4xl">{report.title}</h2>
            <p className="mt-1.5 text-xs text-white/75 sm:text-sm">{report.subtitle}</p>
          </div>
          <span className="relative rounded-full bg-[#d4f53c] px-4 py-1.5 text-[11px] font-bold tracking-[0.1em] whitespace-nowrap text-[#0f1f1a] uppercase sm:text-xs">
            {inProgress ? 'In progress' : report.kind === 'tournament' ? 'Tournament summary' : 'Session summary'} • {report.matchCount} matches
          </span>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard color="#11624b" label="Total matches" value={String(report.matchCount)} lines={totalLines} />
        <SummaryCard
          color="#8a5a0c"
          highlight
          label={mvp?.undefeated ? 'Undefeated MVP' : 'MVP'}
          value={mvp ? `${mvp.name} (${mvp.won}-${mvp.lost})` : '—'}
          lines={mvp ? [mvp.line] : ['No results yet']}
        />
        <SummaryCard
          color="#0f766e"
          label="Best partnership"
          value={bestPair?.label ?? '—'}
          lines={bestPair ? [bestPair.line] : ['Needs 2+ games together']}
        />
        <SummaryCard
          color="#c2410c"
          label="Tightest contest"
          value={tightest?.score ?? '—'}
          lines={tightest ? [tightest.line] : ['No results yet']}
        />
      </div>

      <SectionTitle>Player standings &amp; performance leaderboard</SectionTitle>
      {/* Phones: one compact row per player. Wider screens (and the PDF) get the full table. */}
      <ul className="tabular divide-y divide-[#ece7d9] rounded-xl border border-[#e0d9c8] bg-white sm:hidden">
        {report.standings.map((s) => (
          <li key={s.playerId} className={clsx('flex items-center gap-3 px-3 py-2.5', !s.qualified && 'text-[#8a958f]')}>
            <RankBadge rank={s.rank} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">
                {s.name}
                {s.isNew && <span className="ml-1 text-xs font-semibold text-[#0f766e]">(New)</span>}
              </div>
              <div className="text-xs text-[#5b6862]">
                {s.played} played · {oneDecimal(s.ppg)} PPG
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-[#ece7d9]">
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
        {!report.standings.length && <li className="px-3 py-6 text-center text-sm text-[#5b6862]">No completed matches yet.</li>}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-[#e0d9c8] bg-white sm:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-[#f4f0e6] text-[11px] font-bold uppercase text-[#5b6862]">
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
              <tr key={s.playerId} className={clsx('border-t border-[#ece7d9]', !s.qualified && 'text-[#8a958f]')}>
                <td className="px-3 py-2.5 text-left">
                  <RankBadge rank={s.rank} />
                </td>
                <td className="px-3 py-2.5 text-left">
                  <div className="font-bold">
                    {s.name}
                    {s.isNew && <span className="ml-1 text-xs font-semibold text-[#0f766e]">(New)</span>}
                  </div>
                  {s.rank === 1 && mvp && <div className="text-xs font-semibold text-[#8a5a0c]">Top performer</div>}
                  {!s.qualified && <div className="text-xs">Few games</div>}
                </td>
                <td className="px-2">{s.played}</td>
                <td className="px-2 font-bold">{s.won}</td>
                <td className="px-2 text-[#b8321f]">{s.lost}</td>
                <td className="px-2">
                  <div className="mx-auto w-28">
                    <div className="h-1.5 rounded-full bg-[#ece7d9]">
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
                <td colSpan={10} className="px-3 py-6 text-[#5b6862]">
                  No completed matches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl border border-[#e0d9c8] bg-white p-4 sm:p-5">
          <h4 className="mb-3 text-[13px] font-extrabold uppercase">Partnership performance</h4>
          <ul className="tabular text-sm">
            {report.partnerships.map((p) => (
              <li key={p.label} className="flex items-center justify-between gap-2 border-t border-[#ece7d9] py-2 first:border-t-0">
                <span className="min-w-0 truncate font-bold">{p.label}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-[13px]">
                    {p.won} - {p.lost} ({pctRound(p.winRate)})
                  </span>
                  <Diff value={p.diff} />
                </span>
              </li>
            ))}
            {!report.partnerships.length && <li className="text-[#5b6862]">No completed matches yet.</li>}
          </ul>
        </section>
        <section className="rounded-xl border border-[#e0d9c8] bg-white p-4 sm:p-5">
          <h4 className="mb-3 text-[13px] font-extrabold uppercase">Key {report.kind} takeaways</h4>
          <ul className="list-disc space-y-2 pl-5 text-[13.5px] leading-relaxed marker:text-[#5b6862]">
            {takeaways.map((t, i) => (
              <li key={i}>
                <Takeaway text={t} />
              </li>
            ))}
            {!takeaways.length && <li className="list-none text-[#5b6862]">Takeaways appear once a few matches are done.</li>}
          </ul>
        </section>
      </div>

      <SectionTitle>Complete match-by-match log ({report.log.length} games)</SectionTitle>
      <ul className="tabular divide-y divide-[#ece7d9] rounded-xl border border-[#e0d9c8] bg-white sm:hidden">
        {report.log.map((r) => {
          const done = r.status === 'completed';
          return (
            <li key={r.number} className={clsx('px-3 py-2.5', !done && 'bg-[#f6f3ea]')}>
              <div className="flex items-center gap-3">
                <span className="w-9 shrink-0 text-xs font-bold">{r.code}</span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className={clsx('flex justify-between gap-2', r.winner === 'A' && 'font-bold')}>
                    <span className="truncate">{r.team1}</span>
                    <span className={clsx(!done && 'text-[#7b8781]')}>{r.scoreA ?? '–'}</span>
                  </div>
                  <div className={clsx('flex justify-between gap-2', r.winner === 'B' && 'font-bold')}>
                    <span className="truncate">{r.team2}</span>
                    <span className={clsx(!done && 'text-[#7b8781]')}>
                      {r.scoreB ?? '–'}
                      {r.status === 'unfinished' && '*'}
                    </span>
                  </div>
                </div>
              </div>
              <div className={clsx('mt-1 pl-12 text-xs', r.winner ? 'text-[#1b6f3f]' : 'text-[#5b6862]')}>
                {r.winnerLabel && <span className="font-bold">{r.winnerLabel} · </span>}
                <span className="text-[#5b6862]">{r.context}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-[#e0d9c8] bg-white sm:block">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="bg-[#f4f0e6] text-left text-[11px] font-bold uppercase text-[#5b6862]">
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
                <tr key={r.number} className={clsx('border-t border-[#ece7d9]', !done && 'bg-[#f6f3ea]')}>
                  <td className="px-3 py-3 font-bold">{r.code}</td>
                  <td className={clsx('px-3 py-3', r.winner === 'A' && 'font-bold')}>{r.team1}</td>
                  <td className={clsx('tabular px-3 py-3 text-center font-bold whitespace-nowrap', !done && 'text-[#7b8781]')}>
                    {r.scoreA ?? '–'} : {r.scoreB ?? '–'}
                    {r.status === 'unfinished' && '*'}
                  </td>
                  <td className={clsx('px-3 py-3', r.winner === 'B' && 'font-bold')}>{r.team2}</td>
                  <td className="px-3 py-3 font-bold text-[#1b6f3f]">
                    {r.winnerLabel ?? <span className="text-[#7b8781]">—</span>}
                  </td>
                  <td className="px-3 py-3 text-[13px]">{r.context}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 px-1 text-[11px] text-[#5b6862]">
        {report.unfinishedCount > 0 && '* Match not completed; excluded from player standings, partnership records and totals. '}
        Margins are shown as winning score minus losing score.
      </p>
      <footer className="mt-6 flex justify-between border-t border-[#e0d9c8] pt-3 text-[11px] text-[#5b6862]">
        <span>{report.footer}</span>
      </footer>
    </article>
  );
}
