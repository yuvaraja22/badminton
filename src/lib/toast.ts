export type ToastKind = 'info' | 'success' | 'error';

export interface ToastMessage {
  id: number;
  message: string;
  kind: ToastKind;
  action?: { label: string; onClick: () => void };
}

type Listener = (t: ToastMessage) => void;

const listeners = new Set<Listener>();
let seq = 0;

/** Show a short message at the bottom of the screen (usable outside React, e.g. from data writes). */
export function toast(message: string, kind: ToastKind = 'info', action?: ToastMessage['action']) {
  const t: ToastMessage = { id: ++seq, message, kind, action };
  for (const l of listeners) l(t);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
