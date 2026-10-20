/** Display helpers shared by the app, the report and the PDF. */

export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
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

export function weekdayName(date: string): string {
  return parseISODate(date).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
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

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function defaultSessionTitle(date: string, groupName: string): string {
  return `${weekdayName(date)} ${groupName}`.trim();
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

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
