import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { playerTeam, resultLine, rulesFor, teamScore, tournamentMatches, tournamentRally, tournamentReport } from '../../lib/engine/tournament';
import { formatTime, longDate, matchCode } from '../../lib/format';
import { teamFill, teamName, tournamentSides } from '../../lib/teamColors';
import type { PlayerId, TeamKey, Tournament } from '../../lib/types';
import { FlowRow } from '../report/RallyPdf';
import { RallySection, ReportPages } from '../report/ReportPdf';

/**
 * A4 PDF for a team tournament. Before play: the schedule. Once matches are played: the Results tab as
 * it reads in the app (result, point by point, then the report with each match's score flow in the log).
 * Built-in Helvetica.
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
  // Page, header and section styles match the report pages (ReportPdf) so the PDF reads as one document.
  page: { backgroundColor: '#fffdf8', paddingTop: 34, paddingBottom: 46, paddingHorizontal: 34, fontFamily: 'Helvetica', fontSize: 9, color: INK },
  header: { backgroundColor: COURT, borderRadius: 8, paddingVertical: 16, paddingLeft: 22, paddingRight: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' },
  headerAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: VOLT, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  title: { fontFamily: B, fontSize: 18, color: '#ffffff', textTransform: 'uppercase' },
  subtitle: { fontSize: 8, color: '#cfe3da', marginTop: 4 },
  pill: { backgroundColor: VOLT, borderRadius: 10, paddingVertical: 4, paddingHorizontal: 9, fontFamily: B, fontSize: 7.5, color: INK, textTransform: 'uppercase', marginLeft: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 7, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: LINE },
  sectionMark: { width: 10, height: 5, borderRadius: 1, backgroundColor: VOLT, marginRight: 7 },
  sectionText: { fontFamily: B, fontSize: 10, textTransform: 'uppercase' },
  board: { flexDirection: 'row', gap: 4, marginTop: 12, borderRadius: 8, overflow: 'hidden' },
  boardSide: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  teams: { flexDirection: 'row', gap: 10, marginTop: 12 },
  team: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6, overflow: 'hidden' },
  teamBar: { paddingVertical: 7, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamName: { fontFamily: B, fontSize: 11, color: '#ffffff' },
  teamPlayers: { paddingVertical: 7, paddingHorizontal: 10, lineHeight: 1.5 },
  table: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6 },
  th: { flexDirection: 'row', backgroundColor: '#f4f0e6', paddingVertical: 5, paddingHorizontal: 8 },
  thText: { fontFamily: B, fontSize: 6.5, color: GREY, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5.5, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: '#ece7d9' },
  side: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  footer: { position: 'absolute', bottom: 20, left: 34, right: 34, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: GREY },
});

const COL = { code: 32, time: 46, kind: 52 };

function Footer({ text }: { text: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{text}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function Header({ title, subtitle, pill }: { title: string; subtitle: string; pill: string }) {
  return (
    <View style={s.header}>
      <View style={s.headerAccent} />
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>
      </View>
      <Text style={s.pill}>{pill}</Text>
    </View>
  );
}

function Section({ children }: { children: string }) {
  return (
    <View style={s.sectionRow} wrap={false}>
      <View style={s.sectionMark} />
      <Text style={s.sectionText}>{children}</Text>
    </View>
  );
}

const playerLine = (t: Tournament, key: TeamKey, nameOf: (id: PlayerId) => string) =>
  t.teams[key].players.map((id) => `${nameOf(id)}${playerTeam(t, id) === 'both' ? ' (both teams)' : ''}`).join(', ') || 'No players yet';

// ---------------------------------------------------------------- before play: the schedule

function Side({ t, team, ids, nameOf }: { t: Tournament; team: TeamKey; ids: PlayerId[]; nameOf: (id: PlayerId) => string }) {
  return (
    <View style={[s.side, { flex: 1, paddingRight: 6 }]}>
      <View style={[s.dot, { backgroundColor: teamFill(t, team) }]} />
      <Text>{ids.map(nameOf).join(' & ') || '–'}</Text>
    </View>
  );
}

function SchedulePage({ t, nameOf }: { t: Tournament; nameOf: (id: PlayerId) => string }) {
  const matches = tournamentMatches(t);
  const doubles = matches.filter((m) => m.kind === 'doubles').length;
  return (
    <Page size="A4" style={s.page}>
      <Header
        title={t.name}
        subtitle={`${longDate(t.date)} · ${teamName(t, 'a')} vs ${teamName(t, 'b')} · one game to ${t.pointsToWin} (win by 2, max ${t.maxPoints})`}
        pill={`Schedule • ${doubles} doubles, ${matches.length - doubles} singles`}
      />
      <View style={s.teams}>
        {(['a', 'b'] as const).map((key) => (
          <View key={key} style={s.team}>
            <View style={[s.teamBar, { backgroundColor: teamFill(t, key) }]}>
              <Text style={s.teamName}>{teamName(t, key)}</Text>
            </View>
            <Text style={s.teamPlayers}>{playerLine(t, key, nameOf)}</Text>
          </View>
        ))}
      </View>
      <Section>Schedule</Section>
      <View style={s.table}>
        <View style={s.th}>
          <Text style={[s.thText, { width: COL.code }]}>#</Text>
          <Text style={[s.thText, { width: COL.time }]}>Time</Text>
          <Text style={[s.thText, { width: COL.kind }]}>Type</Text>
          <Text style={[s.thText, { flex: 1 }]}>{teamName(t, 'a')}</Text>
          <Text style={[s.thText, { flex: 1 }]}>{teamName(t, 'b')}</Text>
        </View>
        {matches.map((m) => (
          <View key={m.id} style={s.tr} wrap={false}>
            <Text style={{ width: COL.code, fontFamily: B }}>{matchCode(m.order)}</Text>
            <Text style={{ width: COL.time }}>{m.time ? formatTime(m.time) : '–'}</Text>
            <Text style={{ width: COL.kind, color: GREY }}>
              {m.kind === 'doubles' ? 'Doubles' : 'Singles'}
              {rulesFor(t, m).pointsToWin !== t.pointsToWin ? ` · to ${rulesFor(t, m).pointsToWin}` : ''}
            </Text>
            <Side t={t} team="a" ids={m.a} nameOf={nameOf} />
            <Side t={t} team="b" ids={m.b} nameOf={nameOf} />
          </View>
        ))}
        {!matches.length && (
          <View style={s.tr}>
            <Text style={{ color: GREY }}>No matches yet.</Text>
          </View>
        )}
      </View>
      <Footer text="Badminton Stats · times are tentative" />
    </Page>
  );
}

// ---------------------------------------------------------------- after play: the Results tab

/** Both teams in their colours with matches won and players; the winners tagged. One line underneath sums it up. */
function Scoreboard({ t, nameOf }: { t: Tournament; nameOf: (id: PlayerId) => string }) {
  const score = teamScore(t);
  const total = score.played + score.remaining;
  const done = t.status === 'completed';
  return (
    <>
      <View style={s.board}>
        {(['a', 'b'] as const).map((k) => (
          <View key={k} style={[s.boardSide, { backgroundColor: teamFill(t, k) }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: B, fontSize: 12, color: '#ffffff' }}>{teamName(t, k)}</Text>
              {done && score.leader === k && <Text style={[s.pill, { fontSize: 6.5, paddingVertical: 3 }]}>Winners</Text>}
            </View>
            <Text style={{ fontFamily: B, fontSize: 34, color: '#ffffff', marginTop: 4 }}>{score.won[k]}</Text>
            <Text style={{ fontSize: 8, color: '#ffffff', marginTop: 4, lineHeight: 1.4 }}>{playerLine(t, k, nameOf)}</Text>
          </View>
        ))}
      </View>
      <Text style={{ textAlign: 'center', marginTop: 8, color: GREY }}>
        <Text style={{ fontFamily: B, color: INK }}>{resultLine(t)}</Text>
        {`  ·  Points ${score.points.a}–${score.points.b}  ·  ${score.played} of ${total} played  ·  most matches won takes it, points break a tie`}
      </Text>
    </>
  );
}

