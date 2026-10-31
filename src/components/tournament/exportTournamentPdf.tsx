import type { ShareMessage } from '../../lib/share';
import type { PlayerId, Tournament } from '../../lib/types';
import { pdfFileName, sharePdf, type PdfResult } from '../report/exportPdf';

/** The tournament's schedule (with results once played) as a PDF: shared on phones, downloaded elsewhere. */
export async function exportTournamentPdf(t: Tournament, nameOf: (id: PlayerId) => string, message: ShareMessage, mode: 'share' | 'download'): Promise<PdfResult> {
  const [{ pdf }, { TournamentDocument }] = await Promise.all([import('@react-pdf/renderer'), import('./TournamentPdf')]);
  const blob = await pdf(<TournamentDocument t={t} nameOf={nameOf} />).toBlob();
  return sharePdf(blob, pdfFileName(t.name, t.date), message, mode);
}
