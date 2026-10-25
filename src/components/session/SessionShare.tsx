import { useMemo, useState } from 'react';
import { Download, FileText, Link2, Share2 } from 'lucide-react';
import { useData } from '../../lib/data/context';
import { useSessionReport } from '../../lib/data/useSessionReport';
import { sessionRallyGames } from '../../lib/engine/games';
import { rallySummary } from '../../lib/engine/rally';
import { shareLink } from '../../lib/share';
import { SESSION_SIDES } from '../../lib/teamColors';
import { toast } from '../../lib/toast';
import type { Session } from '../../lib/types';
import { exportReportPdf, reportFileName } from '../report/exportPdf';
import { Menu } from '../ui/Menu';

/** Share, as on a tournament: the link (opens the session in the app), the report as a PDF, or a download. */
export function SessionShareMenu({ session }: { session: Session }) {
  const { nameOf } = useData();
  const report = useSessionReport(session);
  const rally = useMemo(() => rallySummary(sessionRallyGames(session)), [session]);
  const [busy, setBusy] = useState(false);
  const live = session.status === 'live';

  const exportPdf = async (mode: 'share' | 'download') => {
    setBusy(true);
    try {
      const takeaways = session.takeaways ?? report.autoTakeaways;
      const result = await exportReportPdf(report, takeaways, reportFileName(report, session.date), mode, rally.flows.length ? { summary: rally, sides: SESSION_SIDES, nameOf } : null);
      if (result === 'downloaded') toast('PDF downloaded', 'success');
    } catch (e) {
      toast(`Couldn't create the PDF: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Menu
      label="Share"
      triggerClassName="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold hover:bg-surface-2 disabled:opacity-50"
      trigger={
        <>
          <Share2 size={16} /> {busy ? 'Preparing…' : 'Share'}
        </>
      }
      items={[
        {
          label: 'Share link',
          icon: <Link2 size={16} />,
          onClick: () =>
            shareLink({
              title: session.title,
              text: `${session.title}: ${live ? 'live scores and the report so far' : 'results and the full report'}`,
              url: `${window.location.origin}/sessions/${session.id}`,
            }),
        },
        { label: 'Share report PDF', icon: <FileText size={16} />, onClick: () => !busy && exportPdf('share') },
        { label: 'Download report PDF', icon: <Download size={16} />, onClick: () => !busy && exportPdf('download') },
      ]}
    />
  );
}
