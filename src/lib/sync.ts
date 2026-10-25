import { useSyncExternalStore } from 'react';

/**
 * Whether this phone's changes have reached the server. Writes land in the on-device cache at once
 * and are sent in the background (offline they wait until there is signal again), so "saved here" and
 * "saved for everyone" can differ for a while. Every write goes through trackWrite (see mutations).
 */

export type SyncState = 'idle' | 'saving' | 'waiting' | 'saved' | 'offline';

export interface SyncStatus {
  state: SyncState;
  /** Changes made on this phone that the server hasn't confirmed yet. */
  pending: number;
}

/** Show "Saving…" only when a write takes longer than this (most finish well within it). */
const SLOW_MS = 1500;
/** Still not through after this long: most likely no usable signal, even if the phone says it's online. */
const STUCK_MS = 10_000;
/** How long "Saved" stays up after a slow save finally goes through. */
const SAVED_MS = 2500;

const hasWindow = typeof window !== 'undefined';
let pending = 0;
let online = hasWindow ? navigator.onLine : true;
let slow = false;
let stuck = false;
let saved = false;
let timers: number[] = [];
const listeners = new Set<() => void>();
let snapshot: SyncStatus = { state: 'idle', pending: 0 };

function stateNow(): SyncState {
  if (!online) return 'offline';
  if (stuck) return 'waiting';
  if (slow) return 'saving';
  if (saved) return 'saved';
  return 'idle';
}

function notify() {
  const state = stateNow();
  if (state !== snapshot.state || pending !== snapshot.pending) snapshot = { state, pending };
  for (const l of listeners) l();
}

function clearTimers() {
  for (const t of timers) window.clearTimeout(t);
  timers = [];
}

function writeStarted() {
  pending += 1;
  if (pending === 1 && hasWindow) {
    saved = false;
    clearTimers();
    timers.push(
      window.setTimeout(() => {
        slow = true;
        notify();
      }, SLOW_MS),
      window.setTimeout(() => {
        stuck = true;
        notify();
      }, STUCK_MS),
    );
  }
  notify();
}

function writeFinished() {
  pending = Math.max(0, pending - 1);
  if (pending === 0 && hasWindow) {
    clearTimers();
    // Only confirm saves the person may have been waiting on.
    if (slow || stuck) {
      saved = true;
      timers.push(
        window.setTimeout(() => {
          saved = false;
          notify();
        }, SAVED_MS),
      );
    }
    slow = false;
    stuck = false;
  }
  notify();
}

/** Count a write as pending until the server confirms (or rejects) it. Returns the same promise. */
export function trackWrite<T>(p: Promise<T>): Promise<T> {
  writeStarted();
  p.then(writeFinished, writeFinished);
  return p;
}

export function pendingWrites(): number {
  return pending;
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (hasWindow) {
  window.addEventListener('online', () => {
    online = true;
    notify();
  });
  window.addEventListener('offline', () => {
    online = false;
    notify();
  });
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSync, () => snapshot);
}
