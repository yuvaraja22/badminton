import clsx from 'clsx';
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Award, CalendarCheck, Crown, Flame, Medal, Star, Trophy, Zap } from 'lucide-react';
import { useData } from '../../lib/data/context';
import { entryPath, type PlayerSessionLine } from '../../lib/engine/alltime';
import { achievements, mvpMap, type Milestone, type MilestoneKind } from '../../lib/engine/milestones';
import { awards } from '../../lib/engine/seasons';
import type { RelationLine } from '../../lib/engine/stats';
import { pct, shortDate, signed, todayISO } from '../../lib/format';
import type { PlayerId } from '../../lib/types';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';

/** Shared sections of a player's profile and the Me tab. */

/** The last 10 results as W/L chips, oldest first. */
export function FormStrip({ form, title = 'Last 10 games' }: { form: ('W' | 'L')[]; title?: string }) {
  if (!form.length) return null;
  return (
    <Card>
      <CardHeader title={title} subtitle="Oldest first, latest at the end" />
      <div className="flex flex-wrap gap-1.5 p-4">
        {[...form].reverse().map((r, i) => (
          <span
            key={i}
            className={clsx('font-score inline-flex size-9 items-center justify-center rounded-xl text-lg font-black', r === 'W' ? 'bg-good text-good-bg' : 'border-2 border-bad/45 text-bad')}
            aria-label={r === 'W' ? 'Win' : 'Loss'}
          >
            {r}
          </span>
        ))}
      </div>
    </Card>
  );
}

const qualified = (r: RelationLine) => r.played >= 3;

/** Best partner and toughest opponent (3+ games), side by side. `you` words it for the Me tab. */
export function PartnerCards({ partners, opponents, you }: { partners: RelationLine[]; opponents: RelationLine[]; you?: boolean }) {
  const { nameOf, pathOf, playersById } = useData();
  const best = [...partners].filter(qualified).sort((a, b) => b.winRate - a.winRate || b.diff - a.diff)[0];
  const toughest = [...opponents].filter(qualified).sort((a, b) => a.winRate - b.winRate || a.diff - b.diff)[0];
  if (!best && !toughest) return null;
  const card = (r: RelationLine, kicker: string, line: string) => (
    <Card className="flex items-center gap-3 p-4">
      <Avatar name={nameOf(r.otherId)} photo={playersById.get(r.otherId)?.photo} size={48} />
      <div className="min-w-0">
        <div className="kicker">{kicker}</div>
        <Link to={pathOf(r.otherId)} className="mt-1 block truncate text-lg leading-tight font-bold tracking-tight hover:underline">
          {nameOf(r.otherId)}
        </Link>
        <div className="text-sm text-muted">{line}</div>
      </div>
    </Card>
  );
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {best && card(best, you ? 'Your best partner' : 'Best partner', `${best.won}-${best.lost} together · ${signed(best.diff)} pts (3+ games)`)}
      {toughest && card(toughest, you ? 'Your toughest opponent' : 'Toughest opponent', `${toughest.won}-${toughest.lost} against · ${signed(toughest.diff)} pts (3+ games)`)}
    </div>
  );
}

