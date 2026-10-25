import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MoreVertical, Pencil, Plus, Tv } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useData } from '../../lib/data/context';
import { lastEditOf } from '../../lib/edits';
import { rallyGameOfMatch, sortedMatches, winnerSide } from '../../lib/engine/games';
import { matchFlow } from '../../lib/engine/rally';
import { formatStamp, matchCode } from '../../lib/format';
import { lineupOptions } from '../../lib/lineup';
import { SESSION_SIDES } from '../../lib/teamColors';
import type { Match, Session } from '../../lib/types';
import { EditHistory } from '../EditHistory';
import { ScoreFlow } from '../tournament/ScoreFlow';
import { SideRow } from '../tournament/TeamBits';
import { Badge, LiveDot } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Menu, type MenuItem } from '../ui/Menu';
import { MatchDialog } from './MatchDialog';

/** When a match went on court, e.g. "7:42 PM" (older matches have no real time). */
const startedAt = (m: Match) => (m.createdAt && m.createdAt > 1e12 ? new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null);

/**
 * Every match of the session, laid out like a tournament's schedule: Team 1 and Team 2 in their colours
 * with the winners tagged, the score, and the score flow of matches scored live. A match opens its own
 * page (the live scorer, or its summary); admins edit it from its menu.
 */
export function MatchesTab({ session, isAdmin }: { session: Session; isAdmin: boolean }) {
  const { nameOf } = useData();
  const navigate = useNavigate();
  const matches = sortedMatches(session);
  const [editing, setEditing] = useState<Match | 'new' | null>(null);
  const live = session.status === 'live';
  const pathOf = (m: Pick<Match, 'id'>) => `/sessions/${session.id}/matches/${m.id}`;
  const byNumber = new Map(matches.map((m) => [m.number, m]));
  const hrefOf = (n: number) => {
    const m = byNumber.get(n);
    return m ? pathOf(m) : null;
  };
  const finished = matches.filter((m) => m.status === 'completed').length;
  const stopped = matches.filter((m) => m.status === 'unfinished').length;

  const actions = (m: Match): MenuItem[] => [
    { label: m.status === 'live' && (m.log || m.scorer) ? 'Open the live scorer' : 'Open', icon: <Tv size={16} />, onClick: () => navigate(pathOf(m)) },
    { label: 'Edit players or score', icon: <Pencil size={16} />, onClick: () => setEditing(m) },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={`${matches.length} match${matches.length === 1 ? '' : 'es'}`}
          subtitle={[`${finished} finished`, stopped ? `${stopped} stopped early` : null, `game to ${session.pointsToWin}`].filter(Boolean).join(' · ')}
        />
        {/* Like a finished tournament: once the session has ended, reopen it to add a result. */}
        {isAdmin && live && (
          <div className="flex gap-2 px-4 pt-3">
            <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
              <Plus size={15} /> Add a result
            </Button>
          </div>
        )}
        {matches.length === 0 ? (
          <p className="px-4 pt-2 pb-4 text-sm text-muted">{live ? 'No matches yet. Start the first one from the Court tab.' : 'No matches were played.'}</p>
        ) : (
          <ol className="divide-y divide-line pt-2">
            {matches.map((m) => {
              const w = m.status === 'completed' ? winnerSide({ ...m, sessionId: session.id, date: session.date }) : null;
              // Finished and scored point by point: how the game went.
              const flow = m.status === 'completed' ? matchFlow(rallyGameOfMatch(m, session.pointsToWin)) : null;
              const edit = lastEditOf(session.edits, m.number);
              const changed = edit && !edit.text.startsWith(`${matchCode(m.number)} result`) ? edit : null;
              const scoring = m.status === 'live' && Boolean(m.log || m.scorer);
              const detail = [startedAt(m), m.log && m.status !== 'live' ? 'scored live' : null].filter(Boolean).join(' · ');
              return (
                <li key={m.id} className={cn('px-4 py-3', m.status === 'live' && 'bg-accent/5')}>
                  <div className="flex min-h-8 items-center gap-2">
                    <span className="font-score text-lg leading-none font-black tracking-wide">{matchCode(m.number)}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted">{detail || 'Doubles'}</span>
                    {m.status === 'completed' && (
                      <span className="font-score tabular text-xl leading-none font-black">
                        {m.scoreA}–{m.scoreB}
                      </span>
                    )}
                    {m.status === 'unfinished' && (
                      <Badge tone="warn">
                        {m.scoreA != null && m.scoreB != null ? `${m.scoreA}–${m.scoreB} · ` : ''}Stopped early
                      </Badge>
                    )}
                    {m.status === 'live' && (
                      <Link to={pathOf(m)}>
                        <Badge tone="live">
                          <LiveDot /> {scoring ? `${m.scoreA ?? 0}–${m.scoreB ?? 0}` : 'On court'}
                        </Badge>
                      </Link>
                    )}
                    {isAdmin && <Menu trigger={<MoreVertical size={18} />} items={actions(m)} label={`${matchCode(m.number)} actions`} />}
                  </div>
                  <Link to={pathOf(m)} className="mt-1 block space-y-1 text-sm">
                    <SideRow fill={SESSION_SIDES.a.fill} label={SESSION_SIDES.a.name} ids={m.teamA} result={w && (w === 'A' ? 'won' : 'lost')} />
                    <SideRow fill={SESSION_SIDES.b.fill} label={SESSION_SIDES.b.name} ids={m.teamB} result={w && (w === 'B' ? 'won' : 'lost')} />
                  </Link>
                  {flow && <ScoreFlow sides={SESSION_SIDES} flow={flow} />}
                  {changed && (
                    <p className="mt-1 text-xs text-muted">
                      Changed by {changed.by} · {formatStamp(changed.at)}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Card>
      <MatchDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        session={session}
        match={editing === 'new' ? null : editing}
        options={lineupOptions(session, nameOf)}
      />
      <EditHistory edits={session.edits} hrefOf={hrefOf} />
    </div>
  );
}
