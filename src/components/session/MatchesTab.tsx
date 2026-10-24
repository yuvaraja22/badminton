import clsx from 'clsx';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useData } from '../../lib/data/context';
import { sortedMatches, winnerSide } from '../../lib/engine/games';
import { matchCode } from '../../lib/format';
import { lineupOptions } from '../../lib/lineup';
import type { Match, Session } from '../../lib/types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, Empty } from '../ui/Card';
import { MatchDialog } from './MatchDialog';

export function MatchesTab({ session, isAdmin }: { session: Session; isAdmin: boolean }) {
  const { nameOf } = useData();
  const matches = sortedMatches(session);
  const [editing, setEditing] = useState<Match | 'new' | null>(null);

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
            <Plus size={15} /> Add a result
          </Button>
        </div>
      )}
      {!matches.length && <Empty title="No matches yet">Start the first match from the Court tab.</Empty>}
      <Card className="divide-y divide-line overflow-hidden">
        {matches.map((m) => {
          const w = m.status === 'completed' ? winnerSide({ ...m, sessionId: session.id, date: session.date }) : null;
          return (
            <button
              key={m.id}
              type="button"
              disabled={!isAdmin}
              onClick={() => setEditing(m)}
              className={clsx('flex w-full items-center gap-3 px-4 py-3 text-left', isAdmin && 'hover:bg-surface-2')}
            >
              <span className="font-score w-11 shrink-0 rounded-lg bg-surface-2 py-1 text-center text-[15px] leading-none font-black tracking-wide text-muted">
                {matchCode(m.number)}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className={clsx('block truncate', w === 'A' && 'font-bold')}>
                  {nameOf(m.teamA[0])} &amp; {nameOf(m.teamA[1])}
                </span>
                <span className={clsx('block truncate', w === 'B' && 'font-bold')}>
                  {nameOf(m.teamB[0])} &amp; {nameOf(m.teamB[1])}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-score tabular text-2xl leading-none font-black tracking-wide">
                  <span className={clsx(w === 'B' && 'text-muted')}>{m.scoreA ?? '–'}</span>
                  <span className="px-0.5 text-muted">:</span>
                  <span className={clsx(w === 'A' && 'text-muted')}>{m.scoreB ?? '–'}</span>
                </span>
                {m.status === 'live' && <Badge tone="live">On court</Badge>}
                {m.status === 'unfinished' && <Badge tone="warn">Stopped early</Badge>}
              </span>
            </button>
          );
        })}
      </Card>
      <MatchDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        session={session}
        match={editing === 'new' ? null : editing}
        options={lineupOptions(session, nameOf)}
      />
    </div>
  );
}
