import { useId, useState, type PointerEvent } from 'react';
import { longestRunOf, type MatchFlow } from '../../lib/engine/rally';
import { cn } from '../../lib/cn';
import { matchCode } from '../../lib/format';
import type { SidePair } from '../../lib/teamColors';

const W = 300;
const H = 48;
const MID = H / 2;

/**
 * A finished match as a "worm": the lead after every point, above the line while the first side is
 * ahead and below while the other is. Drag or hover to read the score at any point.
 */
export function ScoreFlow({ sides, flow, large, paper }: { sides: SidePair; flow: MatchFlow; large?: boolean; paper?: boolean }) {
  // On the report's light "paper" the colours stay light-theme in dark mode too.
  const ink = paper ? '#0f1f1a' : 'var(--ink)';
  const id = useId();
  const [at, setAt] = useState<number | null>(null);
  const { leads, match: m } = flow;
  const n = leads.length - 1;
  const top = Math.max(3, ...leads.map(Math.abs));
  const x = (i: number) => (i / n) * W;
  const y = (lead: number) => MID - (lead / top) * (MID - 2);
  const area = `M0,${MID} ${leads.map((l, i) => `L${x(i).toFixed(1)},${y(l).toFixed(1)}`).join(' ')} L${W},${MID} Z`;
  const line = leads.map((l, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(l).toFixed(1)}`).join(' ');

  const scoreAt = (i: number) => {
    let a = 0;
    for (const c of m.log.slice(0, i)) if (c === 'A') a += 1;
    return `${a}–${i - a}`;
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAt(Math.max(0, Math.min(n, Math.round(((e.clientX - r.left) / r.width) * n))));
  };

  return (
    <div className="mt-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={cn('w-full touch-pan-y overflow-visible', large ? 'h-36' : 'h-12')}
        role="img"
        aria-label={`${matchCode(m.order)} score flow: biggest leads ${sides.a.name} ${flow.maxLead.a.lead}, ${sides.b.name} ${flow.maxLead.b.lead}; ${flow.leadChanges} lead changes.`}
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={() => setAt(null)}
      >
        <defs>
          <clipPath id={`${id}a`}>
            <rect x="0" y="0" width={W} height={MID} />
          </clipPath>
          <clipPath id={`${id}b`}>
            <rect x="0" y={MID} width={W} height={MID} />
          </clipPath>
        </defs>
        <path d={area} fill={sides.a.fill} fillOpacity={0.85} clipPath={`url(#${id}a)`} />
        <path d={area} fill={sides.b.fill} fillOpacity={0.85} clipPath={`url(#${id}b)`} />
        <path d={line} fill="none" stroke={ink} strokeOpacity={0.35} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1="0" x2={W} y1={MID} y2={MID} stroke={paper ? '#e0d9c8' : 'var(--line)'} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {at !== null && <line x1={x(at)} x2={x(at)} y1="0" y2={H} stroke={ink} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
      </svg>
      <p className={cn('mt-1 text-xs tabular', paper ? 'text-[#5b6862]' : 'text-muted')}>
        {at !== null ? (
          <>
            After {at} point{at === 1 ? '' : 's'}: <strong className={paper ? 'text-[#0f1f1a]' : 'text-ink'}>{scoreAt(at)}</strong>
          </>
        ) : large ? (
          'Touch or hover the chart to read the score at any point.'
        ) : (
          <>
            Longest run {longestRunOf(flow, 'a')} / {longestRunOf(flow, 'b')} · biggest lead {flow.maxLead.a.lead} / {flow.maxLead.b.lead} · {flow.leadChanges} lead change
            {flow.leadChanges === 1 ? '' : 's'}
          </>
        )}
      </p>
    </div>
  );
}
