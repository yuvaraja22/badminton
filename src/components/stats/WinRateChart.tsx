import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';

export interface WinRatePoint {
  label: string;
  title: string;
  /** 0–100 */
  winRate: number;
  record: string;
}

function ChartTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  const p = payload?.[0]?.payload as WinRatePoint | undefined;
  if (!active || !p) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-xl">
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-3 rounded" style={{ background: 'var(--series-1)' }} />
        <span className="font-bold text-ink">{p.winRate.toFixed(1)}%</span>
        <span className="text-muted">{p.record}</span>
      </div>
      <div className="mt-0.5 text-xs text-muted">
        {p.label} · {p.title}
      </div>
    </div>
  );
}

type DotProps = { cx?: number; cy?: number; index?: number };

function RingDot({ cx, cy, r }: DotProps & { r: number }) {
  if (cx == null || cy == null) return null;
  // Series-colored dot with a 2px ring in the surface color.
  return <circle cx={cx} cy={cy} r={r} fill="currentColor" style={{ stroke: 'var(--surface)' }} strokeWidth={2} />;
}

/** Win rate per session over time (single series: no legend, the card title names it). */
export function WinRateChart({ data: points }: { data: WinRatePoint[] }) {
  // Position on the axis: two sessions on the same day share a date label.
  const data = points.map((p, i) => ({ ...p, i }));
  return (
    <div className="chart h-56 w-full" style={{ color: 'var(--series-1)' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="i" type="category" tickFormatter={(i: number) => data[i]?.label ?? ''} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} tickMargin={8} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<ChartTooltip />} cursor={{ strokeWidth: 1 }} isAnimationActive={false} />
          <Line
            type="linear"
            dataKey="winRate"
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
