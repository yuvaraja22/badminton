import { Document, Font, Line, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import { matchFlow, rallyHighlights, rallySummary, type MatchFlow } from '../../lib/engine/rally';
import { matchWinner, playerTeam, resultLine, rulesFor, teamScore, tournamentMatches, tournamentReport } from '../../lib/engine/tournament';
import { formatTime, longDate, matchCode } from '../../lib/format';
import { teamFill, teamName } from '../../lib/teamColors';
import type { PlayerId, TeamKey, Tournament, TournamentMatch } from '../../lib/types';
import { ReportPairsAndTakeaways, ReportStandings } from '../report/ReportPdf';

/**
 * A4 PDF for a team tournament, kept to two pages. Page 1: the teams and every match (before play, the
 * schedule; after, scores, winners and a small score-flow chart). Page 2, once matches are played:
 * highlights, player standings, partnerships and takeaways. Built-in Helvetica.
 */

// Wrap at spaces only; never hyphenate names.
Font.registerHyphenationCallback((word) => [word]);

const INK = '#0f1f1a';
const COURT = '#11624b';
const VOLT = '#d4f53c';
const GREY = '#5b6862';
const LINE = '#e0d9c8';
const B = 'Helvetica-Bold';

const s = StyleSheet.create({
  page: { backgroundColor: '#fffdf8', paddingTop: 30, paddingBottom: 44, paddingHorizontal: 32, fontFamily: 'Helvetica', fontSize: 9, color: INK },
  header: { backgroundColor: COURT, borderRadius: 8, borderLeftWidth: 5, borderLeftColor: VOLT, paddingVertical: 14, paddingHorizontal: 18 },
  title: { fontFamily: B, fontSize: 18, color: '#ffffff', textTransform: 'uppercase' },
  subtitle: { fontSize: 8.5, color: '#cfe3da', marginTop: 4 },
  teams: { flexDirection: 'row', gap: 10, marginTop: 12 },
  team: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: 'hidden' },
  teamBar: { paddingVertical: 7, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamName: { fontFamily: B, fontSize: 11, color: '#ffffff' },
  teamWon: { fontFamily: B, fontSize: 16, color: '#ffffff' },
  teamPlayers: { paddingVertical: 7, paddingHorizontal: 10, lineHeight: 1.5 },
  summary: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6, flexDirection: 'row', justifyContent: 'space-between' },
  summaryMain: { fontFamily: B, fontSize: 11 },
  section: { fontFamily: B, fontSize: 10, textTransform: 'uppercase', marginTop: 16, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: LINE },
  table: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6 },
  th: { flexDirection: 'row', backgroundColor: '#f4f0e6', paddingVertical: 5, paddingHorizontal: 8 },
  thText: { fontFamily: B, fontSize: 6.5, color: GREY, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5.5, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: '#ece7d9' },
  side: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  facts: { flexDirection: 'row', gap: 8, marginTop: 12 },
  fact: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 9 },
  kicker: { fontFamily: B, fontSize: 6.5, color: GREY, textTransform: 'uppercase', letterSpacing: 0.6 },
  factValue: { fontFamily: B, fontSize: 10.5, marginTop: 2 },
  factDetail: { fontSize: 7.5, color: GREY, marginTop: 2, lineHeight: 1.3 },
  footer: { position: 'absolute', bottom: 18, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: GREY },
});

const COL = { code: 32, time: 46, kind: 52, score: 42, flow: 84 };

/** A side's names: bold for the winners, grey for the losers. */
function Side({ t, team, ids, nameOf, winner }: { t: Tournament; team: TeamKey; ids: PlayerId[]; nameOf: (id: PlayerId) => string; winner: TeamKey | null }) {
  return (
    <View style={[s.side, { flex: 1, paddingRight: 6 }]}>
      <View style={[s.dot, { backgroundColor: teamFill(t, team) }]} />
      <Text style={winner === team ? { fontFamily: B } : winner ? { color: GREY } : {}}>{ids.map(nameOf).join(' & ') || '–'}</Text>
    </View>
  );
}

