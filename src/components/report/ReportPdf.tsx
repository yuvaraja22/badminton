import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { SessionReport } from '../../lib/engine/report';
import { oneDecimal, pct, pctRound, signed } from '../../lib/format';

/** A4 PDF version of the report, mirroring the original two-page layout. Uses built-in Helvetica. */

// Wrap at spaces only; never hyphenate names or words ("TOURNA-MENT").
Font.registerHyphenationCallback((word) => [word]);

const NAVY = '#1f2a44';
const GREY = '#6b7180';
const LINE = '#e3e1db';
const B = 'Helvetica-Bold';

const s = StyleSheet.create({
  page: { backgroundColor: '#fbfaf7', paddingTop: 34, paddingBottom: 46, paddingHorizontal: 34, fontFamily: 'Helvetica', fontSize: 9, color: NAVY },
  header: { backgroundColor: NAVY, borderRadius: 8, paddingVertical: 16, paddingLeft: 22, paddingRight: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' },
  headerAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: '#b23a3a', borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  title: { fontFamily: B, fontSize: 18, color: '#ffffff', textTransform: 'uppercase' },
  subtitle: { fontSize: 8, color: '#d5d9e3', marginTop: 4 },
  pill: { borderWidth: 1, borderColor: '#8a93aa', borderRadius: 10, paddingVertical: 4, paddingHorizontal: 9, fontFamily: B, fontSize: 7.5, color: '#ffffff', textTransform: 'uppercase', marginLeft: 8 },
  cards: { flexDirection: 'row', marginTop: 12, gap: 8 },
  card: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderTopWidth: 3, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' },
  cardLabel: { fontFamily: B, fontSize: 7, textTransform: 'uppercase' },
  cardValue: { fontFamily: B, fontSize: 14, marginTop: 4, textAlign: 'center' },
  cardLine: { fontSize: 7, color: GREY, marginTop: 3, textAlign: 'center' },
  section: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 7, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: LINE },
  sectionMark: { width: 6, height: 6, backgroundColor: '#b23a3a', marginRight: 7 },
  sectionText: { fontFamily: B, fontSize: 10, textTransform: 'uppercase' },
  table: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6 },
  th: { flexDirection: 'row', backgroundColor: '#f1f2f5', paddingVertical: 6, paddingHorizontal: 6 },
  thText: { fontFamily: B, fontSize: 6.5, color: GREY, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: '#eceae4' },
  rank: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  bold: { fontFamily: B },
  diff: { borderRadius: 3, paddingVertical: 2, paddingHorizontal: 5, fontFamily: B, fontSize: 8, textAlign: 'center' },
  barTrack: { height: 3, backgroundColor: '#e8e9ee', borderRadius: 2, width: 64 },
  box: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 10 },
  boxTitle: { fontFamily: B, fontSize: 8.5, textTransform: 'uppercase', marginBottom: 6 },
  footer: { position: 'absolute', bottom: 20, left: 34, right: 34, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: GREY },
});

const RANK_STYLES: Record<number, { bg: string; border: string }> = {
  1: { bg: '#f7ecb5', border: '#d4b13c' },
  2: { bg: '#e6ebf5', border: '#8c9cc4' },
  3: { bg: '#f6e1d1', border: '#c98a5b' },
};

function winColor(rate: number) {
  if (rate > 0.5) return '#3c7a4a';
  if (rate === 0.5) return '#b07f2f';
  return '#a83c3c';
}

function Diff({ value, width = 34 }: { value: number; width?: number }) {
  const [bg, fg] = value > 0 ? ['#dff0e3', '#2f7a47'] : value < 0 ? ['#f6dede', '#a83c3c'] : ['#eeeef2', GREY];
  return <Text style={[s.diff, { backgroundColor: bg, color: fg, width }]}>{signed(value)}</Text>;
}

function Section({ children }: { children: string }) {
  return (
    <View style={s.section} wrap={false}>
      <View style={s.sectionMark} />
      <Text style={s.sectionText}>{children}</Text>
    </View>
  );
}

function Card({ color, label, value, lines }: { color: string; label: string; value: string; lines: string[] }) {
  return (
    <View style={[s.card, { borderTopColor: color }]}>
      <Text style={[s.cardLabel, { color }]}>{label}</Text>
      <Text style={s.cardValue}>{value}</Text>
      {lines.map((l) => (
        <Text key={l} style={s.cardLine}>
          {l}
        </Text>
      ))}
    </View>
  );
}

