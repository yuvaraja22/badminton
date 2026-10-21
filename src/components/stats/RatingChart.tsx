import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { useData } from '../../lib/data/context';
import { PROVISIONAL_GAMES, type RatingPoint } from '../../lib/engine/rating';
import { oneDecimal, shortDate } from '../../lib/format';
import { MAX_LEVEL, MIN_LEVEL, levelName } from '../../lib/levels';
import type { PlayerId } from '../../lib/types';
import { Card, CardHeader } from '../ui/Card';

interface ChartPoint extends RatingPoint {
  label: string;
}

function signedChange(change: number): string {
  const rounded = Math.round(change * 10) / 10;
  return rounded > 0 ? `+${oneDecimal(rounded)}` : rounded < 0 ? `−${oneDecimal(-rounded)}` : '±0.0';
}

function ChartTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  const p = payload?.[0]?.payload as ChartPoint | undefined;
  if (!active || !p) return null;
  const start = p.sessionId === null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lg">
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-3 rounded" style={{ background: 'var(--series-1)' }} />
        <span className="tabular font-bold text-ink">{oneDecimal(p.level)}</span>
        <span className="tabular text-muted">{start ? levelName(p.level) : signedChange(p.change)}</span>
      </div>
      <div className="mt-0.5 text-xs text-muted">
        {start ? 'Starting level' : `${shortDate(p.date)} · ${p.title}`}
        {!start && p.games < PROVISIONAL_GAMES && ' · provisional'}
      </div>
    </div>
  );
}

type DotProps = { cx?: number; cy?: number; index?: number };

function RingDot({ cx, cy, r }: DotProps & { r: number }) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={r} fill="currentColor" style={{ stroke: 'var(--surface)' }} strokeWidth={2} />;
}

/** Y range in half-level steps around the data, within the level scale. */
function domainOf(points: RatingPoint[]): [number, number] {
  const levels = points.map((p) => p.level);
  const lo = Math.max(MIN_LEVEL, Math.floor((Math.min(...levels) - 0.25) * 2) / 2);
  const hi = Math.min(MAX_LEVEL, Math.ceil((Math.max(...levels) + 0.25) * 2) / 2);
  return [lo, Math.max(hi, lo + 0.5)];
}

/** Skill rating after each session (single series: the card title names it). */
export function RatingChart({ points }: { points: RatingPoint[] }) {
  const data: ChartPoint[] = points.map((p) => ({ ...p, label: p.sessionId === null ? 'Start' : shortDate(p.date) }));
  const [lo, hi] = domainOf(points);
  const ticks = Array.from({ length: Math.round((hi - lo) * 2) + 1 }, (_, i) => lo + i / 2);
  return (
    <div className="chart h-56 w-full" style={{ color: 'var(--series-1)' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} tickMargin={8} />
          <YAxis domain={[lo, hi]} ticks={ticks} tickFormatter={(v: number) => oneDecimal(v)} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<ChartTooltip />} cursor={{ strokeWidth: 1 }} isAnimationActive={false} />
          <Line
            type="linear"
            dataKey="level"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive={false}
            dot={(props: DotProps) => <RingDot key={props.index} {...props} r={4} />}
            activeDot={(props: DotProps) => <RingDot key={props.index} {...props} r={6} />}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The player's rating over time; nothing until they have finished a session. */
export function RatingHistoryCard({ playerId, title = 'Skill rating' }: { playerId: PlayerId; title?: string }) {
  const r = useData().ratings.get(playerId);
  if (!r || r.history.length < 2) return null;
  const subtitle = r.provisional
    ? `${oneDecimal(r.level)} · provisional (${r.games} of ${PROVISIONAL_GAMES} games). Starts from their level and moves with every result.`
    : `${oneDecimal(r.level)} now${r.peak !== null ? ` · peak ${oneDecimal(r.peak)}` : ''}. Each point is the rating after a session.`;
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="px-2 pt-3 pb-2">
        <RatingChart points={r.history} />
      </div>
    </Card>
  );
}
