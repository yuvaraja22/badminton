import { useMemo } from 'react';
import { useData } from '../../lib/data/context';
import { COMEBACK_MIN, rallyHighlights, rallySummary, type RallySummary } from '../../lib/engine/rally';
import { matchPath, teamScore, tournamentReport } from '../../lib/engine/tournament';
import { matchCode } from '../../lib/format';
import { teamName } from '../../lib/teamColors';
import type { Tournament } from '../../lib/types';
import { MatchLinks } from '../report/MatchLinks';
import { ReportView } from '../report/ReportView';
import { Card, CardHeader, Empty } from '../ui/Card';
import { ScoreFlow } from './ScoreFlow';
import { TeamDot } from './TeamBits';

/** Each team side by side on the point-by-point numbers. */
function TeamRallyTable({ t, r }: { t: Tournament; r: RallySummary }) {
  const { a, b } = r.teams;
  const rows: [string, string | number, string | number][] = [
    ['Longest run', a.longestRun, b.longestRun],
    ['Biggest lead', a.biggestLead, b.biggestLead],
    ['Game points saved', a.gamePointsSaved, b.gamePointsSaved],
    [`Wins from ${COMEBACK_MIN}+ down`, a.comebackWins, b.comebackWins],
    ['First to halfway, then won', `${a.firstToHalfWon}/${a.firstToHalf}`, `${b.firstToHalfWon}/${b.firstToHalf}`],
  ];
  return (
    <table className="tabular w-full text-sm">
      <thead>
        <tr className="text-xs text-muted">
          <th className="px-4 py-1.5 text-left font-semibold">
            <span className="sr-only">Stat</span>
          </th>
          {(['a', 'b'] as const).map((k) => (
            <th key={k} className="w-24 px-2 py-1.5 font-semibold">
              <span className="inline-flex max-w-full items-center gap-1.5">
                <TeamDot t={t} team={k} />
                <span className="truncate">{teamName(t, k)}</span>
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map(([label, x, y]) => (
          <tr key={label}>
            <td className="px-4 py-2">{label}</td>
            <td className="px-2 py-2 text-center font-semibold">{x}</td>
            <td className="px-2 py-2 text-center font-semibold">{y}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ResultsTab({ t }: { t: Tournament }) {
  const { nameOf } = useData();
  const s = teamScore(t);
  const rally = useMemo(() => rallySummary(t), [t]);
  const highlights = useMemo(() => rallyHighlights(t, rally, nameOf), [t, rally, nameOf]);
  const report = useMemo(() => tournamentReport(t, nameOf), [t, nameOf]);
  const hrefOf = (n: number) => matchPath(t, n);
  // Each match in the log gets its score flow (live-scored matches only).
  const flowOf = (n: number) => {
    const f = rally.flows.find((x) => x.match.order === n);
    return f ? <ScoreFlow t={t} flow={f} paper /> : null;
  };

  return (
    <div className="space-y-4">
      {/* The result itself is in the score bar above the tabs. */}
      {s.played === 0 && <Empty title="No results yet">They appear here once the first match is finished.</Empty>}

      {rally.flows.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Point by point" subtitle="From the live scorer, rally by rally. Each match's score flow is in the match log below." />
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            {highlights.map((h) => (
              <div key={h.label} className="rounded-2xl border border-line bg-surface-2/50 px-3.5 py-3">
                <div className="kicker">{h.label}</div>
                <div className="mt-1 text-lg leading-tight font-extrabold tracking-tight">{h.value}</div>
                <div className="mt-0.5 text-sm text-muted">
                  <MatchLinks text={h.detail} hrefOf={hrefOf} />
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-line pt-2">
            <TeamRallyTable t={t} r={rally} />
          </div>
          {rally.typedIn.length > 0 && (
            <p className="border-t border-line px-4 py-3 text-xs text-muted">
              <MatchLinks text={rally.typedIn.map((m) => matchCode(m.order)).join(', ')} hrefOf={hrefOf} /> {rally.typedIn.length === 1 ? 'was' : 'were'} typed in, so{' '}
              {rally.typedIn.length === 1 ? "it isn't" : "they aren't"} in the point-by-point numbers.
            </p>
          )}
        </Card>
      )}

      {s.played > 0 && <ReportView report={report} takeaways={report.autoTakeaways} inProgress={t.status !== 'completed'} matchHref={hrefOf} logExtra={flowOf} />}
    </div>
  );
}