/** Sessions and tournaments the player was in, newest first: result, rank and MVPs. */
export function SessionsList({ sessions, title, limit }: { sessions: PlayerSessionLine[]; title?: string; limit?: number }) {
  if (!sessions.length) return null;
  const shown = limit ? sessions.slice(0, limit) : sessions;
  return (
    <Card>
      <CardHeader title={title ?? (sessions.some((s) => s.kind === 'tournament') ? 'Sessions & tournaments' : 'Sessions')} />
      <ul className="tabular divide-y divide-line pt-2 text-sm">
        {shown.map((s) => (
          <li key={s.id}>
            <Link to={entryPath(s.id, s.kind)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
              <span className="w-24 shrink-0 text-muted">{shortDate(s.date)}</span>
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              {s.kind === 'tournament' && <Badge tone="info">Tournament</Badge>}
              {s.mvp && <Trophy size={15} className="shrink-0 text-warn" aria-label="MVP" />}
              <span className="shrink-0 font-semibold">
                {s.won}-{s.lost}
              </span>
              <span className="w-14 shrink-0 text-right text-muted">
                #{s.rank}/{s.of}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const ICONS: Record<MilestoneKind, ReactNode> = {
  games: <Medal size={15} aria-hidden />,
  wins: <Star size={15} aria-hidden />,
  streak: <Flame size={15} aria-hidden />,
  mvp: <Trophy size={15} aria-hidden />,
  unbeaten: <Zap size={15} aria-hidden />,
  deuce: <Award size={15} aria-hidden />,
  sessions: <CalendarCheck size={15} aria-hidden />,
  season: <Crown size={15} aria-hidden />,
  month: <Crown size={15} aria-hidden />,
};

/** Repeatable badges (unbeaten sessions) count up instead of listing every one. */
function group(milestones: Milestone[]): (Milestone & { times: number })[] {
  const out: (Milestone & { times: number })[] = [];
  for (const m of milestones) {
    const same = m.kind === 'unbeaten' ? out.find((x) => x.kind === 'unbeaten') : null;
    if (same) same.times += 1;
    else out.push({ ...m, ...(m.kind === 'unbeaten' ? { label: 'Unbeaten session' } : {}), times: 1 });
  }
  return out;
}

/** Streaks, attendance and milestones (seasons and Player of the Month included), newest first. */
export function AchievementsCard({ playerId }: { playerId: PlayerId }) {
  const { history, nameOf, playersById } = useData();
  const a = useMemo(() => {
    const eligible = (id: PlayerId) => !playersById.get(id)?.guest;
    const today = todayISO();
    return achievements(history, playerId, nameOf, {
      mvps: mvpMap(history, nameOf),
      seasons: awards(history, nameOf, 'season', today, eligible),
      months: awards(history, nameOf, 'month', today, eligible),
    });
  }, [history, playerId, nameOf, playersById]);
  const { streaks, attendance } = a;
  if (!a.milestones.length && !streaks.current && !attendance) return null;
  const badges = group(a.milestones);
  return (
    <Card>
      <CardHeader title="Streaks & milestones" />
      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
          <div className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Now on</div>
          <div className="font-score tabular mt-0.5 text-2xl leading-none font-black">
            {streaks.current ? `${streaks.current.length}${streaks.current.result}` : '–'}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {streaks.current ? `${streaks.current.result === 'W' ? 'win' : 'loss'}${streaks.current.length === 1 ? '' : streaks.current.result === 'W' ? 's' : 'es'} in a row` : 'no games yet'}
          </div>
        </div>
        <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
          <div className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Best run</div>
          <div className="font-score tabular mt-0.5 text-2xl leading-none font-black">{streaks.bestWin ? `${streaks.bestWin.length}W` : '–'}</div>
          <div className="mt-0.5 truncate text-xs text-muted">{streaks.bestWin ? `wins in a row · ${shortDate(streaks.bestWin.date)}` : 'no wins yet'}</div>
        </div>
        <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
          <div className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Turns up</div>
          <div className="font-score tabular mt-0.5 text-2xl leading-none font-black">{attendance ? pct(attendance.rate, 0) : '–'}</div>
          <div className="mt-0.5 truncate text-xs text-muted">
            {attendance ? `${attendance.attended} of ${attendance.possible} sessions${attendance.streak > 1 ? ` · ${attendance.streak} in a row` : ''}` : 'no sessions yet'}
          </div>
        </div>
      </div>
      {badges.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 p-4">
          {badges.map((m) => (
            <li
              key={`${m.kind}-${m.label}`}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
                m.kind === 'season' || m.kind === 'month' ? 'bg-volt text-volt-ink' : 'border border-line bg-surface-2/60',
              )}
              title={m.times > 1 ? `${m.times} times, latest ${shortDate(m.date)}` : shortDate(m.date)}
            >
              {ICONS[m.kind]}
              {m.label}
              {m.times > 1 && <span className="font-normal opacity-75">×{m.times}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-4 text-sm text-muted">Milestones appear here: 25 games, 10 wins, 5 in a row, a first MVP…</p>
      )}
    </Card>
  );
}
