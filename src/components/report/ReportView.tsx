import clsx from 'clsx';
import { Fragment, useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { COMEBACK_MIN, rallyHighlights, type RallySummary } from '../../lib/engine/rally';
import type { SessionReport } from '../../lib/engine/report';
import { matchCode, oneDecimal, pct, pctRound, signed } from '../../lib/format';
import type { SidePair } from '../../lib/teamColors';
import type { PlayerId, TeamKey } from '../../lib/types';
import { CourtLines } from '../session/CourtView';
import { MatchLinks } from './MatchLinks';

/**
 * The report of a session or a tournament (in the app's colours; the PDF stays light), in the order it's read: who won,
 * every match (with its score flow when it was scored live), point by point, then the individual stats.
 */

function winColor(rate: number) {
  if (rate > 0.5) return 'var(--good)';
  if (rate === 0.5) return 'var(--warn)';
  return 'var(--bad)';
}

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: 'border-volt-ink/15 bg-volt text-volt-ink',
    2: 'bg-[#dfe4e2] border-[#24302b]/15 text-[#24302b]',
    3: 'bg-[#ecc9a4] border-[#4a2a10]/15 text-[#4a2a10]',
  };
  return (
    <span
      className={clsx(
        'font-score inline-flex size-8 items-center justify-center rounded-full border-2 text-base font-black',
        styles[rank] ?? 'border-line bg-surface text-muted',
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
        value > 0 ? 'bg-good-bg text-good' : value < 0 ? 'bg-bad-bg text-bad' : 'bg-surface-2 text-muted',
      )}
    >
      {signed(value)}
    </span>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-7 mb-3 flex items-center gap-2.5 border-b border-line pb-2 text-[13px] font-extrabold tracking-[0.1em] uppercase sm:text-[15px]">
      <span className="h-2.5 w-5 rounded-sm bg-volt ring-1 ring-black/10" />
      {children}
    </h3>
  );
}

function SummaryCard({ color, label, value, lines, highlight }: { color: string; label: string; value: string; lines: ReactNode[]; highlight?: boolean }) {
  return (
    <div
      className={clsx(
        'rounded-2xl border px-3 pt-3 pb-3.5 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        highlight ? 'border-volt-ink/10 bg-volt text-volt-ink' : 'border-line bg-surface',
      )}
      style={highlight ? undefined : { borderTop: `4px solid ${color}` }}
    >
      <div className="text-[10px] font-bold tracking-[0.12em] uppercase sm:text-[11px]" style={highlight ? undefined : { color }}>
        {label}
      </div>
      <div className="mt-1.5 text-lg leading-tight font-extrabold tracking-tight sm:text-2xl">{value}</div>
      {lines.map((l, i) => (
        <div key={i} className={clsx('mt-1 text-[11px] leading-snug sm:text-xs', highlight ? 'text-volt-ink/75' : 'text-muted')}>
          {l}
        </div>
      ))}
    </div>
  );
}

function Takeaway({ text, matchHref }: { text: string; matchHref?: MatchHref }) {
  const i = text.indexOf(': ');
  if (i > 0 && i < 48) {
    return (
      <>
        <strong>{text.slice(0, i + 1)}</strong> <MatchLinks text={text.slice(i + 2)} hrefOf={matchHref} />
      </>
    );
  }
  return <MatchLinks text={text} hrefOf={matchHref} />;
}

/** Where match number n lives (a tournament's matches have their own pages), or null. */
type MatchHref = (n: number) => string | null;

function MatchCode({ code, n, matchHref }: { code: string; n: number; matchHref?: MatchHref }) {
  const href = matchHref?.(n);
  return href ? (
    <Link to={href} className="underline decoration-1 underline-offset-2 hover:decoration-2">
      {code}
    </Link>
  ) : (
    <>{code}</>
  );
}

/** The report's card colours, so the point-by-point tiles look like the summary cards. */
const CARD_COLORS = ['var(--primary-text)', 'var(--orange)', 'var(--teal)', 'var(--warn)'];

