import type { DocumentData } from 'firebase/firestore';
import type {
  AppConfig,
  Attendee,
  EditEntry,
  HistorySession,
  LinkClaim,
  Match,
  PlannedSession,
  Player,
  ScorerInfo,
  ServeSide,
  Session,
  TeamColor,
  TeamKey,
  Tournament,
  TournamentMatch,
  TournamentTeam,
  TrashEntry,
} from '../types';
import { DEFAULT_CONFIG, MAX_GUESTS } from '../types';
import { DEFAULT_TEAM_COLORS, TEAM_COLOR_KEYS } from '../teamColors';
import { sortedMatches } from '../engine/games';

/** Firestore documents are untyped; these normalize them (and fill defaults) for the app. */

export function toPlayer(id: string, d: DocumentData): Player {
  return {
    id,
    name: String(d.name ?? 'Unknown'),
    level: Number(d.level ?? 3),
    active: d.active !== false,
    photo: typeof d.photo === 'string' ? d.photo : null,
    bio: typeof d.bio === 'string' ? d.bio : null,
    hand: d.hand === 'left' || d.hand === 'right' ? d.hand : null,
    position: d.position === 'front' || d.position === 'back' || d.position === 'both' ? d.position : null,
    racket: typeof d.racket === 'string' ? d.racket : null,
    guest: d.guest === true,
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : undefined,
  };
}

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const serveSide = (v: unknown): ServeSide | null => (v === 'A' || v === 'B' ? v : null);

function toScorer(d: DocumentData | null | undefined): (ScorerInfo & { at: number }) | null {
  return typeof d?.name === 'string' ? { id: typeof d.id === 'string' ? d.id : '', name: d.name, at: num(d.at, 0) } : null;
}

function toEdits(v: unknown): EditEntry[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((e): e is DocumentData => typeof e?.text === 'string')
    .map((e) => ({
      at: num(e.at, 0),
      by: typeof e.by === 'string' ? e.by : 'an admin',
      uid: typeof e.uid === 'string' ? e.uid : '',
      match: typeof e.match === 'number' ? e.match : null,
      text: e.text,
    }));
}

function toTeam(d: DocumentData | undefined, key: TeamKey): TournamentTeam {
  return {
    name: typeof d?.name === 'string' && d.name.trim() ? d.name : null,
    color: TEAM_COLOR_KEYS.includes(d?.color as TeamColor) ? (d!.color as TeamColor) : DEFAULT_TEAM_COLORS[key],
    players: ids(d?.players),
  };
}

function toTournamentMatch(id: string, d: DocumentData, order: number): TournamentMatch {
  return {
    id,
    order: num(d.order, order),
    kind: d.kind === 'singles' ? 'singles' : 'doubles',
    a: ids(d.a),
    b: ids(d.b),
    time: typeof d.time === 'string' && d.time ? d.time : null,
    status: d.status === 'live' || d.status === 'completed' ? d.status : 'scheduled',
    scoreA: num(d.scoreA, 0),
    scoreB: num(d.scoreB, 0),
    log: typeof d.log === 'string' ? d.log : '',
    typedPoints: num(d.typedPoints, 0),
    scorer: toScorer(d.scorer),
    pointsToWin: typeof d.pointsToWin === 'number' && d.pointsToWin > 0 ? d.pointsToWin : null,
    maxPoints: typeof d.maxPoints === 'number' && d.maxPoints > 0 ? d.maxPoints : null,
    firstServe: serveSide(d.firstServe),
    startedAt: typeof d.startedAt === 'number' ? d.startedAt : null,
    completedAt: typeof d.completedAt === 'number' ? d.completedAt : null,
  };
}

export function toTournament(id: string, d: DocumentData): Tournament {
  const matches: Record<string, TournamentMatch> = {};
  Object.entries((d.matches ?? {}) as Record<string, DocumentData>).forEach(([mid, m], i) => {
    matches[mid] = toTournamentMatch(mid, m ?? {}, i + 1);
  });
  return {
    id,
    name: String(d.name ?? 'Tournament'),
    date: String(d.date ?? ''),
    status: d.status === 'live' || d.status === 'completed' ? d.status : 'upcoming',
    pointsToWin: num(d.pointsToWin, 21),
    maxPoints: num(d.maxPoints, 30),
    teams: { a: toTeam(d.teams?.a, 'a'), b: toTeam(d.teams?.b, 'b') },
    schedule: { start: typeof d.schedule?.start === 'string' && d.schedule.start ? d.schedule.start : null, minutes: num(d.schedule?.minutes, 15) },
    matches,
    invited: ids(d.invited),
    edits: toEdits(d.edits),
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : undefined,
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : undefined,
  };
}

export function toPlanned(id: string, d: DocumentData): PlannedSession {
  const rsvps: PlannedSession['rsvps'] = {};
  for (const [pid, r] of Object.entries((d.rsvps ?? {}) as Record<string, DocumentData>)) {
    if (r?.status !== 'in' && r?.status !== 'out') continue;
    const guests = Math.min(MAX_GUESTS, Math.max(0, Math.round(num(r.guests, 0))));
    rsvps[pid] = { status: r.status, at: Number(r.at ?? 0), ...(guests && r.status === 'in' ? { guests } : {}) };
  }
  return {
    id,
    kind: d.kind === 'tournament' ? 'tournament' : 'session',
    name: typeof d.name === 'string' && d.name.trim() ? d.name : null,
    date: String(d.date ?? ''),
    time: typeof d.time === 'string' && d.time ? d.time : null,
    note: typeof d.note === 'string' && d.note ? d.note : null,
    status: d.status === 'started' || d.status === 'cancelled' ? d.status : 'planned',
    sessionId: typeof d.sessionId === 'string' ? d.sessionId : null,
    rsvps,
    cap: typeof d.cap === 'number' && d.cap > 0 ? Math.round(d.cap) : null,
    repeat: d.repeat === 'weekly' ? 'weekly' : null,
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : undefined,
  };
}

