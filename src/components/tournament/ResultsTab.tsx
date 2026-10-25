import { useMemo } from 'react';
import { useData } from '../../lib/data/context';
import { matchPath, teamScore, tournamentRally, tournamentReport } from '../../lib/engine/tournament';
import { tournamentSides } from '../../lib/teamColors';
import type { Tournament } from '../../lib/types';
import { RallyCard } from '../report/RallyCard';
import { ReportView } from '../report/ReportView';
import { Empty } from '../ui/Card';
import { ScoreFlow } from './ScoreFlow';

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
    return f ? <ScoreFlow sides={sides} flow={f} paper /> : null;
  };

  return (
    <div className="space-y-4">
      {/* The result itself is in the score bar above the tabs. */}
      {s.played === 0 && <Empty title="No results yet">They appear here once the first match is finished.</Empty>}

      <RallyCard
        rally={rally}
        sides={sides}
        nameOf={nameOf}
        hrefOf={hrefOf}
        subtitle="From the live scorer, rally by rally. Each match's score flow is in the match log below."
        typedIn="list"
      />

      {s.played > 0 && <ReportView report={report} takeaways={report.autoTakeaways} inProgress={t.status !== 'completed'} matchHref={hrefOf} logExtra={flowOf} />}
    </div>
  );
}
