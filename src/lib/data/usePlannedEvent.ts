import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { PlannedSession } from '../types';
import { toPlanned } from './convert';

interface PlanState {
  id: string | undefined;
  plan: PlannedSession | null;
  error: string | null;
}

/** Live view of one planned session or tournament, whatever became of it (an invite link outlives the plan). */
export function usePlannedEvent(id: string | undefined) {
  const [state, setState] = useState<PlanState>({ id: undefined, plan: null, error: null });

  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, 'events', id),
      (snap) => setState({ id, plan: snap.exists() ? toPlanned(snap.id, snap.data()) : null, error: null }),
      (e) => setState({ id, plan: null, error: e.message }),
    );
  }, [id]);

  const current = state.id === id;
  return {
    plan: current ? state.plan : null,
    loading: !current,
    error: current ? state.error : null,
  };
}
