import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, CircleStop, Download, MoreVertical, Pencil, RotateCcw, Share2, Trash2 } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { deleteTournament, updateTournament } from '../lib/data/mutations';
import { liveMatch, resultLine, teamScore } from '../lib/engine/tournament';
import { longDate, matchCode } from '../lib/format';
import { toast } from '../lib/toast';
import type { Tournament } from '../lib/types';
import { exportTournamentPdf } from '../components/tournament/exportTournamentPdf';
import { ResultsTab } from '../components/tournament/ResultsTab';
import { ScheduleTab } from '../components/tournament/ScheduleTab';
import { SideNames, TeamScoreBar, TournamentStatusBadge } from '../components/tournament/TeamBits';
import { TeamsTab } from '../components/tournament/TeamsTab';
import { LiveDot } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, Empty, Notice, Spinner } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { Field, Input } from '../components/ui/Field';
import { Menu } from '../components/ui/Menu';
import { Segmented } from '../components/ui/Segmented';

type Tab = 'schedule' | 'teams' | 'results';

function DetailsForm({ t, onDone }: { t: Tournament; onDone: () => void }) {
  const [name, setName] = useState(t.name);
  const [date, setDate] = useState(t.date);
  return (
    <div className="space-y-4">
      <Field label="Name">
        <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Date">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Button
        block
        disabled={!name.trim() || !date}
        onClick={() => {
          updateTournament(t.id, { name: name.trim(), date });
          onDone();
        }}
      >
        Save
      </Button>
    </div>
  );
}

export default function TournamentPage() {
  const { id } = useParams();
  const { tournaments, nameOf } = useData();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState<'details' | 'finish' | 'delete' | null>(null);
  const [busy, setBusy] = useState<'share' | 'download' | null>(null);

  if (tournaments === null) return <Spinner />;
  const t = tournaments.find((x) => x.id === id);
  if (!t) {
    return (
      <Empty title="Tournament not found">
        It may have been deleted.{' '}
        <Link to="/tournaments" className="font-semibold underline">
          See all tournaments
        </Link>
      </Empty>
    );
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: 'schedule', label: 'Schedule' },
    { value: 'teams', label: 'Teams' },
    { value: 'results', label: 'Results' },
  ];
  const requested = params.get('tab') as Tab | null;
  const tab = tabs.some((x) => x.value === requested) ? requested! : 'schedule';
  const live = liveMatch(t);
  const score = teamScore(t);

  const exportPdf = async (mode: 'share' | 'download') => {
    setBusy(mode);
    try {
      const result = await exportTournamentPdf(t, nameOf, mode);
      if (result === 'downloaded') toast('PDF downloaded', 'success');
    } catch (e) {
      toast(`Couldn't create the PDF: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Link to="/tournaments" className="mb-1 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ChevronLeft size={16} /> Tournaments
      </Link>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-bold tracking-tight">{t.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {longDate(t.date)} <TournamentStatusBadge t={t} />
          </p>
        </div>
        {isAdmin && (
          <Menu
            trigger={<MoreVertical size={20} />}
            items={[
              { label: 'Edit name and date', icon: <Pencil size={16} />, onClick: () => setDialog('details') },
              t.status === 'completed'
                ? {
                    label: 'Reopen tournament',
                    icon: <RotateCcw size={16} />,
                    onClick: () => updateTournament(t.id, { status: score.played ? 'live' : 'upcoming' }),
                  }
                : { label: 'Finish tournament', icon: <CircleStop size={16} />, onClick: () => setDialog('finish') },
              { label: 'Delete tournament', icon: <Trash2 size={16} />, danger: true, onClick: () => setDialog('delete') },
            ]}
          />
        )}
      </div>

      <TeamScoreBar t={t} className="mb-3" />

      {live && (
        <Link to={`/tournaments/${t.id}/matches/${live.id}`} className="mb-3 block">
          <Card className="flex items-center gap-3 border-accent/40 px-4 py-3 transition hover:shadow-md">
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold tracking-wide text-accent uppercase">
              <LiveDot /> {matchCode(live.order)}
            </span>
            <span className="min-w-0 flex-1 space-y-0.5 text-sm">
              <SideNames t={t} team="a" ids={live.a} />
              <SideNames t={t} team="b" ids={live.b} />
            </span>
            <span className="tabular text-xl font-black">
              {live.scoreA}–{live.scoreB}
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted" />
          </Card>
        </Link>
      )}

      <div className="mb-4 flex gap-2">
        <Button className="flex-1" onClick={() => exportPdf('share')} disabled={busy !== null}>
          <Share2 size={16} /> {busy === 'share' ? 'Preparing…' : score.played ? 'Share results PDF' : 'Share schedule PDF'}
        </Button>
        <Button variant="secondary" onClick={() => exportPdf('download')} disabled={busy !== null} aria-label="Download PDF">
          <Download size={16} /> {busy === 'download' ? 'Preparing…' : 'Download'}
        </Button>
      </div>

      <Segmented value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={tabs} className="mb-4" />

      {tab === 'schedule' && <ScheduleTab t={t} isAdmin={isAdmin} />}
      {tab === 'teams' && <TeamsTab key={t.id} t={t} isAdmin={isAdmin} />}
      {tab === 'results' && <ResultsTab t={t} />}

      <Dialog open={dialog === 'details'} onClose={() => setDialog(null)} title="Tournament details">
        {dialog === 'details' && <DetailsForm t={t} onDone={() => setDialog(null)} />}
      </Dialog>
      <Dialog
        open={dialog === 'finish'}
        onClose={() => setDialog(null)}
        title="Finish the tournament?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Not yet
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                updateTournament(t.id, { status: 'completed' });
                setDialog(null);
              }}
            >
              Finish
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="font-semibold">{resultLine({ ...t, status: 'completed' })}.</p>
          {live && <Notice tone="warn">{matchCode(live.order)} is still on court. Finishing now leaves it out of the result.</Notice>}
          {score.remaining > (live ? 1 : 0) && <p className="text-muted">Matches not played are left out. You can reopen the tournament later.</p>}
        </div>
      </Dialog>
      <Dialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete this tournament?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteTournament(t.id);
                navigate('/tournaments');
              }}
            >
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm">The teams, the schedule and every score in “{t.name}” are removed for everyone. This can't be undone.</p>
      </Dialog>
    </div>
  );
}
