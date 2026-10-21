import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, usingEmulators } from '../firebase';
import { toast } from '../toast';
import { AuthContext, type AuthValue } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminFor, setAdminFor] = useState<{ email: string; isAdmin: boolean } | null>(null);
  const [linkFor, setLinkFor] = useState<{ email: string; playerId: string | null } | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthLoading(false);
      }),
    [],
  );

  // Admin = an admins/{email} document exists. Listening means a newly added co-admin
  // gets edit rights without signing in again.
  const email = user?.email?.toLowerCase() ?? null;
  useEffect(() => {
    if (!email) return;
    return onSnapshot(
      doc(db, 'admins', email),
      (snap) => setAdminFor({ email, isAdmin: snap.exists() }),
      () => setAdminFor({ email, isAdmin: false }),
    );
  }, [email]);

  // Player = a links/{email} document points this Google account at a player profile.
  useEffect(() => {
    if (!email) return;
    return onSnapshot(
      doc(db, 'links', email),
      (snap) => setLinkFor({ email, playerId: snap.exists() ? String(snap.data().playerId ?? '') || null : null }),
      () => setLinkFor({ email, playerId: null }),
    );
  }, [email]);

  const value = useMemo<AuthValue>(() => {
    const adminKnown = !email || adminFor?.email === email;
    return {
      user,
      isAdmin: Boolean(email && adminFor?.email === email && adminFor.isAdmin),
      playerId: email && linkFor?.email === email ? linkFor.playerId : null,
      loading: authLoading || !adminKnown,
      signIn: async (emulatorEmail?: string) => {
        if (usingEmulators && emulatorEmail) {
          // Local testing only: the Auth emulator accepts an unsigned Google identity.
          const identity = { sub: `emu-${emulatorEmail}`, email: emulatorEmail, email_verified: true, name: emulatorEmail.split('@')[0] };
          await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify(identity)));
          return;
        }
        try {
          await signInWithPopup(auth, googleProvider);
        } catch (e) {
          const code = (e as { code?: string }).code;
          if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, googleProvider);
          } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
            toast(`Sign-in failed: ${(e as Error).message}`, 'error');
          }
        }
      },
      signOut: () => fbSignOut(auth),
    };
  }, [user, email, adminFor, linkFor, authLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
