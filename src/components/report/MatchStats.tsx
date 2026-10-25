import { longestRunOf, RUN_MIN, type MatchFlow } from '../../lib/engine/rally';
import type { SidePair } from '../../lib/teamColors';
import type { TeamKey } from '../../lib/types';
import { ScoreFlow } from '../tournament/ScoreFlow';
import { Card, CardHeader, Notice } from '../ui/Card';

/** A small dot in a side's colour (identity is never colour alone: the name sits next to it). */
function SideDot({ fill }: { fill: string }) {
  return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: fill }} />;
}

/** A finished match's point-by-point story: the score flow, each side's numbers and a few facts. */
export function MatchStats({ flow, sides }: { flow: MatchFlow | null; sides: SidePair }) {
  if (!flow) return <Notice>This score was typed in, so there's no point-by-point record.</Notice>;
  const m = flow.match;
  const winner = flow.winner;
  const rows: [string, string | number, string | number][] = [
    ['Points won', m.scoreA, m.scoreB],
    ['Longest run', longestRunOf(flow, 'a'), longestRunOf(flow, 'b')],
    [`Runs of ${RUN_MIN}+ points`, flow.runs.a, flow.runs.b],
    ['Biggest lead', flow.maxLead.a.lead ? `${flow.maxLead.a.lead} (${flow.maxLead.a.at.join('–')})` : '–', flow.maxLead.b.lead ? `${flow.maxLead.b.lead} (${flow.maxLead.b.at.join('–')})` : '–'],
    ['Game points saved', flow.saved.a, flow.saved.b],
  ];
  const facts: string[] = [`Level ${flow.ties} time${flow.ties === 1 ? '' : 's'} after 0–0; the lead changed hands ${flow.leadChanges} time${flow.leadChanges === 1 ? '' : 's'}.`];
  if (flow.firstToHalf && flow.halfAt) {
    const [a, b] = flow.halfAt;
    facts.push(
      `${sides[flow.firstToHalf].name} reached ${Math.ceil(m.pointsToWin / 2)} first, at ${a}–${b}${winner === flow.firstToHalf ? ', and held on' : `, but ${sides[winner ?? 'a'].name} came back`}.`,
    );
  }
  if (flow.comeback && winner) {
    const [a, b] = flow.comeback.at;
    facts.push(`${sides[winner].name} were ${flow.comeback.down} down at ${a}–${b} and won.`);
  }
  if (flow.deuce) facts.push(`It went to deuce at ${m.pointsToWin - 1}–${m.pointsToWin - 1}.`);

  return (
    <>
      <Card className="px-4 pt-4 pb-3">
        <h2 className="kicker">Score flow</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <SideDot fill={sides.a.fill} /> {sides.a.name} ahead above the line
          </span>
          <span className="inline-flex items-center gap-1.5">
            <SideDot fill={sides.b.fill} /> {sides.b.name} ahead below
          </span>
        </p>
        <ScoreFlow sides={sides} flow={flow} large />
      </Card>
      <Card className="overflow-hidden">
        <CardHeader title="Point by point" />
        <table className="tabular mt-2 w-full text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="px-4 py-1.5 text-left font-semibold">
                <span className="sr-only">Stat</span>
              </th>
              {(['a', 'b'] as TeamKey[]).map((k) => (
                <th key={k} className="w-28 px-2 py-1.5 font-semibold">
                  <span className="inline-flex max-w-full items-center gap-1.5">
                    <SideDot fill={sides[k].fill} />
                    <span className="truncate">{sides[k].name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(([label, a, b]) => (
              <tr key={label}>
                <td className="px-4 py-2">{label}</td>
                <td className="px-2 py-2 text-center font-semibold">{a}</td>
                <td className="px-2 py-2 text-center font-semibold">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="space-y-1.5 border-t border-line px-4 py-3 text-sm">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
