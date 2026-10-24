/** Figure tile: small label, scoreboard numeral, optional detail line. */
export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="@container relative overflow-hidden rounded-[1.1rem] border border-line bg-surface px-3.5 pt-2.5 pb-3">
      <div className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">{label}</div>
      <div className="font-score tabular mt-1 text-[min(2.1rem,30cqw)] leading-none font-extrabold tracking-wide whitespace-nowrap">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
