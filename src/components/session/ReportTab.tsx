import { useMemo, useState } from 'react';
import { PenLine } from 'lucide-react';
import { useData } from '../../lib/data/context';
import { updateTakeaways } from '../../lib/data/mutations';
import { useSessionReport } from '../../lib/data/useSessionReport';
import { sessionRallyGames, sortedMatches } from '../../lib/engine/games';
import { rallySummary } from '../../lib/engine/rally';
import { SESSION_SIDES } from '../../lib/teamColors';
import type { Session } from '../../lib/types';
import { ReportRally, ReportView } from '../report/ReportView';
import { ScoreFlow } from '../tournament/ScoreFlow';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Textarea } from '../ui/Field';

function TakeawaysDialog({ open, onClose, session, auto }: { open: boolean; onClose: () => void; session: Session; auto: string[] }) {
  return (
    <Dialog open={open} onClose={onClose} title="Edit takeaways">
      {open && <TakeawaysForm session={session} auto={auto} onDone={onClose} />}
    </Dialog>
  );
}

function TakeawaysForm({ session, auto, onDone }: { session: Session; auto: string[]; onDone: () => void }) {
  const [text, setText] = useState((session.takeaways ?? auto).join('\n'));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">One takeaway per line. Text before the first colon is shown in bold, e.g. “Nail-Biters: …”.</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className="text-sm" />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setText(auto.join('\n'))}>
          Use automatic
        </Button>
        <Button
          className="ml-auto"
          onClick={() => {
            const lines = text
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean);
            // While a session is live, matching the automatic text means "keep generating".
            const same = lines.join('\n') === auto.join('\n');
            updateTakeaways(session, same && session.status === 'live' ? null : lines);
            onDone();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

/**
 * The session's report, in the same order as a tournament's results: its MVP, every match (with its
 * score flow when scored live), point by point, then the individual stats. Sharing is in the header.
 */
export function ReportTab({ session, isAdmin }: { session: Session; isAdmin: boolean }) {
  const { nameOf } = useData();
  const report = useSessionReport(session);
  // Matches scored live point by point (if any): highlights, and each one's score flow in the log.
  const rally = useMemo(() => rallySummary(sessionRallyGames(session)), [session]);
  const byNumber = new Map(sortedMatches(session).map((m) => [m.number, m]));
  const hrefOf = (n: number) => {
    const m = byNumber.get(n);
    return m ? `/sessions/${session.id}/matches/${m.id}` : null;
  };
  const flowOf = (n: number) => {
    const f = rally.flows.find((x) => x.match.order === n);
    return f ? <ScoreFlow sides={SESSION_SIDES} flow={f} paper /> : null;
  };
  const takeaways = session.takeaways ?? report.autoTakeaways;
  const [editOpen, setEditOpen] = useState(false);
  const live = session.status === 'live';

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            <PenLine size={15} /> Edit takeaways
          </Button>
        </div>
      )}
      {live && <Notice>Session in progress: this is the report so far. It updates as results come in.</Notice>}
      <ReportView
        report={report}
        takeaways={takeaways}
        inProgress={live}
        matchHref={hrefOf}
        logExtra={flowOf}
        rally={<ReportRally rally={rally} sides={SESSION_SIDES} nameOf={nameOf} matchHref={hrefOf} typedIn="count" />}
      />
      <TakeawaysDialog open={editOpen} onClose={() => setEditOpen(false)} session={session} auto={report.autoTakeaways} />
    </div>
  );
}
