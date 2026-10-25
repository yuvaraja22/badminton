import { useEffect } from 'react';
import { pendingWrites, subscribeSync } from './sync';

/**
 * Keep every phone on the latest version without an "Update" button:
 * - pages always load from the network when online (see the service worker config in vite.config.ts),
 *   so opening the app shows the newest deploy straight away;
 * - an app left open checks for a newer deploy when it comes back to the foreground or its window
 *   regains focus, and every 10 minutes, and reloads at a safe moment: not while someone is typing,
 *   scoring a match, has a dialog open or has changes still waiting to sync (see useHoldUpdates);
 * - if a deploy removed a file an old page still needs, reload instead of failing.
 */

/** Screens that must not be reloaded right now (a live scorer, an open dialog, unsaved scores). */
const holds = new Set<symbol>();
/** A newer deploy is out; reload as soon as nothing holds it back. */
let updateReady = false;

function typing(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
}

function reloadIfSafe() {
  if (!updateReady || holds.size > 0 || pendingWrites() > 0 || typing() || document.visibilityState !== 'visible') return;
  window.location.reload();
}

/** While `active`, a newer version waits instead of reloading the page (it reloads once released). */
export function useHoldUpdates(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const hold = Symbol('hold');
    holds.add(hold);
    return () => {
      holds.delete(hold);
      // Let the screen finish closing first.
      window.setTimeout(reloadIfSafe, 1000);
    };
  }, [active]);
}

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

  const check = async () => {
    if (document.visibilityState !== 'visible') return;
    if (!updateReady) {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const { id } = (await res.json()) as { id?: string };
        updateReady = Boolean(id && id !== __BUILD_ID__);
      } catch {
        // Offline: try again next time.
        return;
      }
    }
    reloadIfSafe();
  };
  // Phones: back to the app. Laptops: back to the window (the tab often never goes hidden), or a tab left open.
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  window.setInterval(check, 10 * 60_000);
  // Typing finished, or the last change synced: a waiting update can go ahead.
  document.addEventListener('focusout', () => window.setTimeout(reloadIfSafe, 1000));
  subscribeSync(() => window.setTimeout(reloadIfSafe, 1000));
}
