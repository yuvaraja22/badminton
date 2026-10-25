import { Document, Font, Line, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import { COMEBACK_MIN, longestRunOf, rallyHighlights, rallySummary, type MatchFlow, type RallySummary } from '../../lib/engine/rally';
import { playerTeam, resultLine, rulesFor, teamScore, tournamentMatches, tournamentReport } from '../../lib/engine/tournament';
import { formatTime, longDate, matchCode } from '../../lib/format';
import { teamFill, teamName } from '../../lib/teamColors';
import type { PlayerId, TeamKey, Tournament } from '../../lib/types';
import { ReportPages } from '../report/ReportPdf';

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
  box: { marginTop: 10, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6 },
  section: { fontFamily: B, fontSize: 10, textTransform: 'uppercase', marginTop: 16, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: LINE },
  table: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6 },
  th: { flexDirection: 'row', backgroundColor: '#f4f0e6', paddingVertical: 5, paddingHorizontal: 8 },
  thText: { fontFamily: B, fontSize: 6.5, color: GREY, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5.5, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: '#ece7d9' },
  side: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tile: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: LINE, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 10 },
  kicker: { fontFamily: B, fontSize: 6.5, color: GREY, textTransform: 'uppercase', letterSpacing: 0.6 },
  tileValue: { fontFamily: B, fontSize: 13, marginTop: 2 },
  tileDetail: { fontSize: 7.5, color: GREY, marginTop: 2, lineHeight: 1.3 },
  footer: { position: 'absolute', bottom: 18, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: GREY },
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

/** The title band and both teams with their players (and matches won, once play starts). */
function Top({ t, nameOf, subtitle }: { t: Tournament; nameOf: (id: PlayerId) => string; subtitle: string }) {
  const score = teamScore(t);
  const playerLine = (key: TeamKey) =>
    t.teams[key].players.map((id) => `${nameOf(id)}${playerTeam(t, id) === 'both' ? ' (both teams)' : ''}`).join(', ') || 'No players yet';
  return (
    <>
      <View style={s.header}>
        <Text style={s.title}>{t.name}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>
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
    </>
  );
}

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
      <Top
        t={t}
        nameOf={nameOf}
        subtitle={`${longDate(t.date)} · ${teamName(t, 'a')} vs ${teamName(t, 'b')} · ${doubles} doubles, ${matches.length - doubles} singles · one game to ${t.pointsToWin} (win by 2, max ${t.maxPoints})`}
      />
      <Text style={s.section}>Schedule</Text>
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

const WORM = { w: 360, h: 28 };

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

/** Under each match in the report's log: its score flow and the numbers beside it. */
function FlowRow({ t, flow }: { t: Tournament; flow: MatchFlow }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Worm t={t} flow={flow} />
      <Text style={{ flex: 1, marginLeft: 10, fontSize: 7, color: GREY, lineHeight: 1.4 }}>
        Longest run {longestRunOf(flow, 'a')} / {longestRunOf(flow, 'b')}
        {'\n'}Biggest lead {flow.maxLead.a.lead} / {flow.maxLead.b.lead}
        {'\n'}
        {flow.leadChanges} lead change{flow.leadChanges === 1 ? '' : 's'}
      </Text>
    </View>
  );
}

interface TileData {
  label: string;
  value: string;
  detail?: string;
}

/** Tiles `per` to a row, the last row padded so every tile keeps the same width. */
function TileRows({ tiles, per }: { tiles: TileData[]; per: number }) {
  const rows: TileData[][] = [];
  for (let i = 0; i < tiles.length; i += per) rows.push(tiles.slice(i, i + per));
  return (
    <>
      {rows.map((row, i) => (
        <View key={i} style={s.row}>
          {row.map((x) => (
            <View key={x.label} style={s.tile} wrap={false}>
              <Text style={s.kicker}>{x.label}</Text>
              <Text style={s.tileValue}>{x.value}</Text>
              {x.detail && <Text style={s.tileDetail}>{x.detail}</Text>}
            </View>
          ))}
          {Array.from({ length: per - row.length }, (_, k) => (
            <View key={`gap${k}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </>
  );
}

function TeamRallyTable({ t, r }: { t: Tournament; r: RallySummary }) {
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
    <View style={[s.table, { marginTop: 8 }]}>
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
  );
}

function ResultsPages({ t, nameOf }: { t: Tournament; nameOf: (id: PlayerId) => string }) {
  const score = teamScore(t);
  const rally = rallySummary(t);
  const report = tournamentReport(t, nameOf);
  const flows = new Map(rally.flows.map((f) => [f.match.order, f]));
  const total = score.played + score.remaining;
  return (
    <>
      <Page size="A4" style={s.page}>
        <Top t={t} nameOf={nameOf} subtitle={`${longDate(t.date)} · ${teamName(t, 'a')} vs ${teamName(t, 'b')}`} />
        <View style={s.box}>
          <Text style={{ fontFamily: B, fontSize: 12 }}>{resultLine(t)}</Text>
          <Text style={{ color: GREY, marginTop: 2 }}>Most matches won takes the tournament; total points break a tie.</Text>
        </View>
        <TileRows
          per={3}
          tiles={[
            { label: 'Matches won', value: `${score.won.a}–${score.won.b}`, detail: `${teamName(t, 'a')} – ${teamName(t, 'b')}` },
            { label: 'Points', value: `${score.points.a}–${score.points.b}`, detail: 'finished matches' },
            { label: 'Played', value: `${score.played}/${total}`, detail: score.remaining ? `${score.remaining} to play` : 'all done' },
          ]}
        />
        {rally.flows.length > 0 && (
          <>
            <Text style={s.section}>Point by point</Text>
            <Text style={{ fontSize: 7.5, color: GREY }}>From the live scorer, rally by rally. Each match's score flow is in the match log.</Text>
            <TileRows per={2} tiles={rallyHighlights(t, rally, nameOf)} />
            <TeamRallyTable t={t} r={rally} />
            {rally.typedIn.length > 0 && (
              <Text style={{ fontSize: 7, color: GREY, marginTop: 6 }}>
                {rally.typedIn.map((m) => matchCode(m.order)).join(', ')} {rally.typedIn.length === 1 ? 'was' : 'were'} typed in, so not in the
                point-by-point numbers.
              </Text>
            )}
          </>
        )}
        <Footer text={report.footer} />
      </Page>
      <ReportPages
        report={report}
        takeaways={report.autoTakeaways}
        logExtra={(n) => {
          const f = flows.get(n);
          return f ? <FlowRow t={t} flow={f} /> : null;
        }}
      />
    </>
  );
}

export function TournamentDocument({ t, nameOf }: { t: Tournament; nameOf: (id: PlayerId) => string }) {
  return (
    <Document title={t.name} author="Badminton Stats">
      {teamScore(t).played > 0 ? <ResultsPages t={t} nameOf={nameOf} /> : <SchedulePage t={t} nameOf={nameOf} />}
    </Document>
  );
}
