import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

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
    await setDoc(doc(db, 'players/p2'), { name: 'Anu', level: 4, active: true });
    await setDoc(doc(db, 'links/vikram@example.com'), { playerId: 'p1' });
    await setDoc(doc(db, 'events/e1'), { date: '2026-10-26', status: 'planned', rsvps: {} });
    // Leaving early: Vikram (p1) and Anu (p2) are playing; Uppli (p3) is linked but not in the session.
    const attendee = (order: number) => ({ level: 3, status: 'available', since: 0, catchUp: [], order });
    await setDoc(doc(db, 'players/p3'), { name: 'Uppli', level: 2, active: true });
    await setDoc(doc(db, 'links/uppli@example.com'), { playerId: 'p3' });
    await setDoc(doc(db, 'sessions/live1'), { status: 'live', title: 'Today', attendees: { p1: attendee(0), p2: attendee(1) }, matches: {} });
    await setDoc(doc(db, 'sessions/done1'), { status: 'completed', title: 'Last week', attendees: { p1: attendee(0) }, matches: {} });
  });
});

afterAll(async () => {
  await env?.cleanup();
});

const anon = () => env.unauthenticatedContext().firestore();
const viewer = () => env.authenticatedContext('viewer', { email: 'viewer@example.com', email_verified: true }).firestore();
const admin = () => env.authenticatedContext('admin', { email: 'admin@example.com', email_verified: true }).firestore();
// Vikram's Google account, linked to players/p1 by an admin.
const vikram = () => env.authenticatedContext('vikram', { email: 'vikram@example.com', email_verified: true }).firestore();
// Someone who signed up with the admin's address but never verified it.
const uppli = () => env.authenticatedContext('uppli', { email: 'uppli@example.com', email_verified: true }).firestore();
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

  it('lets a linked player edit their own profile fields', async () => {
    await assertSucceeds(updateDoc(doc(vikram(), 'players/p1'), { bio: 'Smash first', hand: 'right', position: 'back', racket: 'Astrox 88D' }));
    await assertSucceeds(updateDoc(doc(vikram(), 'players/p1'), { name: 'Vikram K', photo: 'data:image/jpeg;base64,abc' }));
    await assertSucceeds(updateDoc(doc(vikram(), 'players/p1'), { bio: null, racket: null }));
  });

  it('keeps levels, other players and oversized values out of reach', async () => {
    await assertFails(updateDoc(doc(vikram(), 'players/p1'), { level: 5.5 }));
    await assertFails(updateDoc(doc(vikram(), 'players/p1'), { active: false }));
    await assertFails(updateDoc(doc(vikram(), 'players/p2'), { bio: 'not me' }));
    await assertFails(updateDoc(doc(vikram(), 'players/p1'), { bio: 'x'.repeat(161) }));
    await assertFails(updateDoc(doc(vikram(), 'players/p1'), { hand: 'both' }));
    await assertFails(updateDoc(doc(vikram(), 'players/p1'), { name: '   ' }));
    await assertFails(updateDoc(doc(viewer(), 'players/p1'), { bio: 'hi' }));
    await assertFails(setDoc(doc(vikram(), 'sessions/s2'), { title: 'Mine' }));
  });

  it('lets a linked player RSVP only for themselves', async () => {
    await assertSucceeds(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p1': { status: 'in', at: 1 } }));
    await assertSucceeds(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p1': { status: 'out', at: 2 } }));
    await assertFails(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p2': { status: 'in', at: 3 } }));
    await assertFails(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p1': { status: 'maybe', at: 4 } }));
    await assertFails(updateDoc(doc(vikram(), 'events/e1'), { date: '2026-10-27' }));
    await assertFails(updateDoc(doc(viewer(), 'events/e1'), { 'rsvps.p2': { status: 'in', at: 5 } }));
    await assertSucceeds(updateDoc(doc(admin(), 'events/e1'), { note: 'Court 2' }));
  });

  it('keeps player links private and admin-managed', async () => {
    await assertSucceeds(getDoc(doc(vikram(), 'links/vikram@example.com')));
    await assertFails(getDoc(doc(viewer(), 'links/vikram@example.com')));
    await assertFails(getDocs(collection(vikram(), 'links')));
    await assertFails(setDoc(doc(vikram(), 'links/vikram@example.com'), { playerId: 'p2' }));
    await assertSucceeds(setDoc(doc(admin(), 'links/anu@example.com'), { playerId: 'p2' }));
    await assertFails(setDoc(doc(admin(), 'links/Anu@Example.com'), { playerId: 'p2' }));
    await assertSucceeds(getDocs(collection(admin(), 'links')));
  });

  it('only admins can add admins, using lowercase emails', async () => {
    await assertFails(setDoc(doc(viewer(), 'admins/viewer@example.com'), { addedAt: 2 }));
    await assertSucceeds(setDoc(doc(admin(), 'admins/friend@example.com'), { addedAt: 2 }));
    await assertFails(setDoc(doc(admin(), 'admins/Friend@Example.com'), { addedAt: 2 }));
  });

  it('lets a linked player in a live session set when they leave, and nothing else', async () => {
    const live = (db: ReturnType<typeof anon>) => doc(db, 'sessions/live1');
    await assertSucceeds(updateDoc(live(vikram()), { 'attendees.p1.leaveAfter': 7, updatedAt: 1 }));
    await assertSucceeds(updateDoc(live(vikram()), { 'attendees.p1.leaveAfter': null }));
    await assertSucceeds(updateDoc(live(vikram()), { 'attendees.p1.leaveAfter': deleteField() }));
    // Not for someone else, not other fields, not odd values.
    await assertFails(updateDoc(live(vikram()), { 'attendees.p2.leaveAfter': 3 }));
    await assertFails(updateDoc(live(vikram()), { 'attendees.p1.status': 'left' }));
    await assertFails(updateDoc(live(vikram()), { 'attendees.p1.leaveAfter': 5, 'attendees.p1.level': 5.5 }));
    await assertFails(updateDoc(live(vikram()), { 'attendees.p1.leaveAfter': 5, title: 'Mine' }));
    await assertFails(updateDoc(live(vikram()), { 'attendees.p1.leaveAfter': 'soon' }));
    await assertFails(updateDoc(live(vikram()), { 'attendees.p1.leaveAfter': -1 }));
    await assertFails(updateDoc(live(vikram()), { 'attendees.p1.leaveAfter': 2.5 }));
    await assertFails(updateDoc(live(vikram()), { 'attendees.p1': deleteField() }));
    // Only in a live session they are part of, and only once linked.
    await assertFails(updateDoc(doc(vikram(), 'sessions/done1'), { 'attendees.p1.leaveAfter': 4 }));
    await assertFails(updateDoc(live(uppli()), { 'attendees.p3.leaveAfter': 4 }));
    await assertFails(updateDoc(live(viewer()), { 'attendees.p1.leaveAfter': 4 }));
    await assertFails(updateDoc(live(anon()), { 'attendees.p1.leaveAfter': 4 }));
    await assertFails(updateDoc(live(impostor()), { 'attendees.p1.leaveAfter': 4 }));
    // Admins still change anything.
    await assertSucceeds(updateDoc(live(admin()), { 'attendees.p2.leaveAfter': 6, 'attendees.p2.status': 'resting' }));
  });
});