/** The Results tab as a PDF: who won (title and scoreboard), every match with its flow, point by point, individual stats. */
function ResultsPages({ t, nameOf }: { t: Tournament; nameOf: (id: PlayerId) => string }) {
  const rally = tournamentRally(t);
  const sides = tournamentSides(t);
  const report = tournamentReport(t, nameOf);
  const flows = new Map(rally.flows.map((f) => [f.match.order, f]));
  const typed = rally.typedIn.length
    ? ` ${rally.typedIn.map((m) => matchCode(m.order)).join(', ')} ${rally.typedIn.length === 1 ? 'was' : 'were'} typed in, so not included.`
    : '';
  return (
    <ReportPages
      report={report}
      takeaways={report.autoTakeaways}
      top={
        <>
          <Header title={t.name} subtitle={`${longDate(t.date)} • ${teamName(t, 'a')} vs ${teamName(t, 'b')}`} pill={t.status === 'completed' ? 'Final result' : 'Result so far'} />
          <Scoreboard t={t} nameOf={nameOf} />
        </>
      }
      logExtra={(n) => {
        const f = flows.get(n);
        return f ? <FlowRow sides={sides} flow={f} /> : null;
      }}
      rally={<RallySection rally={{ summary: rally, sides, nameOf }} note={`From the live scorer, rally by rally.${typed}`} />}
    />
  );
}

export function TournamentDocument({ t, nameOf }: { t: Tournament; nameOf: (id: PlayerId) => string }) {
  return (
    <Document title={t.name} author="Badminton Stats">
      {teamScore(t).played > 0 ? <ResultsPages t={t} nameOf={nameOf} /> : <SchedulePage t={t} nameOf={nameOf} />}
    </Document>
  );
}
