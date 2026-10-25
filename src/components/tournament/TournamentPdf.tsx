import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { matchWinner, playerRecords, playerTeam, resultLine, rulesFor, teamScore, tournamentMatches } from '../../lib/engine/tournament';
import { formatTime, longDate, matchCode } from '../../lib/format';
import { teamFill, teamName } from '../../lib/teamColors';
import type { PlayerId, TeamKey, Tournament, TournamentMatch } from '../../lib/types';

/** A4 schedule (and, once matches are played, results) for a team tournament. Built-in Helvetica. */

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
  footer: { position: 'absolute', bottom: 18, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: GREY },
});

const COL = { code: 34, time: 50, kind: 64, score: 54 };

function Side({ t, team, ids, nameOf, winner }: { t: Tournament; team: TeamKey; ids: PlayerId[]; nameOf: (id: PlayerId) => string; winner: boolean }) {
  return (
    <View style={[s.side, { flex: 1 }]}>
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

export function TournamentDocument({ t, nameOf }: { t: Tournament; nameOf: (id: PlayerId) => string }) {
  const matches = tournamentMatches(t);
  const score = teamScore(t);
  const doubles = matches.filter((m) => m.kind === 'doubles').length;
  const singles = matches.length - doubles;
  const playerLine = (key: TeamKey) =>
    t.teams[key].players.map((id) => `${nameOf(id)}${playerTeam(t, id) === 'both' ? ' (both teams)' : ''}`).join(', ') || 'No players yet';
  const headline = score.played === 0 ? null : resultLine(t);

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

        {score.played > 0 && (
          <>
            <Text style={s.section}>Players</Text>
            <View style={s.table}>
              <View style={s.th}>
                <Text style={[s.thText, { flex: 1 }]}>Player</Text>
                <Text style={[s.thText, { width: 60, textAlign: 'center' }]}>Played</Text>
                <Text style={[s.thText, { width: 60, textAlign: 'center' }]}>W–L</Text>
                <Text style={[s.thText, { width: 70, textAlign: 'center' }]}>Points</Text>
                <Text style={[s.thText, { width: 50, textAlign: 'right' }]}>+/-</Text>
              </View>
              {playerRecords(t)
                .filter((l) => l.played > 0)
                .map((l) => (
                  <View key={l.playerId} style={s.tr} wrap={false}>
                    <View style={[s.side, { flex: 1 }]}>
                      {l.team !== 'b' && <View style={[s.dot, { backgroundColor: teamFill(t, 'a') }]} />}
                      {l.team !== 'a' && <View style={[s.dot, { backgroundColor: teamFill(t, 'b') }]} />}
                      <Text style={{ fontFamily: B }}>{nameOf(l.playerId)}</Text>
                      {l.team === 'both' && <Text style={{ color: GREY }}> (both teams)</Text>}
                    </View>
                    <Text style={{ width: 60, textAlign: 'center' }}>{l.played}</Text>
                    <Text style={{ width: 60, textAlign: 'center', fontFamily: B }}>
                      {l.won}–{l.lost}
                    </Text>
                    <Text style={{ width: 70, textAlign: 'center' }}>
                      {l.pointsFor}–{l.pointsAgainst}
                    </Text>
                    <Text style={{ width: 50, textAlign: 'right' }}>{l.pointsFor - l.pointsAgainst > 0 ? `+${l.pointsFor - l.pointsAgainst}` : l.pointsFor - l.pointsAgainst}</Text>
                  </View>
                ))}
            </View>
          </>
        )}

        <View style={s.footer} fixed>
          <Text>Badminton Stats · times are tentative</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
