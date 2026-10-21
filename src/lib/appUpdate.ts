/**
 * Keep every phone on the latest version without an "Update" button:
 * - pages always load from the network when online (see the service worker config in vite.config.ts),
 *   so opening the app shows the newest deploy straight away;
 * - an app left open in the background checks for a newer deploy when it comes back to the
 *   foreground and reloads (unless someone is typing);
 * - if a deploy removed a file an old page still needs, reload instead of failing.
 */
export function startAppUpdates() {
  if (!import.meta.env.PROD) return;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline support is a bonus; the app works without it.
      });
    });
  }

  window.addEventListener('vite:preloadError', () => window.location.reload());

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) return;
      const { id } = (await res.json()) as { id?: string };
      const active = document.activeElement;
      const typing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
      if (id && id !== __BUILD_ID__ && !typing) window.location.reload();
    } catch {
      // Offline: try again next time.
    }
  });
}
