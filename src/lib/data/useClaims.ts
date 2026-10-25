import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { LinkClaim } from '../types';
import { toClaim } from './convert';

/** "This is me" requests waiting for an admin, oldest first (admins only; null while loading). */
export function useLinkClaims(enabled: boolean): LinkClaim[] | null {
  const [claims, setClaims] = useState<LinkClaim[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      collection(db, 'claims'),
      (snap) =>
        setClaims(
          snap.docs
            .map((d) => toClaim(d.id, d.data()))
            .filter((c): c is LinkClaim => c !== null)
            .sort((a, b) => a.at - b.at),
        ),
      () => setClaims([]),
    );
  }, [enabled]);
  return enabled ? claims : null;
}
