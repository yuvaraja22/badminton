import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-badminton',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/admin@example.com'), { addedAt: 1 });
    await setDoc(doc(db, 'players/p1'), { name: 'Vikram', level: 5, active: true });
    await setDoc(doc(db, 'sessions/s1'), { title: 'Sunday Badminton Tournament', status: 'live', matches: {} });
    await setDoc(doc(db, 'meta/history'), { sessions: {} });
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const anon = () => env.unauthenticatedContext().firestore();
const viewer = () => env.authenticatedContext('viewer', { email: 'viewer@example.com', email_verified: true }).firestore();
const admin = () => env.authenticatedContext('admin', { email: 'admin@example.com', email_verified: true }).firestore();
// Someone who signed up with the admin's address but never verified it.
const impostor = () => env.authenticatedContext('impostor', { email: 'admin@example.com', email_verified: false }).firestore();

describe('firestore.rules', () => {
  it('lets anyone read players, sessions and stats', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'players/p1')));
    await assertSucceeds(getDocs(collection(anon(), 'players')));
    await assertSucceeds(getDoc(doc(anon(), 'sessions/s1')));
    await assertSucceeds(getDoc(doc(anon(), 'meta/history')));
  });

  it('blocks writes from signed-out users and non-admins', async () => {
    for (const db of [anon(), viewer()]) {
      await assertFails(setDoc(doc(db, 'players/x'), { name: 'X', level: 3 }));
      await assertFails(updateDoc(doc(db, 'players/p1'), { level: 1 }));
      await assertFails(updateDoc(doc(db, 'sessions/s1'), { status: 'completed' }));
      await assertFails(setDoc(doc(db, 'meta/history'), { sessions: {} }));
      await assertFails(deleteDoc(doc(db, 'sessions/s1')));
    }
  });

  it('lets admins write', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'players/p2'), { name: 'Anu', level: 3, active: true }));
    await assertSucceeds(updateDoc(doc(admin(), 'sessions/s1'), { 'matches.m1': { number: 1 } }));
    await assertSucceeds(setDoc(doc(admin(), 'meta/config'), { groupName: 'Badminton Tournament' }));
  });

  it('does not trust an unverified email', async () => {
    await assertFails(setDoc(doc(impostor(), 'players/p3'), { name: 'Hacker', level: 5 }));
  });

  it('keeps the admin list private', async () => {
    await assertFails(getDocs(collection(anon(), 'admins')));
    await assertFails(getDocs(collection(viewer(), 'admins')));
    await assertFails(getDoc(doc(viewer(), 'admins/admin@example.com')));
    // Everyone may check their own entry (that's how the app knows who is an admin).
    await assertSucceeds(getDoc(doc(viewer(), 'admins/viewer@example.com')));
    await assertSucceeds(getDocs(collection(admin(), 'admins')));
  });

  it('only admins can add admins, using lowercase emails', async () => {
    await assertFails(setDoc(doc(viewer(), 'admins/viewer@example.com'), { addedAt: 2 }));
    await assertSucceeds(setDoc(doc(admin(), 'admins/friend@example.com'), { addedAt: 2 }));
    await assertFails(setDoc(doc(admin(), 'admins/Friend@Example.com'), { addedAt: 2 }));
  });
});
