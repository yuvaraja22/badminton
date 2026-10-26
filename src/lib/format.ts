/** Display helpers shared by the app, the report and the PDF. */

export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** Win chances as whole percentages that add up to 100, kept between 1 and 99: 0.613 → [61, 39]. */
export function odds(chanceA: number): [number, number] {
  const a = Math.min(99, Math.max(1, Math.round(chanceA * 100)));
  return [a, 100 - a];
}

export function pctRound(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export function oneDecimal(n: number): string {
  return n.toFixed(1);
}

/** "M07" style code used in match logs. */
export function matchCode(n: number): string {
  return `M${String(n).padStart(2, '0')}`;
}

function parseISODate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

/** "Sunday, October 11, 2026" */
export function longDate(date: string): string {
  return parseISODate(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Saturday, October 24" (adds the year when it isn't the current year). */
export function dayDate(date: string): string {
  const d = parseISODate(date);
  const sameYear = d.getUTCFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

/** { weekday: 'Sun', day: '11', month: 'Oct' } for calendar-style date stubs. */
export function dateParts(date: string): { weekday: string; day: string; month: string } {
  const d = parseISODate(date);
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    day: String(d.getUTCDate()),
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
  };
}

/** "Sun, Oct 11" (adds the year when it isn't the current year). */
export function shortDate(date: string): string {
  const d = parseISODate(date);
  const sameYear = d.getUTCFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

/** "2026-10-25" + 7 → "2026-11-01" */
export function addDaysISO(date: string, days: number): string {
  const d = parseISODate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return toISO(new Date());
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The coming Saturday or Sunday (never today), a sensible default when planning a session. */
export function nextWeekendISO(): string {
  const d = new Date();
  do d.setDate(d.getDate() + 1);
  while (d.getDay() !== 6 && d.getDay() !== 0);
  return toISO(d);
}

/** A moment as "Oct 25, 9:42 PM" (adds the year when it isn't this year). */
export function formatStamp(at: number): string {
  const d = new Date(at);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "19:00" → "7:00 PM" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h || 0, m || 0).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISO(d);
}

/** "Badminton · Mon, Oct 26": the group's name with the day and date, so sessions are easy to tell apart. */
export function defaultSessionTitle(date: string, groupName: string): string {
  return `${groupName.trim()} · ${shortDate(date)}`;
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

export function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "a", "a and b", "a, b and c" */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
