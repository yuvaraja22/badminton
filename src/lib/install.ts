import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * "Install app" support. Chromium browsers (Android Chrome, desktop Chrome/Edge) fire
 * `beforeinstallprompt`, which we keep so our own button can open the native prompt.
 * Safari has no prompt, so the UI shows Add to Home Screen / Add to Dock steps instead.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  for (const l of listeners) l();
}

// Registered at import time (main.tsx imports this early) because the event can fire before React renders.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // we show our own Install button instead of the browser's banner
  deferred = e as BeforeInstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  installedNow = true;
  deferred = null;
  notify();
});

export type InstallPlatform = 'ios' | 'android' | 'mac-safari' | 'desktop';

function installPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, so also check for touch.
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua)) return 'mac-safari';
  return 'desktop';
}

/** Already running as an installed app (home-screen icon, dock or app window). */
function runningInstalled(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** Open the browser's install prompt. Returns 'unavailable' when the browser didn't offer one. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null; // each prompt event can only be used once
  notify();
  await e.prompt();
  return (await e.userChoice).outcome;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstall() {
  useSyncExternalStore(subscribe, () => version);
  return {
    canPrompt: deferred !== null,
    installed: installedNow || runningInstalled(),
    platform: installPlatform(),
  };
}

/**
 * In Chrome on Android with the app also installed (Chrome tells from the manifest's related_applications).
 * Links from WhatsApp and the like open here, in the browser, unless the phone is set to open them in the app.
 */
export function useInstalledElsewhere(): boolean {
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
    if (installPlatform() !== 'android' || runningInstalled() || !nav.getInstalledRelatedApps) return;
    let live = true;
    nav
      .getInstalledRelatedApps()
      .then((apps) => live && setInstalled(apps.length > 0))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return installed;
}
