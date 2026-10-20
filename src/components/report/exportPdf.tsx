import type { SessionReport } from '../../lib/engine/report';

export function reportFileName(report: SessionReport, date: string): string {
  return `${report.title.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '')}_${date}.pdf`;
}

/**
 * Builds the PDF in the browser (the renderer is loaded only when needed). On phones the share
 * sheet opens so the file can go straight to WhatsApp; elsewhere it downloads.
 */
export async function exportReportPdf(
  report: SessionReport,
  takeaways: string[],
  fileName: string,
  mode: 'share' | 'download',
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const [{ pdf }, { ReportDocument }] = await Promise.all([import('@react-pdf/renderer'), import('./ReportPdf')]);
  const blob = await pdf(<ReportDocument report={report} takeaways={takeaways} />).toBlob();
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: report.title });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // Fall through to a download if sharing isn't possible.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}
