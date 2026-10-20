import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const env = import.meta.env;

export const usingEmulators = env.VITE_USE_EMULATORS === 'true';
export const firebaseConfigured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID);

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'missing',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'missing',
  appId: env.VITE_FIREBASE_APP_ID,
});

/**
 * Firestore with an on-device cache: the app keeps working courtside without signal and
 * queued writes sync once the phone is back online.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

if (usingEmulators) {
  // Use the page's host so a phone on the same Wi-Fi can reach the emulators on this computer.
  const host = window.location.hostname || '127.0.0.1';
  connectFirestoreEmulator(db, host, 8080);
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
}