function Footer({ text }: { text: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{text}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

// Column widths add up to the table's inner width (523pt page content − 12pt row padding).
const COLS = { rank: 32, player: 124, played: 40, won: 34, lost: 34, rate: 86, pf: 40, pa: 48, diff: 46, ppg: 27 };
const LOG = { match: 34, t1: 112, score: 50, t2: 112, winner: 46, ctx: 160 };

export function ReportDocument({ report, takeaways }: { report: SessionReport; takeaways: string[] }) {
  const { mvp, bestPair, tightest } = report;
  const totalLines = [`${report.totalPoints} total points scored`, `${report.playerCount} players`];
  if (report.unfinishedCount) totalLines.push(`(+${report.unfinishedCount} match${report.unfinishedCount === 1 ? '' : 'es'} left unfinished)`);
  const center = { textAlign: 'center' as const };

  return (
    <Document title={`${report.title} - ${report.dateLabel}`} author="Badminton Stats">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerAccent} />
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{report.title}</Text>
            <Text style={s.subtitle}>{report.subtitle}</Text>
          </View>
          <Text style={s.pill}>Session summary • {report.matchCount} matches</Text>
        </View>

        <View style={s.cards}>
          <Card color="#3f5ba9" label="Total matches" value={String(report.matchCount)} lines={totalLines} />
          <Card
            color="#c98a4b"
            label={mvp?.undefeated ? 'Undefeated MVP' : 'MVP'}
            value={mvp ? `${mvp.name} (${mvp.won}-${mvp.lost})` : '-'}
            lines={mvp ? [mvp.line] : []}
          />
          <Card color="#3e8a75" label="Best partnership" value={bestPair?.label ?? '-'} lines={bestPair ? [bestPair.line] : []} />
          <Card color="#7a5ea8" label="Tightest contest" value={tightest?.score ?? '-'} lines={tightest ? [tightest.line] : []} />
        </View>

        <Section>Player standings &amp; performance leaderboard</Section>
        <View style={s.table}>
          <View style={s.th} fixed>
            <Text style={[s.thText, { width: COLS.rank }]}>Rank</Text>
            <Text style={[s.thText, { width: COLS.player }]}>Player</Text>
            <Text style={[s.thText, center, { width: COLS.played }]}>Played</Text>
            <Text style={[s.thText, center, { width: COLS.won }]}>Won</Text>
            <Text style={[s.thText, center, { width: COLS.lost }]}>Lost</Text>
            <Text style={[s.thText, center, { width: COLS.rate }]}>Win rate (%)</Text>
            <Text style={[s.thText, center, { width: COLS.pf }]}>Pts for</Text>
            <Text style={[s.thText, center, { width: COLS.pa }]}>Pts against</Text>
            <Text style={[s.thText, center, { width: COLS.diff }]}>Diff</Text>
            <Text style={[s.thText, center, { width: COLS.ppg }]}>PPG</Text>
          </View>
          {report.standings.map((r) => {
            const rs = RANK_STYLES[r.rank] ?? { bg: '#ffffff', border: '#d3d6de' };
            return (
              <View key={r.playerId} style={s.tr} wrap={false}>
                <View style={{ width: COLS.rank }}>
                  <View style={[s.rank, { backgroundColor: rs.bg, borderColor: rs.border }]}>
                    <Text style={[s.bold, { fontSize: 7.5 }]}>{r.rank}</Text>
                  </View>
                </View>
                <View style={{ width: COLS.player }}>
                  <Text style={s.bold}>
                    {r.name}
                    {r.isNew ? ' (New)' : ''}
                  </Text>
                  {r.rank === 1 && mvp && <Text style={{ fontSize: 6.5, color: '#c98a4b', fontFamily: B, marginTop: 1 }}>Top performer</Text>}
                </View>
                <Text style={[center, { width: COLS.played }]}>{r.played}</Text>
                <Text style={[center, s.bold, { width: COLS.won }]}>{r.won}</Text>
                <Text style={[center, { width: COLS.lost, color: '#a83c3c' }]}>{r.lost}</Text>
                <View style={{ width: COLS.rate, alignItems: 'center' }}>
                  <View style={s.barTrack}>
                    <View style={{ height: 3, borderRadius: 2, width: `${Math.max(3, r.winRate * 100)}%`, backgroundColor: winColor(r.winRate) }} />
                  </View>
                  <Text style={{ width: 64, marginTop: 2, fontFamily: B, fontSize: 8, color: winColor(r.winRate) }}>{pct(r.winRate)}</Text>
                </View>
                <Text style={[center, { width: COLS.pf }]}>{r.pointsFor}</Text>
                <Text style={[center, { width: COLS.pa }]}>{r.pointsAgainst}</Text>
                <View style={{ width: COLS.diff, alignItems: 'center' }}>
                  <Diff value={r.diff} />
                </View>
                <Text style={[center, s.bold, { width: COLS.ppg }]}>{oneDecimal(r.ppg)}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.boxTitle}>Partnership performance</Text>
            {report.partnerships.map((p, i) => (
              <View
                key={p.label}
                wrap={false}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3.5, borderTopWidth: i ? 1 : 0, borderTopColor: '#eceae4' }}
              >
                <Text style={[s.bold, { flex: 1, fontSize: 8 }]}>{p.label}</Text>
                <Text style={{ width: 62, fontSize: 8 }}>
                  {p.won} - {p.lost} ({pctRound(p.winRate)})
                </Text>
                <Diff value={p.diff} width={30} />
              </View>
            ))}
          </View>
          <View style={[s.box, { flex: 1.2 }]}>
            <Text style={s.boxTitle}>Key session takeaways</Text>
            {takeaways.map((t, i) => {
              const cut = t.indexOf(': ');
              const lead = cut > 0 && cut < 48 ? t.slice(0, cut + 1) : '';
              const rest = lead ? t.slice(cut + 2) : t;
              return (
                <View key={i} style={{ flexDirection: 'row', marginBottom: 5 }} wrap={false}>
                  <Text style={{ width: 9, fontSize: 8.5 }}>•</Text>
                  <Text style={{ flex: 1, fontSize: 8.5, lineHeight: 1.35 }}>
                    {lead && <Text style={s.bold}>{lead} </Text>}
                    {rest}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
        <Footer text={report.footer} />
      </Page>

      <Page size="A4" style={s.page}>
        <Section>{`Complete match-by-match log (${report.log.length} games)`}</Section>
        <View style={s.table}>
          <View style={s.th} fixed>
            <Text style={[s.thText, { width: LOG.match }]}>Match</Text>
            <Text style={[s.thText, { width: LOG.t1 }]}>Team 1</Text>
            <Text style={[s.thText, center, { width: LOG.score }]}>Score</Text>
            <Text style={[s.thText, { width: LOG.t2 }]}>Team 2</Text>
            <Text style={[s.thText, { width: LOG.winner }]}>Winner</Text>
            <Text style={[s.thText, { width: LOG.ctx }]}>Result &amp; context</Text>
          </View>
          {report.log.map((r) => {
            const done = r.status === 'completed';
            return (
              <View key={r.number} style={[s.tr, { paddingVertical: 7 }, done ? {} : { backgroundColor: '#f4f4f6' }]} wrap={false}>
                <Text style={[s.bold, { width: LOG.match }]}>{r.code}</Text>
                <Text style={[{ width: LOG.t1 }, r.winner === 'A' ? s.bold : {}]}>{r.team1}</Text>
                <Text style={[s.bold, center, { width: LOG.score, color: done ? NAVY : '#7a8090' }]}>
                  {r.scoreA ?? '-'} : {r.scoreB ?? '-'}
                  {r.status === 'unfinished' ? '*' : ''}
                </Text>
                <Text style={[{ width: LOG.t2 }, r.winner === 'B' ? s.bold : {}]}>{r.team2}</Text>
                <Text style={[s.bold, { width: LOG.winner, color: r.winner ? '#3c7a4a' : '#7a8090' }]}>
                  {r.winner ? `Team ${r.winner === 'A' ? 1 : 2}` : '—'}
                </Text>
                <Text style={{ width: LOG.ctx, fontSize: 8.5 }}>{r.context}</Text>
              </View>
            );
          })}
        </View>
        <Text style={{ fontSize: 7, color: GREY, marginTop: 6 }}>
          {report.unfinishedCount > 0 ? '* Match not completed; excluded from player standings, partnership records and totals. ' : ''}
          Margins are shown as winning score minus losing score.
        </Text>
        <Footer text={report.footer} />
      </Page>
    </Document>
  );
}
