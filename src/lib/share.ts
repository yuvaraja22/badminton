import { toast } from './toast';

/** WhatsApp "send to…" link (opens the app on phones, WhatsApp Web/desktop on computers). */
function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** What goes with a shared link or PDF: "Badminton · Sat, Oct 31: results and the full report" and the page's link. */
export interface ShareMessage {
  title: string;
  text: string;
  url: string;
}

/**
 * Share a link: the phone's share sheet where available (WhatsApp, Messages…), otherwise copy it
 * and offer a one-tap WhatsApp shortcut.
 */
export async function shareLink({ title, text, url }: ShareMessage) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // closed the share sheet
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied', 'success', { label: 'Send on WhatsApp', onClick: () => window.open(whatsappUrl(`${text} ${url}`), '_blank', 'noopener') });
  } catch {
    window.open(whatsappUrl(`${text} ${url}`), '_blank', 'noopener');
  }
}
