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
    await setDoc(doc(db, 'players/p2'), { name: 'Anu', level: 4, active: true });
    await setDoc(doc(db, 'links/vikram@example.com'), { playerId: 'p1' });
    await setDoc(doc(db, 'events/e1'), { date: '2026-10-26', status: 'planned', rsvps: {} });
    await setDoc(doc(db, 'events/e2'), { date: '2026-10-19', status: 'started', rsvps: {} });
    await setDoc(doc(db, 'trash/s0'), { kind: 'session', title: 'Old', date: '2026-10-01', data: {}, deletedAt: 1, deletedBy: 'Yuva' });
    await setDoc(doc(db, 'tournaments/t1'), { name: 'Cup', status: 'live', matches: { m1: { status: 'live', scoreA: 3, scoreB: 2, log: 'AABBA' } } });
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
    await assertSucceeds(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p1': { status: 'in', at: Date.now() } }));
    await assertSucceeds(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p1': { status: 'out', at: Date.now() } }));
    await assertFails(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p2': { status: 'in', at: Date.now() } }));
    await assertFails(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p1': { status: 'maybe', at: Date.now() } }));
    await assertFails(updateDoc(doc(vikram(), 'events/e1'), { date: '2026-10-27' }));
    await assertFails(updateDoc(doc(viewer(), 'events/e1'), { 'rsvps.p2': { status: 'in', at: Date.now() } }));
    await assertSucceeds(updateDoc(doc(admin(), 'events/e1'), { note: 'Court 2' }));
  });

  it('checks guests and when an RSVP was given', async () => {
    const at = Date.now();
    await assertSucceeds(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p1': { status: 'in', at, guests: 2 } }));
    // Changing only the guests keeps the original time (the place in the queue)…
    await assertSucceeds(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p1': { status: 'in', at, guests: 1 } }));
    // …but nobody can backdate an answer to jump the waitlist, bring more than 3, or add other fields.
    await assertFails(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p1': { status: 'in', at: 1, guests: 1 } }));
    await assertFails(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p1': { status: 'in', at, guests: 4 } }));
    await assertFails(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p1': { status: 'in', at, guests: 1.5 } }));
    await assertFails(updateDoc(doc(vikram(), 'events/e1'), { 'rsvps.p1': { status: 'in', at, vip: true } }));
    // A plan that already started takes no more answers.
    await assertFails(updateDoc(doc(vikram(), 'events/e2'), { 'rsvps.p1': { status: 'in', at: Date.now() } }));
  });

  it('only accepts uploaded photos on a player’s own profile', async () => {
    await assertSucceeds(updateDoc(doc(vikram(), 'players/p1'), { photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }));
    await assertFails(updateDoc(doc(vikram(), 'players/p1'), { photo: 'https://example.com/pixel.gif' }));
    await assertFails(updateDoc(doc(vikram(), 'players/p1'), { photo: 'data:text/html;base64,PGgxPg==' }));
    await assertSucceeds(updateDoc(doc(vikram(), 'players/p1'), { photo: null }));
  });

  it('keeps recently deleted items to admins', async () => {
    await assertFails(getDoc(doc(anon(), 'trash/s0')));
    await assertFails(getDocs(collection(viewer(), 'trash')));
    await assertFails(setDoc(doc(viewer(), 'trash/x'), { kind: 'session' }));
    await assertSucceeds(getDocs(collection(admin(), 'trash')));
    await assertSucceeds(deleteDoc(doc(admin(), 'trash/s0')));
  });

  it('lets someone not yet linked ask to be linked, privately', async () => {
    const claim = { playerId: 'p2', name: 'Viewer', at: Date.now() };
    await assertSucceeds(setDoc(doc(viewer(), 'claims/viewer@example.com'), claim));
    await assertSucceeds(getDoc(doc(viewer(), 'claims/viewer@example.com')));
    // Not for someone else's email, not for a player that doesn't exist, no extra fields.
    await assertFails(setDoc(doc(viewer(), 'claims/other@example.com'), claim));
    await assertFails(setDoc(doc(viewer(), 'claims/viewer@example.com'), { ...claim, playerId: 'nobody' }));
    await assertFails(setDoc(doc(viewer(), 'claims/viewer@example.com'), { ...claim, approved: true }));
    // Already linked, or signed out, or unverified: no.
    await assertFails(setDoc(doc(vikram(), 'claims/vikram@example.com'), claim));
    await assertFails(setDoc(doc(anon(), 'claims/viewer@example.com'), claim));
    await assertFails(setDoc(doc(impostor(), 'claims/admin@example.com'), claim));
    // Only admins see everyone's requests; the person can withdraw theirs.
    await assertFails(getDocs(collection(viewer(), 'claims')));
    await assertFails(getDoc(doc(vikram(), 'claims/viewer@example.com')));
    await assertSucceeds(getDocs(collection(admin(), 'claims')));
    await assertSucceeds(deleteDoc(doc(viewer(), 'claims/viewer@example.com')));
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

  it('lets anyone follow a tournament but only admins set it up and keep score', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'tournaments/t1')));
    await assertSucceeds(getDocs(collection(anon(), 'tournaments')));
    const point = { 'matches.m1.log': 'AABBAA', 'matches.m1.scoreA': 4 };
    await assertFails(updateDoc(doc(anon(), 'tournaments/t1'), point));
    await assertFails(updateDoc(doc(viewer(), 'tournaments/t1'), point));
    await assertFails(updateDoc(doc(vikram(), 'tournaments/t1'), point)); // a linked player can't keep score
    await assertFails(updateDoc(doc(impostor(), 'tournaments/t1'), point));
    await assertFails(setDoc(doc(viewer(), 'tournaments/t2'), { name: 'Mine' }));
    await assertSucceeds(updateDoc(doc(admin(), 'tournaments/t1'), point));
    await assertSucceeds(setDoc(doc(admin(), 'tournaments/t2'), { name: 'Next one', status: 'upcoming', matches: {} }));
    await assertSucceeds(deleteDoc(doc(admin(), 'tournaments/t2')));
  });
});