function Result({ m }: { m: TournamentMatch }) {
  if (m.status === 'scheduled') return <Text style={{ width: COL.score }}> </Text>;
  return (
    <Text style={{ width: COL.score, textAlign: 'right', fontFamily: B }}>
      {m.status === 'live' ? 'Live ' : ''}
      {m.scoreA}–{m.scoreB}
    </Text>
  );
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text>Badminton Stats · times are tentative</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

const WORM = { w: COL.flow - 8, h: 18 };

/** The lead after every point: Team A's colour above the line, Team B's below. */
function Worm({ t, flow }: { t: Tournament; flow: MatchFlow }) {
  const { leads } = flow;
  const n = leads.length - 1;
  const mid = WORM.h / 2;
  const top = Math.max(3, ...leads.map(Math.abs));
  const x = (i: number) => ((i / n) * WORM.w).toFixed(1);
  const y = (lead: number) => (mid - (lead / top) * (mid - 1)).toFixed(1);
  const area = (clamp: (l: number) => number) => `M0,${mid} ${leads.map((l, i) => `L${x(i)},${y(clamp(l))}`).join(' ')} L${WORM.w},${mid} Z`;
  return (
    <Svg width={WORM.w} height={WORM.h} viewBox={`0 0 ${WORM.w} ${WORM.h}`}>
      <Path d={area((l) => Math.max(0, l))} fill={teamFill(t, 'a')} />
      <Path d={area((l) => Math.min(0, l))} fill={teamFill(t, 'b')} />
      <Line x1={0} x2={WORM.w} y1={mid} y2={mid} stroke={LINE} strokeWidth={0.75} />
    </Svg>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View style={s.fact} wrap={false}>
      <Text style={s.kicker}>{label}</Text>
      <Text style={s.factValue}>{value}</Text>
      {detail && <Text style={s.factDetail}>{detail}</Text>}
    </View>
  );
}

/** Three to a row. */
function FactRows({ facts }: { facts: { label: string; value: string; detail?: string }[] }) {
  const rows: (typeof facts)[] = [];
  for (let i = 0; i < facts.length; i += 3) rows.push(facts.slice(i, i + 3));
  return (
    <>
      {rows.map((row, i) => (
        <View key={i} style={[s.facts, i ? { marginTop: 8 } : {}]}>
          {row.map((f) => (
            <Fact key={f.label} {...f} />
          ))}
          {/* Keep the last row's boxes the same width as the others. */}
          {Array.from({ length: 3 - row.length }, (_, k) => (
            <View key={`gap${k}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </>
  );
}

function ResultsPage({ t, nameOf }: { t: Tournament; nameOf: (id: PlayerId) => string }) {
  const report = tournamentReport(t, nameOf);
  const { mvp, bestPair, tightest } = report;
  const facts = [
    ...(mvp ? [{ label: mvp.undefeated ? 'Undefeated MVP' : 'MVP', value: `${mvp.name} (${mvp.won}-${mvp.lost})`, detail: mvp.line }] : []),
    ...(bestPair ? [{ label: 'Best partnership', value: bestPair.label, detail: bestPair.line }] : []),
    ...(tightest ? [{ label: 'Tightest contest', value: tightest.score, detail: tightest.line }] : []),
    ...rallyHighlights(t, rallySummary(t), nameOf),
  ];
  return (
    <Page size="A4" style={s.page}>
      <View style={s.header}>
        <Text style={s.title}>{t.name}: results</Text>
        <Text style={s.subtitle}>
          {resultLine(t)} · {report.matchCount} matches · {report.totalPoints} points
        </Text>
      </View>
      <FactRows facts={facts} />
      <ReportStandings report={report} />
      <ReportPairsAndTakeaways report={report} takeaways={report.autoTakeaways} />
      <Footer />
    </Page>
  );
}

export function TournamentDocument({ t, nameOf }: { t: Tournament; nameOf: (id: PlayerId) => string }) {
  const matches = tournamentMatches(t);
  const score = teamScore(t);
  const doubles = matches.filter((m) => m.kind === 'doubles').length;
  const singles = matches.length - doubles;
  const playerLine = (key: TeamKey) =>
    t.teams[key].players.map((id) => `${nameOf(id)}${playerTeam(t, id) === 'both' ? ' (both teams)' : ''}`).join(', ') || 'No players yet';
  const headline = score.played === 0 ? null : resultLine(t);
  const flows = new Map(matches.map((m) => [m.id, m.status === 'completed' ? matchFlow(t, m) : null]));
  const anyFlow = [...flows.values()].some(Boolean);

  return (
    <Document title={t.name} author="Badminton Stats">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>{t.name}</Text>
          <Text style={s.subtitle}>
            {longDate(t.date)} · {teamName(t, 'a')} vs {teamName(t, 'b')} · {doubles} doubles, {singles} singles · one game to {t.pointsToWin} (win by 2, max {t.maxPoints})
          </Text>
        </View>

        <View style={s.teams}>
          {(['a', 'b'] as const).map((key) => (
            <View key={key} style={s.team}>
              <View style={[s.teamBar, { backgroundColor: teamFill(t, key) }]}>
                <Text style={s.teamName}>{teamName(t, key)}</Text>
                {score.played > 0 && <Text style={s.teamWon}>{score.won[key]}</Text>}
              </View>
              <Text style={s.teamPlayers}>{playerLine(key)}</Text>
            </View>
          ))}
        </View>

        {headline && (
          <View style={s.summary}>
            <Text style={s.summaryMain}>{headline}</Text>
            <Text style={{ color: GREY }}>
              Points {score.points.a}–{score.points.b} · {score.played} played{score.remaining ? ` · ${score.remaining} to play` : ''}
            </Text>
          </View>
        )}

        <Text style={s.section}>{score.played ? 'Matches' : 'Schedule'}</Text>
        <View style={s.table}>
          <View style={s.th}>
            <Text style={[s.thText, { width: COL.code }]}>#</Text>
            <Text style={[s.thText, { width: COL.time }]}>Time</Text>
            <Text style={[s.thText, { width: COL.kind }]}>Type</Text>
            <Text style={[s.thText, { flex: 1 }]}>{teamName(t, 'a')}</Text>
            <Text style={[s.thText, { flex: 1 }]}>{teamName(t, 'b')}</Text>
            <Text style={[s.thText, { width: COL.score, textAlign: 'right' }]}>Score</Text>
            {anyFlow && <Text style={[s.thText, { width: COL.flow, textAlign: 'right' }]}>Score flow</Text>}
          </View>
          {matches.map((m) => {
            const w = matchWinner(m);
            const flow = flows.get(m.id);
            return (
              <View key={m.id} style={s.tr} wrap={false}>
                <Text style={{ width: COL.code, fontFamily: B }}>{matchCode(m.order)}</Text>
                <Text style={{ width: COL.time }}>{m.time ? formatTime(m.time) : '–'}</Text>
                <Text style={{ width: COL.kind, color: GREY }}>
                  {m.kind === 'doubles' ? 'Doubles' : 'Singles'}
                  {rulesFor(t, m).pointsToWin !== t.pointsToWin ? ` · to ${rulesFor(t, m).pointsToWin}` : ''}
                </Text>
                <Side t={t} team="a" ids={m.a} nameOf={nameOf} winner={w} />
                <Side t={t} team="b" ids={m.b} nameOf={nameOf} winner={w} />
                <Result m={m} />
                {anyFlow && <View style={{ width: COL.flow, alignItems: 'flex-end' }}>{flow && <Worm t={t} flow={flow} />}</View>}
              </View>
            );
          })}
          {!matches.length && (
            <View style={s.tr}>
              <Text style={{ color: GREY }}>No matches yet.</Text>
            </View>
          )}
        </View>
        {anyFlow && (
          <Text style={{ fontSize: 7, color: GREY, marginTop: 5 }}>
            Score flow: the lead after every point, {teamName(t, 'a')}'s colour above the line and {teamName(t, 'b')}'s below. Winners in bold.
          </Text>
        )}
        <Footer />
      </Page>

      {score.played > 0 && <ResultsPage t={t} nameOf={nameOf} />}
    </Document>
  );
}