/** Point by point: the headline facts and each side's numbers (live-scored matches only). */
export function ReportRally({
  rally,
  sides,
  nameOf,
  matchHref,
  typedIn,
}: {
  rally: RallySummary;
  sides: SidePair;
  nameOf: (id: PlayerId) => string;
  matchHref?: MatchHref;
  /** How to mention typed-in matches: list them (tournaments) or just count them (sessions, where most are). */
  typedIn: 'list' | 'count';
}) {
  const highlights = useMemo(() => rallyHighlights(rally, (k) => sides[k].name, nameOf), [rally, sides, nameOf]);
  if (!rally.flows.length) return null;
  const { a, b } = rally.teams;
  const rows: [string, string | number, string | number][] = [
    ['Longest run', a.longestRun, b.longestRun],
    ['Biggest lead', a.biggestLead, b.biggestLead],
    ['Game points saved', a.gamePointsSaved, b.gamePointsSaved],
    [`Wins from ${COMEBACK_MIN}+ down`, a.comebackWins, b.comebackWins],
    ['First to halfway, then won', `${a.firstToHalfWon}/${a.firstToHalf}`, `${b.firstToHalfWon}/${b.firstToHalf}`],
  ];
  const typed = rally.typedIn;
  return (
    <>
      <SectionTitle>Point by point</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {highlights.map((h, i) => {
          const color = CARD_COLORS[i % CARD_COLORS.length];
          return (
            <div key={h.label} className="rounded-2xl border border-line bg-surface px-3.5 pt-3 pb-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]" style={{ borderTop: `4px solid ${color}` }}>
              <div className="text-[10px] font-bold tracking-[0.12em] uppercase sm:text-[11px]" style={{ color }}>
                {h.label}
              </div>
              <div className="mt-1 text-lg leading-tight font-extrabold tracking-tight">{h.value}</div>
              <div className="mt-0.5 text-[12.5px] leading-snug text-muted">
                <MatchLinks text={h.detail} hrefOf={matchHref} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
        <table className="tabular w-full text-sm">
          <thead>
            <tr className="bg-surface-2/60 text-[11px] font-bold uppercase text-muted">
              <th className="px-3 py-2.5 text-left">
                <span className="sr-only">Stat</span>
              </th>
              {(['a', 'b'] as TeamKey[]).map((k) => (
                <th key={k} className="w-28 px-2 py-2.5">
                  <span className="inline-flex max-w-full items-center gap-1.5">
                    <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: sides[k].fill }} />
                    <span className="truncate">{sides[k].name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, x, y]) => (
              <tr key={label} className="border-t border-line">
                <td className="px-3 py-2">{label}</td>
                <td className="px-2 py-2 text-center font-bold">{x}</td>
                <td className="px-2 py-2 text-center font-bold">{y}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 px-1 text-[11px] text-muted">
        From the live scorer, rally by rally.{' '}
        {typed.length > 0 &&
          (typedIn === 'list' ? (
            <>
              <MatchLinks text={typed.map((m) => matchCode(m.order)).join(', ')} hrefOf={matchHref} /> {typed.length === 1 ? 'was' : 'were'} typed in, so{' '}
              {typed.length === 1 ? "it isn't" : "they aren't"} included.
            </>
          ) : (
            `${rally.flows.length} of ${rally.flows.length + typed.length} finished matches were scored live; only those are included.`
          ))}
      </p>
    </>
  );
}

export function ReportView({
  report,
  takeaways,
  inProgress,
  matchHref,
  logExtra,
  result,
  rally,
}: {
  report: SessionReport;
  takeaways: string[];
  inProgress?: boolean;
  /** Links match codes (in the takeaways, tightest contest and log) to each match's page. */
  matchHref?: MatchHref;
  /** More to show under match n in the log (its score flow). */
  logExtra?: (n: number) => ReactNode;
  /** Who won, under the title: a tournament's result. A session shows its MVP. */
  result?: ReactNode;
  /** The point-by-point section (ReportRally), after the match log. */
  rally?: ReactNode;
}) {
  const { mvp, bestPair, tightest } = report;
  const facts = [`${report.matchCount} match${report.matchCount === 1 ? '' : 'es'}`, `${report.playerCount} players`, `${report.totalPoints} points`];
  if (report.unfinishedCount) facts.push(`+${report.unfinishedCount} unfinished`);
  const headline = result ?? (mvp ? `${mvp.undefeated ? 'Undefeated MVP' : 'MVP'}: ${mvp.name} (${mvp.won}-${mvp.lost})` : null);
  return (
    <article className="overflow-hidden rounded-[1.4rem] border border-line bg-surface p-3 text-ink shadow-[var(--shadow-card)] sm:p-6">
      {/* 1. Who won */}
      <header className="court-mat relative overflow-hidden rounded-2xl px-5 py-5 sm:px-7 sm:py-6">
        <CourtLines className="inset-y-3 -right-[30%] w-[70%] text-court-ink opacity-30" />
        <span className="absolute inset-y-0 left-0 w-1.5 bg-volt" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[1.6rem] leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-4xl">{report.title}</h2>
            <p className="mt-1.5 text-xs text-court-ink/75 sm:text-sm">{report.subtitle}</p>
            {headline && <p className="mt-3 text-lg leading-tight font-extrabold text-volt sm:text-xl">{headline}</p>}
            <p className="mt-1 text-xs text-court-ink/75">{facts.join(' · ')}</p>
          </div>
          <span className="relative rounded-full bg-volt px-4 py-1.5 text-[11px] font-bold tracking-[0.1em] whitespace-nowrap text-volt-ink uppercase sm:text-xs">
            {inProgress ? 'In progress' : report.kind === 'tournament' ? 'Tournament summary' : 'Session summary'} • {report.matchCount} matches
          </span>
        </div>
      </header>

      {/* 2. Every match, with its score flow when it was scored live */}
      <SectionTitle>Complete match-by-match log ({report.log.length} games)</SectionTitle>
      <ul className="tabular divide-y divide-line rounded-xl border border-line bg-surface sm:hidden">
        {report.log.map((r) => {
          const done = r.status === 'completed';
          return (
            <li key={r.number} className={clsx('px-3 py-2.5', !done && 'bg-surface-2/40')}>
              <div className="flex items-center gap-3">
                <span className="w-9 shrink-0 text-xs font-bold">
                  <MatchCode code={r.code} n={r.number} matchHref={matchHref} />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className={clsx('flex justify-between gap-2', r.winner === 'A' && 'font-bold')}>
                    <span className="truncate">{r.team1}</span>
                    <span className={clsx(!done && 'text-muted')}>{r.scoreA ?? '–'}</span>
                  </div>
                  <div className={clsx('flex justify-between gap-2', r.winner === 'B' && 'font-bold')}>
                    <span className="truncate">{r.team2}</span>
                    <span className={clsx(!done && 'text-muted')}>
                      {r.scoreB ?? '–'}
                      {r.status === 'unfinished' && '*'}
                    </span>
                  </div>
                </div>
              </div>
              <div className={clsx('mt-1 pl-12 text-xs', r.winner ? 'text-good' : 'text-muted')}>
                {r.winnerLabel && <span className="font-bold">{r.winnerLabel} · </span>}
                <span className="text-muted">{r.context}</span>
              </div>
              {logExtra && <div className="pl-12">{logExtra(r.number)}</div>}
            </li>
          );
        })}
        {!report.log.length && <li className="px-3 py-6 text-center text-sm text-muted">No matches yet.</li>}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface sm:block">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="bg-surface-2/60 text-left text-[11px] font-bold uppercase text-muted">
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
              const extra = logExtra?.(r.number);
              return (
                <Fragment key={r.number}>
                  <tr className={clsx('border-t border-line', !done && 'bg-surface-2/40')}>
                    <td className="px-3 py-3 font-bold">
                      <MatchCode code={r.code} n={r.number} matchHref={matchHref} />
                    </td>
                    <td className={clsx('px-3 py-3', r.winner === 'A' && 'font-bold')}>{r.team1}</td>
                    <td className={clsx('tabular px-3 py-3 text-center font-bold whitespace-nowrap', !done && 'text-muted')}>
                      {r.scoreA ?? '–'} : {r.scoreB ?? '–'}
                      {r.status === 'unfinished' && '*'}
                    </td>
                    <td className={clsx('px-3 py-3', r.winner === 'B' && 'font-bold')}>{r.team2}</td>
                    <td className="px-3 py-3 font-bold text-good">{r.winnerLabel ?? <span className="text-muted">—</span>}</td>
                    <td className="px-3 py-3 text-[13px]">{r.context}</td>
                  </tr>
                  {extra && (
                    <tr>
                      <td />
                      <td colSpan={5} className="px-3 pb-3">
                        {extra}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!report.log.length && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">
                  No matches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 px-1 text-[11px] text-muted">
        {report.unfinishedCount > 0 && '* Match not completed; excluded from player standings, partnership records and totals. '}
        Margins are shown as winning score minus losing score.
      </p>

      {/* 3. Point by point */}
      {rally}

      {/* 4. Individual stats */}
      <SectionTitle>Individual stats</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          color="var(--warn)"
          highlight
          label={mvp?.undefeated ? 'Undefeated MVP' : 'MVP'}
          value={mvp ? `${mvp.name} (${mvp.won}-${mvp.lost})` : '—'}
          lines={mvp ? [mvp.line] : ['No results yet']}
        />
        <SummaryCard color="var(--teal)" label="Best partnership" value={bestPair?.label ?? '—'} lines={bestPair ? [bestPair.line] : ['Needs 2+ games together']} />
        <SummaryCard
          color="var(--orange)"
          label="Tightest contest"
          value={tightest?.score ?? '—'}
          lines={tightest ? [<MatchLinks key="t" text={tightest.line} hrefOf={matchHref} />] : ['No results yet']}
        />
      </div>

      {/* Phones: one compact row per player. Wider screens (and the PDF) get the full table. */}
      <ul className="tabular mt-4 divide-y divide-line rounded-xl border border-line bg-surface sm:hidden">
        {report.standings.map((s) => (
          <li key={s.playerId} className={clsx('flex items-center gap-3 px-3 py-2.5', !s.qualified && 'text-muted')}>
            <RankBadge rank={s.rank} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">
                {s.name}
                {s.isNew && <span className="ml-1 text-xs font-semibold text-[var(--teal)]">(New)</span>}
              </div>
              <div className="text-xs text-muted">
                {s.played} played · {oneDecimal(s.ppg)} PPG
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-surface-2">
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
        {!report.standings.length && <li className="px-3 py-6 text-center text-sm text-muted">No completed matches yet.</li>}
      </ul>
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-line bg-surface sm:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-surface-2/60 text-[11px] font-bold uppercase text-muted">
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
              <tr key={s.playerId} className={clsx('border-t border-line', !s.qualified && 'text-muted')}>
                <td className="px-3 py-2.5 text-left">
                  <RankBadge rank={s.rank} />
                </td>
                <td className="px-3 py-2.5 text-left">
                  <div className="font-bold">
                    {s.name}
                    {s.isNew && <span className="ml-1 text-xs font-semibold text-[var(--teal)]">(New)</span>}
                  </div>
                  {s.rank === 1 && mvp && <div className="text-xs font-semibold text-warn">Top performer</div>}
                  {!s.qualified && <div className="text-xs">Few games</div>}
                </td>
                <td className="px-2">{s.played}</td>
                <td className="px-2 font-bold">{s.won}</td>
                <td className="px-2 text-bad">{s.lost}</td>
                <td className="px-2">
                  <div className="mx-auto w-28">
                    <div className="h-1.5 rounded-full bg-surface-2">
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
                <td colSpan={10} className="px-3 py-6 text-muted">
                  No completed matches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h4 className="mb-3 text-[13px] font-extrabold uppercase">Partnership performance</h4>
          <ul className="tabular text-sm">
            {report.partnerships.map((p) => (
              <li key={p.pair.join('|')} className="flex items-center justify-between gap-2 border-t border-line py-2 first:border-t-0">
                <span className="min-w-0 truncate font-bold">{p.label}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-[13px]">
                    {p.won} - {p.lost} ({pctRound(p.winRate)})
                  </span>
                  <Diff value={p.diff} />
                </span>
              </li>
            ))}
            {!report.partnerships.length && <li className="text-muted">No completed matches yet.</li>}
          </ul>
        </section>
        <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h4 className="mb-3 text-[13px] font-extrabold uppercase">Key {report.kind} takeaways</h4>
          <ul className="list-disc space-y-2 pl-5 text-[13.5px] leading-relaxed marker:text-muted">
            {takeaways.map((t, i) => (
              <li key={i}>
                <Takeaway text={t} matchHref={matchHref} />
              </li>
            ))}
            {!takeaways.length && <li className="list-none text-muted">Takeaways appear once a few matches are done.</li>}
          </ul>
        </section>
      </div>

      <footer className="mt-6 flex justify-between border-t border-line pt-3 text-[11px] text-muted">
        <span>{report.footer}</span>
      </footer>
    </article>
  );
}
