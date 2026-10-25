import type { SessionReport } from '../../lib/engine/report';
import { toast } from '../../lib/toast';
import type { ReportRally } from './ReportPdf';

export function reportFileName(report: SessionReport, date: string): string {
  return pdfFileName(report.title, date);
}

/** 'waiting': the PDF is ready and a toast offers to share it (the browser wanted a fresh tap). */
export type PdfResult = 'shared' | 'downloaded' | 'cancelled' | 'waiting';

/** "Diwali Cup" + "2026-11-01" → "Diwali_Cup_2026-11-01.pdf" (letters from any script are kept). */
export function pdfFileName(title: string, date: string): string {
  const name = title.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '');
  return `${name || 'Badminton'}_${date}.pdf`;
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
  rally?: ReportRally | null,
): Promise<PdfResult> {
  const [{ pdf }, { ReportDocument }] = await Promise.all([import('@react-pdf/renderer'), import('./ReportPdf')]);
  const blob = await pdf(<ReportDocument report={report} takeaways={takeaways} rally={rally} />).toBlob();
  return sharePdf(blob, fileName, report.title, mode);
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Share a finished PDF (the phone's share sheet, e.g. to WhatsApp) or download it. */
export async function sharePdf(blob: Blob, fileName: string, title: string, mode: 'share' | 'download'): Promise<PdfResult> {
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      const name = (e as Error).name;
      if (name === 'AbortError') return 'cancelled';
      // Building the PDF took longer than the browser allows after a tap (iPhones are strict about
      // this): offer the share sheet again from a fresh tap instead of silently downloading.
      if (name === 'NotAllowedError') {
        toast('Your PDF is ready', 'success', {
          label: 'Share it',
          onClick: () => {
            navigator.share({ files: [file], title }).catch((err: Error) => {
              if (err.name !== 'AbortError') download(blob, fileName);
            });
          },
        });
        return 'waiting';
      }
      // Anything else: fall through to a download.
    }
  }
  download(blob, fileName);
  return 'downloaded';
}
