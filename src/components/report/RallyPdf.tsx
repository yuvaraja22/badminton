import { Line, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import { COMEBACK_MIN, longestRunOf, type Highlight, type MatchFlow, type RallySummary } from '../../lib/engine/rally';
import type { SidePair } from '../../lib/teamColors';

/** Point-by-point pieces of the PDFs (tournament results and session reports), in the report's style. */

const INK = '#0f1f1a';
const COURT = '#11624b';
const GREY = '#5b6862';
const LINE = '#e0d9c8';
const B = 'Helvetica-Bold';

const s = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderTopWidth: 3, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10 },
  table: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6 },
  th: { flexDirection: 'row', backgroundColor: '#f4f0e6', paddingVertical: 5, paddingHorizontal: 8 },
  thText: { fontFamily: B, fontSize: 6.5, color: GREY, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5.5, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: '#ece7d9' },
  side: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  kicker: { fontFamily: B, fontSize: 6.5, color: GREY, textTransform: 'uppercase', letterSpacing: 0.6 },
  tileValue: { fontFamily: B, fontSize: 13, marginTop: 2, color: INK },
  tileDetail: { fontSize: 7.5, color: GREY, marginTop: 2, lineHeight: 1.3 },
});

const WORM = { w: 360, h: 28 };

/** The lead after every point: the first side's colour above the line, the other's below. */
export function Worm({ sides, flow }: { sides: SidePair; flow: MatchFlow }) {
  const { leads } = flow;
  const n = leads.length - 1;
  const mid = WORM.h / 2;
  const top = Math.max(3, ...leads.map(Math.abs));
  const x = (i: number) => ((i / n) * WORM.w).toFixed(1);
  const y = (lead: number) => (mid - (lead / top) * (mid - 1)).toFixed(1);
  const area = (clamp: (l: number) => number) => `M0,${mid} ${leads.map((l, i) => `L${x(i)},${y(clamp(l))}`).join(' ')} L${WORM.w},${mid} Z`;
  return (
    <Svg width={WORM.w} height={WORM.h} viewBox={`0 0 ${WORM.w} ${WORM.h}`}>
      <Path d={area((l) => Math.max(0, l))} fill={sides.a.fill} />
      <Path d={area((l) => Math.min(0, l))} fill={sides.b.fill} />
      <Line x1={0} x2={WORM.w} y1={mid} y2={mid} stroke={LINE} strokeWidth={0.75} />
    </Svg>
  );
}

/** Under a match in the report's log: its score flow and the numbers beside it. */
export function FlowRow({ sides, flow }: { sides: SidePair; flow: MatchFlow }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Worm sides={sides} flow={flow} />
      <Text style={{ flex: 1, marginLeft: 10, fontSize: 7, color: GREY, lineHeight: 1.4 }}>
        Longest run {longestRunOf(flow, 'a')} / {longestRunOf(flow, 'b')}
        {'\n'}Biggest lead {flow.maxLead.a.lead} / {flow.maxLead.b.lead}
        {'\n'}
        {flow.leadChanges} lead change{flow.leadChanges === 1 ? '' : 's'}
      </Text>
    </View>
  );
}

// The report's card colours, so the highlights look like the summary cards.
const CARD_COLORS = [COURT, '#c2410c', '#0f766e', '#8a5a0c'];

/** The headline point-by-point facts, two to a row. */
export function Highlights({ items }: { items: Highlight[] }) {
  const rows: Highlight[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <>
      {rows.map((row, i) => (
        <View key={i} style={[s.row, i === 0 ? { marginTop: 0 } : {}]}>
          {row.map((h, j) => {
            const color = CARD_COLORS[(i * 2 + j) % CARD_COLORS.length];
            return (
              <View key={h.label} style={[s.card, { borderTopColor: color }]} wrap={false}>
                <Text style={[s.kicker, { color }]}>{h.label}</Text>
                <Text style={s.tileValue}>{h.value}</Text>
                <Text style={s.tileDetail}>{h.detail}</Text>
              </View>
            );
          })}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
    </>
  );
}

/** Each side's point-by-point numbers, side by side. */
export function TeamRallyTable({ sides, r }: { sides: SidePair; r: RallySummary }) {
  const { a, b } = r.teams;
  const rows: [string, string | number, string | number][] = [
    ['Longest run', a.longestRun, b.longestRun],
    ['Biggest lead', a.biggestLead, b.biggestLead],
    ['Game points saved', a.gamePointsSaved, b.gamePointsSaved],
    [`Wins from ${COMEBACK_MIN}+ down`, a.comebackWins, b.comebackWins],
    ['First to halfway, then won', `${a.firstToHalfWon}/${a.firstToHalf}`, `${b.firstToHalfWon}/${b.firstToHalf}`],
  ];
  const center = { textAlign: 'center' as const };
  return (
    <View style={s.table}>
      <View style={s.th}>
        <Text style={[s.thText, { flex: 1 }]}> </Text>
        {(['a', 'b'] as const).map((k) => (
          <View key={k} style={[s.side, { width: 110, justifyContent: 'center' }]}>
            <View style={[s.dot, { backgroundColor: sides[k].fill }]} />
            <Text style={s.thText}>{sides[k].name}</Text>
          </View>
        ))}
      </View>
      {rows.map(([label, x, y]) => (
        <View key={label} style={s.tr} wrap={false}>
          <Text style={{ flex: 1 }}>{label}</Text>
          <Text style={[center, { width: 110, fontFamily: B }]}>{x}</Text>
          <Text style={[center, { width: 110, fontFamily: B }]}>{y}</Text>
        </View>
      ))}
    </View>
  );
}
