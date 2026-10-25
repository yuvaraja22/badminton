import { Document, Font, Page, Path, StyleSheet, Svg, Text, View, Line } from '@react-pdf/renderer';
import { COMEBACK_MIN, longestRunOf, rallyHighlights, rallySummary, type MatchFlow } from '../../lib/engine/rally';
import { matchWinner, playerTeam, resultLine, rulesFor, teamScore, tournamentMatches, tournamentReport } from '../../lib/engine/tournament';
import { formatTime, longDate, matchCode } from '../../lib/format';
import { teamFill, teamName } from '../../lib/teamColors';
import type { PlayerId, TeamKey, Tournament, TournamentMatch } from '../../lib/types';
import { ReportPages } from '../report/ReportPdf';

/**
 * A4 schedule for a team tournament. Once matches are played it adds the point-by-point stats and the
 * same report a session gets (MVP, standings, partnerships, takeaways, match log). Built-in Helvetica.
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
  highlights: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  highlight: { width: '48.8%', backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 10 },
  kicker: { fontFamily: B, fontSize: 6.5, color: GREY, textTransform: 'uppercase', letterSpacing: 0.6 },
  footer: { position: 'absolute', bottom: 18, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: GREY },
});

const COL = { code: 34, time: 50, kind: 64, score: 54 };

/** A side's names with a team-colour dot. `stacked` when it sits under the other side (not in a table column). */
function Side({ t, team, ids, nameOf, winner, stacked }: { t: Tournament; team: TeamKey; ids: PlayerId[]; nameOf: (id: PlayerId) => string; winner: boolean; stacked?: boolean }) {
  return (
    <View style={[s.side, stacked ? {} : { flex: 1 }]}>
      <View style={[s.dot, { backgroundColor: teamFill(t, team) }]} />
      <Text style={winner ? { fontFamily: B } : undefined}>{ids.map(nameOf).join(' & ') || '–'}</Text>
    </View>
  );
}

function Result({ m }: { m: TournamentMatch }) {
  if (m.status === 'scheduled') return <Text style={{ width: COL.score, textAlign: 'right', color: GREY }}> </Text>;
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

const WORM = { w: 250, h: 34 };

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

function RallyPage({ t, nameOf }: { t: Tournament; nameOf: (id: PlayerId) => string }) {
  const r = rallySummary(t);
  const highlights = rallyHighlights(t, r, nameOf);
  const { a, b } = r.teams;
  const rows: [string, string | number, string | number][] = [
    ['Points won', a.points, b.points],
    ['Longest run', a.longestRun, b.longestRun],
    ['Biggest lead', a.biggestLead, b.biggestLead],
    ['Game points saved', a.gamePointsSaved, b.gamePointsSaved],
    [`Wins from ${COMEBACK_MIN}+ down`, a.comebackWins, b.comebackWins],
    ['First to halfway, then won', `${a.firstToHalfWon}/${a.firstToHalf}`, `${b.firstToHalfWon}/${b.firstToHalf}`],
  ];
  const center = { textAlign: 'center' as const };
  return (
    <Page size="A4" style={s.page}>
      <View style={s.header}>
        <Text style={s.title}>Point by point</Text>
        <Text style={s.subtitle}>
          {t.name} · from the live scorer, rally by rally · {r.flows.length} match{r.flows.length === 1 ? '' : 'es'}
        </Text>
      </View>

      <Text style={s.section}>Highlights</Text>
      <View style={s.highlights}>
        {highlights.map((h) => (
          <View key={h.label} style={s.highlight} wrap={false}>
            <Text style={s.kicker}>{h.label}</Text>
            <Text style={{ fontFamily: B, fontSize: 12, marginTop: 2 }}>{h.value}</Text>
            <Text style={{ fontSize: 8, color: GREY, marginTop: 2, lineHeight: 1.3 }}>{h.detail}</Text>
          </View>
        ))}
      </View>

      <Text style={s.section}>The teams</Text>
      <View style={s.table}>
        <View style={s.th}>
          <Text style={[s.thText, { flex: 1 }]}> </Text>
          {(['a', 'b'] as const).map((k) => (
            <View key={k} style={[s.side, { width: 110, justifyContent: 'center' }]}>
              <View style={[s.dot, { backgroundColor: teamFill(t, k) }]} />
              <Text style={s.thText}>{teamName(t, k)}</Text>
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

      <Text style={s.section}>Score flow</Text>
      <Text style={{ fontSize: 7.5, color: GREY, marginBottom: 6 }}>
        The lead after every point. Above the line: {teamName(t, 'a')} ahead. Below: {teamName(t, 'b')} ahead. Runs and leads are shown as{' '}
        {teamName(t, 'a')} / {teamName(t, 'b')}.
      </Text>
      <View style={s.table}>
        {r.flows.map((f, i) => (
          <View key={f.match.id} style={[s.tr, i === 0 ? { borderTopWidth: 0 } : {}]} wrap={false}>
            <Text style={{ width: COL.code, fontFamily: B }}>{matchCode(f.match.order)}</Text>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Side t={t} team="a" ids={f.match.a} nameOf={nameOf} winner={f.winner === 'a'} stacked />
              <Side t={t} team="b" ids={f.match.b} nameOf={nameOf} winner={f.winner === 'b'} stacked />
              <Text style={{ fontSize: 7, color: GREY, marginTop: 2 }}>
                {f.match.scoreA}–{f.match.scoreB} · run {longestRunOf(f, 'a')} / {longestRunOf(f, 'b')} · lead {f.maxLead.a.lead} / {f.maxLead.b.lead} ·{' '}
                {f.leadChanges} lead change{f.leadChanges === 1 ? '' : 's'}
              </Text>
            </View>
            <Worm t={t} flow={f} />
          </View>
        ))}
      </View>
      {r.typedIn.length > 0 && (
        <Text style={{ fontSize: 7, color: GREY, marginTop: 6 }}>
          {r.typedIn.map((m) => matchCode(m.order)).join(', ')} {r.typedIn.length === 1 ? 'was' : 'were'} typed in, so not included here.
        </Text>
      )}
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
  const hasRallies = rallySummary(t).flows.length > 0;
  const report = score.played > 0 ? tournamentReport(t, nameOf) : null;

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
          </View>
          {matches.map((m) => {
            const w = matchWinner(m);
            return (
              <View key={m.id} style={s.tr} wrap={false}>
                <Text style={{ width: COL.code, fontFamily: B }}>{matchCode(m.order)}</Text>
                <Text style={{ width: COL.time }}>{m.time ? formatTime(m.time) : '–'}</Text>
                <Text style={{ width: COL.kind, color: GREY }}>
                  {m.kind === 'doubles' ? 'Doubles' : 'Singles'}
                  {rulesFor(t, m).pointsToWin !== t.pointsToWin ? ` · to ${rulesFor(t, m).pointsToWin}` : ''}
                </Text>
                <Side t={t} team="a" ids={m.a} nameOf={nameOf} winner={w === 'a'} />
                <Side t={t} team="b" ids={m.b} nameOf={nameOf} winner={w === 'b'} />
                <Result m={m} />
              </View>
            );
          })}
          {!matches.length && (
            <View style={s.tr}>
              <Text style={{ color: GREY }}>No matches yet.</Text>
            </View>
          )}
        </View>
        <Footer />
      </Page>

      {hasRallies && <RallyPage t={t} nameOf={nameOf} />}
      {report && <ReportPages report={report} takeaways={report.autoTakeaways} />}
    </Document>
  );
}
