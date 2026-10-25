import { useMemo } from 'react';
import { useData } from '../../lib/data/context';
import { matchPath, resultLine, teamScore, tournamentRally, tournamentReport } from '../../lib/engine/tournament';
import { tournamentSides } from '../../lib/teamColors';
import type { Tournament } from '../../lib/types';
import { ReportRally, ReportView } from '../report/ReportView';
import { Empty } from '../ui/Card';
import { ScoreFlow } from './ScoreFlow';

/** The tournament's report: who won, every match with its score flow, point by point, then the individual stats. */
export function ResultsTab({ t }: { t: Tournament }) {
  const { nameOf } = useData();
  const s = teamScore(t);
  const rally = useMemo(() => tournamentRally(t), [t]);
  const sides = useMemo(() => tournamentSides(t), [t]);
  const report = useMemo(() => tournamentReport(t, nameOf), [t, nameOf]);
  const hrefOf = (n: number) => matchPath(t, n);
  // Each match in the log gets its score flow (live-scored matches only).
  const flowOf = (n: number) => {
    const f = rally.flows.find((x) => x.match.order === n);
    return f ? <ScoreFlow sides={sides} flow={f} /> : null;
  };

  if (s.played === 0) return <Empty title="No results yet">They appear here once the first match is finished.</Empty>;
  return (
    <ReportView
      report={report}
      takeaways={report.autoTakeaways}
      inProgress={t.status !== 'completed'}
      result={resultLine(t)}
      matchHref={hrefOf}
      logExtra={flowOf}
      rally={<ReportRally rally={rally} sides={sides} nameOf={nameOf} matchHref={hrefOf} typedIn="list" />}
    />
  );
}