function toAttendee(d: DocumentData, order: number): Attendee {
  return {
    level: Number(d?.level ?? 3),
    status: d?.status === 'resting' || d?.status === 'left' ? d.status : 'available',
    since: Number(d?.since ?? 0),
    catchUp: Array.isArray(d?.catchUp) ? d.catchUp.map((w: DocumentData) => ({ from: Number(w.from), to: Number(w.to) })) : [],
    order: Number(d?.order ?? order),
    levelOverride: d?.levelOverride === true,
  };
}

function toMatch(id: string, d: DocumentData): Match {
  return {
    id,
    number: Number(d.number ?? 0),
    teamA: [d.teamA?.[0] ?? '', d.teamA?.[1] ?? ''],
    teamB: [d.teamB?.[0] ?? '', d.teamB?.[1] ?? ''],
    scoreA: typeof d.scoreA === 'number' ? d.scoreA : null,
    scoreB: typeof d.scoreB === 'number' ? d.scoreB : null,
    status: d.status === 'completed' || d.status === 'unfinished' ? d.status : 'live',
    available: Array.isArray(d.available) ? d.available : [],
    ...(typeof d.log === 'string' && d.log ? { log: d.log, typedPoints: num(d.typedPoints, 0) } : {}),
    scorer: toScorer(d.scorer),
    firstServe: serveSide(d.firstServe),
    createdAt: d.createdAt,
    completedAt: d.completedAt ?? null,
  };
}

export function toSession(id: string, d: DocumentData): Session {
  const attendees: Session['attendees'] = {};
  Object.entries((d.attendees ?? {}) as Record<string, DocumentData>).forEach(([pid, a], i) => {
    attendees[pid] = toAttendee(a, i);
  });
  const matches: Session['matches'] = {};
  for (const [mid, m] of Object.entries((d.matches ?? {}) as Record<string, DocumentData>)) matches[mid] = toMatch(mid, m);
  return {
    id,
    date: String(d.date ?? ''),
    title: String(d.title ?? ''),
    status: d.status === 'completed' ? 'completed' : 'live',
    pointsToWin: Number(d.pointsToWin ?? 21),
    attendees,
    matches,
    nextPick: d.nextPick?.teamA && d.nextPick?.teamB ? { teamA: d.nextPick.teamA, teamB: d.nextPick.teamB } : null,
    shuffle: Number(d.shuffle ?? 0),
    takeaways: Array.isArray(d.takeaways) ? d.takeaways.map(String) : null,
    playerIds: Array.isArray(d.playerIds) ? d.playerIds : Object.keys(attendees),
    edits: toEdits(d.edits),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    completedAt: d.completedAt ?? null,
  };
}

// The old default; a session isn't a tournament, so a group still on it gets the new default.
const OLD_GROUP_NAME = 'Badminton Tournament';

export function toConfig(d: DocumentData | undefined): AppConfig {
  const name = typeof d?.groupName === 'string' ? d.groupName.trim() : '';
  return {
    groupName: name && name !== OLD_GROUP_NAME ? name : DEFAULT_CONFIG.groupName,
    pointsToWin: Number(d?.pointsToWin ?? DEFAULT_CONFIG.pointsToWin),
  };
}

export function toHistoryMap(d: DocumentData | undefined): Record<string, HistorySession> {
  const out: Record<string, HistorySession> = {};
  for (const [id, h] of Object.entries((d?.sessions ?? {}) as Record<string, DocumentData>)) {
    out[id] = {
      ...(h.kind === 'tournament' ? { kind: 'tournament' as const } : {}),
      date: String(h.date ?? ''),
      title: String(h.title ?? ''),
      pointsToWin: Number(h.pointsToWin ?? 21),
      players: Array.isArray(h.players) ? h.players : [],
      levels: h.levels ?? {},
      m: Array.isArray(h.m) ? h.m : [],
    };
  }
  return out;
}

/** Compact copy of a session for meta/history. Matches still marked live count as unfinished. */
export function toHistory(s: Session): HistorySession {
  return {
    date: s.date,
    title: s.title,
    pointsToWin: s.pointsToWin,
    players: s.playerIds.length ? s.playerIds : Object.keys(s.attendees),
    levels: Object.fromEntries(Object.entries(s.attendees).map(([id, a]) => [id, a.level])),
    m: sortedMatches(s).map((m) => ({
      n: m.number,
      a: m.teamA,
      b: m.teamB,
      sa: m.scoreA,
      sb: m.scoreB,
      ...(m.status === 'completed' ? {} : { u: true }),
    })),
  };
}

export function toTrash(id: string, d: DocumentData): TrashEntry {
  return {
    id,
    kind: d.kind === 'tournament' ? 'tournament' : 'session',
    title: String(d.title ?? ''),
    date: String(d.date ?? ''),
    data: (d.data ?? {}) as Record<string, unknown>,
    deletedAt: num(d.deletedAt, 0),
    deletedBy: typeof d.deletedBy === 'string' ? d.deletedBy : 'an admin',
  };
}

export function toClaim(email: string, d: DocumentData): LinkClaim | null {
  if (typeof d.playerId !== 'string' || !d.playerId) return null;
  return { email, playerId: d.playerId, name: typeof d.name === 'string' ? d.name : '', at: num(d.at, 0) };
}

/** Firestore stores the session without its id. */
export function sessionData(s: Session): Omit<Session, 'id'> {
  const { id: _id, ...rest } = s;
  void _id;
  return rest;
}
