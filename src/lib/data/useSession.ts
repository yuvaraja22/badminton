import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Session } from '../types';
import { toSession } from './convert';

interface SessionState {
  id: string | undefined;
  session: Session | null;
  error: string | null;
}

/** Live view of one session document; every device sees edits as they happen. */
export function useSession(id: string | undefined) {
  const [state, setState] = useState<SessionState>({ id: undefined, session: null, error: null });

  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, 'sessions', id),
      (snap) => setState({ id, session: snap.exists() ? toSession(snap.id, snap.data()) : null, error: null }),
      (e) => setState({ id, session: null, error: e.message }),
    );
  }, [id]);

  const current = state.id === id;
  return {
    session: current ? state.session : null,
    loading: !current,
    error: current ? state.error : null,
  };
}
