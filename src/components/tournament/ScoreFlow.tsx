import { useId, useState, type PointerEvent } from 'react';
import { longestRunOf, type MatchFlow } from '../../lib/engine/rally';
import { matchCode } from '../../lib/format';
import { teamFill, teamName } from '../../lib/teamColors';
import type { Tournament } from '../../lib/types';
import { SideNames } from './TeamBits';

const W = 300;
const H = 64;
const MID = H / 2;

/**
 * One match as a "worm": the lead after every point, above the line while Team A is ahead and below
 * while Team B is. Drag or hover to read the score at any point.
 */
export function ScoreFlow({ t, flow }: { t: Tournament; flow: MatchFlow }) {
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
  const winner = flow.winner;
  const runA = longestRunOf(flow, 'a');
  const runB = longestRunOf(flow, 'b');

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="font-score text-lg leading-none font-black tracking-wide">{matchCode(m.order)}</span>
        <span className="min-w-0 flex-1 space-y-0.5 text-sm">
          <SideNames t={t} team="a" ids={m.a} strong={winner === 'a'} />
          <SideNames t={t} team="b" ids={m.b} strong={winner === 'b'} />
        </span>
        <span className="font-score tabular text-xl leading-none font-black">
          {m.scoreA}–{m.scoreB}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-2 h-16 w-full touch-pan-y overflow-visible"
        role="img"
        aria-label={`${matchCode(m.order)} score flow: biggest leads ${teamName(t, 'a')} ${flow.maxLead.a.lead}, ${teamName(t, 'b')} ${flow.maxLead.b.lead}; ${flow.leadChanges} lead changes.`}
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
        <path d={area} fill={teamFill(t, 'a')} fillOpacity={0.85} clipPath={`url(#${id}a)`} />
        <path d={area} fill={teamFill(t, 'b')} fillOpacity={0.85} clipPath={`url(#${id}b)`} />
        <path d={line} fill="none" stroke="var(--ink)" strokeOpacity={0.35} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <line x1="0" x2={W} y1={MID} y2={MID} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {at !== null && <line x1={x(at)} x2={x(at)} y1="0" y2={H} stroke="var(--ink)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
      </svg>
      <p className="mt-1 text-xs text-muted tabular">
        {at !== null ? (
          <>
            After {at} point{at === 1 ? '' : 's'}: <strong className="text-ink">{scoreAt(at)}</strong>
          </>
        ) : (
          <>
            Longest run {runA} / {runB} · biggest lead {flow.maxLead.a.lead} / {flow.maxLead.b.lead} · {flow.leadChanges} lead change{flow.leadChanges === 1 ? '' : 's'}
          </>
        )}
      </p>
    </div>
  );
}
