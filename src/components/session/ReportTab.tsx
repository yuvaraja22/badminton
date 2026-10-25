import { useMemo, useState } from 'react';
import { Download, Link2, PenLine, Share2 } from 'lucide-react';
import { useData } from '../../lib/data/context';
import { updateTakeaways } from '../../lib/data/mutations';
import { useSessionReport } from '../../lib/data/useSessionReport';
import { sessionRallyGames, sortedMatches } from '../../lib/engine/games';
import { rallySummary } from '../../lib/engine/rally';
import { SESSION_SIDES } from '../../lib/teamColors';
import { toast } from '../../lib/toast';
import type { Session } from '../../lib/types';
import { exportReportPdf, reportFileName } from '../report/exportPdf';
import { RallyCard } from '../report/RallyCard';
import { ReportView } from '../report/ReportView';
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
  const [busy, setBusy] = useState<'share' | 'download' | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const live = session.status === 'live';

  const exportPdf = async (mode: 'share' | 'download') => {
    setBusy(mode);
    try {
      const result = await exportReportPdf(report, takeaways, reportFileName(report, session.date), mode, rally.flows.length ? { summary: rally, sides: SESSION_SIDES, nameOf } : null);
      if (result === 'downloaded') toast('PDF downloaded', 'success');
    } catch (e) {
      toast(`Couldn't create the PDF: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/sessions/${session.id}?tab=report`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied', 'success');
    } catch {
      toast(url);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => exportPdf('share')} disabled={busy !== null}>
          <Share2 size={16} /> {busy === 'share' ? 'Preparing…' : 'Share PDF'}
        </Button>
        <Button variant="secondary" onClick={() => exportPdf('download')} disabled={busy !== null}>
          <Download size={16} /> {busy === 'download' ? 'Preparing…' : 'Download'}
        </Button>
        <Button variant="secondary" onClick={copyLink}>
          <Link2 size={16} /> Copy link
        </Button>
        {isAdmin && (
          <Button variant="ghost" onClick={() => setEditOpen(true)}>
            <PenLine size={16} /> Edit takeaways
          </Button>
        )}
      </div>
      {live && <Notice>Session in progress: this is the report so far. It updates as results come in.</Notice>}
      <RallyCard
        rally={rally}
        sides={SESSION_SIDES}
        nameOf={nameOf}
        hrefOf={hrefOf}
        subtitle="From matches scored live, point by point. Each one's score flow is in the match log below."
        typedIn="count"
      />
      <ReportView report={report} takeaways={takeaways} inProgress={live} matchHref={hrefOf} logExtra={flowOf} />
      <TakeawaysDialog open={editOpen} onClose={() => setEditOpen(false)} session={session} auto={report.autoTakeaways} />
    </div>
  );
}
