import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ChevronLeft, CircleStop, MoreVertical, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { completeSession, deleteSession, reopenSession, updateSessionDetails } from '../lib/data/mutations';
import { useSession } from '../lib/data/useSession';
import { newPlayersFor } from '../lib/engine/alltime';
import { sessionGames, sortedMatches } from '../lib/engine/games';
import { buildReport } from '../lib/engine/report';
import { longDate, matchCode } from '../lib/format';
import { toast } from '../lib/toast';
import type { Session } from '../lib/types';
import { CourtTab } from '../components/session/CourtTab';
import { MatchesTab } from '../components/session/MatchesTab';
import { ReportTab } from '../components/session/ReportTab';
import { Badge, LiveDot } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Empty, Notice, Spinner } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input, Select } from '../components/ui/Field';
import { Menu } from '../components/ui/Menu';
import { Segmented } from '../components/ui/Segmented';

type Tab = 'court' | 'matches' | 'report';

function EndSessionDialog({ open, onClose, session, onEnded }: { open: boolean; onClose: () => void; session: Session; onEnded: () => void }) {
  const { nameOf, history } = useData();
  const live = sortedMatches(session).find((m) => m.status === 'live');
  // Takeaways for the final state, where anything still on court counts as stopped early.
  const finalTakeaways = useMemo(() => {
    if (session.takeaways) return session.takeaways;
    const games = sessionGames(session).map((g) => (g.status === 'live' ? { ...g, status: 'unfinished' as const } : g));
    return buildReport({ title: session.title, date: session.date, pointsToWin: session.pointsToWin, games, nameOf, newPlayers: newPlayersFor(session, history) })
      .autoTakeaways;
  }, [session, nameOf, history]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="End this session?"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Not yet
          </Button>
          <Button
            variant="accent"
            onClick={() => {
              completeSession(session, finalTakeaways);
              onEnded();
            }}
          >
            End session
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <p>The final report is created and the results are added to everyone's all-time stats. You can still edit results or reopen it later.</p>
        {live && (
          <Notice tone="warn">
            {matchCode(live.number)} is still on court. It will be saved as “stopped early” and not counted. If it finished, enter its score first.
          </Notice>
        )}
      </div>
    </Dialog>
  );
}

function EditSessionDialog({ open, onClose, session }: { open: boolean; onClose: () => void; session: Session }) {
  return (
    <Dialog open={open} onClose={onClose} title="Session details">
      {open && <EditSessionForm session={session} onDone={onClose} />}
    </Dialog>
  );
}

function EditSessionForm({ session, onDone }: { session: Session; onDone: () => void }) {
  const [date, setDate] = useState(session.date);
  const [title, setTitle] = useState(session.title);
  const [points, setPoints] = useState(session.pointsToWin);
  return (
    <div className="space-y-4">
      <Field label="Date">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Game to">
        <Select value={points} onChange={(e) => setPoints(Number(e.target.value))}>
          {[11, 15, 21].map((p) => (
            <option key={p} value={p}>
              {p} points
            </option>
          ))}
        </Select>
      </Field>
      <Button
        block
        disabled={!date || !title.trim()}
        onClick={() => {
          updateSessionDetails(session, { date, title: title.trim(), pointsToWin: points });
          onDone();
        }}
      >
        Save
      </Button>
    </div>
  );
}

export default function SessionPage() {
  const { id } = useParams();
  const { session, loading, error } = useSession(id);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<'end' | 'edit' | 'delete' | null>(null);

  if (loading) return <Spinner />;
  if (error) return <Notice tone="bad">Couldn't load this session: {error}</Notice>;
  if (!session) {
    return (
      <Empty title="Session not found">
        It may have been deleted. <Link to="/sessions" className="font-semibold underline">See all sessions</Link>
      </Empty>
    );
  }

  const live = session.status === 'live';
  const tabs: { value: Tab; label: string }[] = live
    ? [
        { value: 'court', label: 'Court' },
        { value: 'matches', label: 'Matches' },
        { value: 'report', label: 'Report' },
      ]
    : [
        { value: 'report', label: 'Report' },
        { value: 'matches', label: 'Matches' },
      ];
  const requested = params.get('tab') as Tab | null;
  const tab = tabs.some((t) => t.value === requested) ? requested! : tabs[0].value;
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  return (
    <div>
      <Link to="/sessions" className="mb-1 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Sessions
      </Link>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-bold tracking-tight">{session.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {longDate(session.date)}
            {live ? (
              <Badge tone="live">
                <LiveDot /> Live
              </Badge>
            ) : (
              <Badge tone="good">Final</Badge>
            )}
          </p>
        </div>
        {isAdmin && (
          <Menu
            trigger={<MoreVertical size={20} />}
            items={[
              { label: 'Edit details', icon: <Pencil size={16} />, onClick: () => setDialog('edit') },
              live
                ? { label: 'End session', icon: <CircleStop size={16} />, onClick: () => setDialog('end') }
                : {
                    label: 'Reopen session',
                    icon: <RotateCcw size={16} />,
                    onClick: () => {
                      reopenSession(session);
                      toast('Session reopened. End it again to update the all-time stats.');
                    },
                  },
              { label: 'Delete session', icon: <Trash2 size={16} />, danger: true, onClick: () => setDialog('delete') },
            ]}
          />
        )}
      </div>

      <Segmented value={tab} onChange={setTab} options={tabs} className="mb-4" />

      {tab === 'court' && live && <CourtTab session={session} isAdmin={isAdmin} />}
      {tab === 'matches' && <MatchesTab session={session} isAdmin={isAdmin} />}
      {tab === 'report' && <ReportTab session={session} isAdmin={isAdmin} />}

      {isAdmin && live && tab === 'court' && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={() => setDialog('end')}>
            <CircleStop size={16} /> End session &amp; create report
          </Button>
        </div>
      )}

      <EndSessionDialog
        open={dialog === 'end'}
        onClose={() => setDialog(null)}
        session={session}
        onEnded={() => {
          setDialog(null);
          setTab('report');
          toast('Session ended. The report is ready.', 'success');
        }}
      />
      <EditSessionDialog open={dialog === 'edit'} onClose={() => setDialog(null)} session={session} />
      <Dialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete this session?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteSession(session);
                setDialog(null);
                navigate('/sessions');
                toast('Session deleted');
              }}
            >
              Delete permanently
            </Button>
          </div>
        }
      >
        <p className="text-sm">
          All {sortedMatches(session).length} matches of “{session.title}” ({longDate(session.date)}) will be removed, including from the all-time stats. This
          can't be undone.
        </p>
      </Dialog>
    </div>
  );
}
