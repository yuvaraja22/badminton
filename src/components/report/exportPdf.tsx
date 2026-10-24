import type { SessionReport } from '../../lib/engine/report';

export function reportFileName(report: SessionReport, date: string): string {
  return pdfFileName(report.title, date);
}

export type PdfResult = 'shared' | 'downloaded' | 'cancelled';

/** "Diwali Cup" + "2026-11-01" → "Diwali_Cup_2026-11-01.pdf" */
export function pdfFileName(title: string, date: string): string {
  return `${title.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '')}_${date}.pdf`;
}

/**
 * Builds the PDF in the browser (the renderer is loaded only when needed). On phones the share
 * sheet opens so the file can go straight to WhatsApp; elsewhere it downloads.
 */
export async function exportReportPdf(report: SessionReport, takeaways: string[], fileName: string, mode: 'share' | 'download'): Promise<PdfResult> {
  const [{ pdf }, { ReportDocument }] = await Promise.all([import('@react-pdf/renderer'), import('./ReportPdf')]);
  const blob = await pdf(<ReportDocument report={report} takeaways={takeaways} />).toBlob();
  return sharePdf(blob, fileName, report.title, mode);
}

/** Share a finished PDF (the phone's share sheet, e.g. to WhatsApp) or download it. */
export async function sharePdf(blob: Blob, fileName: string, title: string, mode: 'share' | 'download'): Promise<PdfResult> {
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
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
