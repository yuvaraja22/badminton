import { useMemo } from 'react';
import { COMEBACK_MIN, rallyHighlights, type RallySummary } from '../../lib/engine/rally';
import { matchCode } from '../../lib/format';
import type { SidePair } from '../../lib/teamColors';
import type { PlayerId, TeamKey } from '../../lib/types';
import { Card, CardHeader } from '../ui/Card';
import { MatchLinks } from './MatchLinks';

/** A small dot in a side's colour (identity is never colour alone: the name sits next to it). */
export function SideDot({ fill }: { fill: string }) {
  return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: fill }} />;
}

/** Each side on the point-by-point numbers, side by side. */
export function TeamRallyTable({ sides, r }: { sides: SidePair; r: RallySummary }) {
  const { a, b } = r.teams;
  const rows: [string, string | number, string | number][] = [
    ['Longest run', a.longestRun, b.longestRun],
    ['Biggest lead', a.biggestLead, b.biggestLead],
    ['Game points saved', a.gamePointsSaved, b.gamePointsSaved],
    [`Wins from ${COMEBACK_MIN}+ down`, a.comebackWins, b.comebackWins],
    ['First to halfway, then won', `${a.firstToHalfWon}/${a.firstToHalf}`, `${b.firstToHalfWon}/${b.firstToHalf}`],
  ];
  return (
    <table className="tabular w-full text-sm">
      <thead>
        <tr className="text-xs text-muted">
          <th className="px-4 py-1.5 text-left font-semibold">
            <span className="sr-only">Stat</span>
          </th>
          {(['a', 'b'] as TeamKey[]).map((k) => (
            <th key={k} className="w-24 px-2 py-1.5 font-semibold">
              <span className="inline-flex max-w-full items-center gap-1.5">
                <SideDot fill={sides[k].fill} />
                <span className="truncate">{sides[k].name}</span>
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map(([label, x, y]) => (
          <tr key={label}>
            <td className="px-4 py-2">{label}</td>
            <td className="px-2 py-2 text-center font-semibold">{x}</td>
            <td className="px-2 py-2 text-center font-semibold">{y}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * "Point by point": the headline facts from the live scorer, each side's numbers, and a note on the
 * matches whose score was typed in (they aren't included).
 */
export function RallyCard({
  rally,
  sides,
  nameOf,
  hrefOf,
  subtitle,
  typedIn,
}: {
  rally: RallySummary;
  sides: SidePair;
  nameOf: (id: PlayerId) => string;
  hrefOf?: (n: number) => string | null;
  subtitle: string;
  /** How to mention typed-in matches: list them (tournaments) or just count them (sessions, where most are). */
  typedIn: 'list' | 'count';
}) {
  const highlights = useMemo(() => rallyHighlights(rally, (k) => sides[k].name, nameOf), [rally, sides, nameOf]);
  if (!rally.flows.length) return null;
  const typed = rally.typedIn;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Point by point" subtitle={subtitle} />
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {highlights.map((h) => (
          <div key={h.label} className="rounded-2xl border border-line bg-surface-2/50 px-3.5 py-3">
            <div className="kicker">{h.label}</div>
            <div className="mt-1 text-lg leading-tight font-extrabold tracking-tight">{h.value}</div>
            <div className="mt-0.5 text-sm text-muted">
              <MatchLinks text={h.detail} hrefOf={hrefOf} />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-line pt-2">
        <TeamRallyTable sides={sides} r={rally} />
      </div>
      {typed.length > 0 && (
        <p className="border-t border-line px-4 py-3 text-xs text-muted">
          {typedIn === 'list' ? (
            <>
              <MatchLinks text={typed.map((m) => matchCode(m.order)).join(', ')} hrefOf={hrefOf} /> {typed.length === 1 ? 'was' : 'were'} typed in, so{' '}
              {typed.length === 1 ? "it isn't" : "they aren't"} in the point-by-point numbers.
            </>
          ) : (
            `${rally.flows.length} of ${rally.flows.length + typed.length} finished matches were scored live; only those are in the point-by-point numbers.`
          )}
        </p>
      )}
    </Card>
  );
}
