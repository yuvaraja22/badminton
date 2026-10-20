import { useEffect, useState } from 'react';
import { Database, Download, FileUp, LogOut, RefreshCw, Settings, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { addAdmin, importPastSessions, listAdmins, rebuildHistory, removeAdmin, saveConfig } from '../lib/data/mutations';
import { PAST_SESSIONS } from '../lib/engine/fixtures/pastSessions';
import { defaultSessionTitle } from '../lib/format';
import { toast } from '../lib/toast';
import { AdminOnly } from '../components/AdminOnly';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, Notice, PageTitle, Spinner } from '../components/ui/Card';
import { Field, Input, Select } from '../components/ui/Field';

function SettingsCard() {
  const { config } = useData();
  const [groupName, setGroupName] = useState(config.groupName);
  const [points, setPoints] = useState(config.pointsToWin);
  return (
    <Card>
      <CardHeader title="Settings" action={<Settings size={18} className="text-muted" />} />
      <div className="space-y-4 p-4">
        <Field label="Group name" hint={`Session titles become “${defaultSessionTitle('2026-10-11', groupName || '…')}”.`}>
          <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
        </Field>
        <Field label="Default game length">
          <Select value={points} onChange={(e) => setPoints(Number(e.target.value))}>
            {[11, 15, 21].map((p) => (
              <option key={p} value={p}>
                {p} points
              </option>
            ))}
          </Select>
        </Field>
        <Button
          disabled={!groupName.trim()}
          onClick={() => {
            saveConfig({ groupName: groupName.trim(), pointsToWin: points });
            toast('Settings saved', 'success');
          }}
        >
          Save settings
        </Button>
      </div>
    </Card>
  );
}

function AdminsCard() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<string[] | null>(null);
  const [email, setEmail] = useState('');
  const me = user?.email?.toLowerCase();

  const refresh = () =>
    listAdmins()
      .then(setAdmins)
      .catch((e) => toast(`Couldn't load admins: ${(e as Error).message}`, 'error'));

  useEffect(() => {
    refresh();
  }, []);

  const add = async () => {
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return toast('Enter a valid email address', 'error');
    try {
      await addAdmin(value);
      setEmail('');
      toast(`${value} can now manage sessions after signing in with Google`, 'success');
      refresh();
    } catch (e) {
      toast(`Couldn't add admin: ${(e as Error).message}`, 'error');
    }
  };

  return (
    <Card>
      <CardHeader title="Admins" subtitle="Admins can create sessions, record scores and edit players." action={<ShieldCheck size={18} className="text-muted" />} />
      <div className="space-y-3 p-4">
        {admins === null ? (
          <Spinner label="Loading admins…" />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {admins.map((a) => (
              <li key={a} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate">
                  {a} {a === me && <span className="text-muted">(you)</span>}
                </span>
                {a !== me && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${a}`}
                    onClick={async () => {
                      await removeAdmin(a).catch((e) => toast((e as Error).message, 'error'));
                      refresh();
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@gmail.com" aria-label="New admin email" />
          <Button variant="secondary" onClick={add}>
            <UserPlus size={16} /> Add
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ImportCard() {
  const { players, config } = useData();
  const [dates, setDates] = useState<Record<string, string>>(() => Object.fromEntries(PAST_SESSIONS.map((f) => [f.key, f.knownDate ?? ''])));
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PAST_SESSIONS.map((f) => [f.key, !config.importedKeys.includes(f.key)])),
  );
  const [busy, setBusy] = useState(false);
  const chosen = PAST_SESSIONS.filter((f) => picked[f.key] && !config.importedKeys.includes(f.key));
  const missingDate = chosen.some((f) => !dates[f.key]);

  const run = async () => {
    setBusy(true);
    try {
      await importPastSessions(
        chosen.map((f) => ({ fixture: f, date: dates[f.key], title: defaultSessionTitle(dates[f.key], config.groupName) })),
        players,
        config.importedKeys,
      );
      toast(`Imported ${chosen.length} session${chosen.length === 1 ? '' : 's'}`, 'success');
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Import past reports" subtitle="The four PDF reports, match by match. Missing players are created at level 3 (adjust them afterwards)." action={<FileUp size={18} className="text-muted" />} />
      <div className="space-y-3 p-4">
        {PAST_SESSIONS.map((f) => {
          const done = config.importedKeys.includes(f.key);
          return (
            <div key={f.key} className="rounded-xl border border-line p-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4"
                  disabled={done}
                  checked={done || !!picked[f.key]}
                  onChange={(e) => setPicked((p) => ({ ...p, [f.key]: e.target.checked }))}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{f.file}</span>
                  <span className="block text-xs text-muted">
                    {f.matches.length} matches · {f.players.join(', ')}
                  </span>
                </span>
                {done && <span className="text-xs font-semibold text-good">Imported</span>}
              </label>
              {!done && picked[f.key] && (
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                  <Input type="date" value={dates[f.key]} onChange={(e) => setDates((d) => ({ ...d, [f.key]: e.target.value }))} className="w-44" aria-label={`Date for ${f.file}`} />
                  <span className="text-xs text-muted">
                    {dates[f.key] ? defaultSessionTitle(dates[f.key], config.groupName) : `Which ${f.weekdayHint} was this?`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {missingDate && <Notice tone="warn">Pick a date for each selected report.</Notice>}
        <Button disabled={!chosen.length || missingDate || busy} onClick={run}>
          {busy ? 'Importing…' : `Import ${chosen.length || ''} selected`}
        </Button>
      </div>
    </Card>
  );
}

function DataCard() {
  const { history, players } = useData();
  const [busy, setBusy] = useState(false);
  const bytes = new Blob([JSON.stringify(history)]).size;
  const usedPct = Math.round((bytes / (1024 * 1024)) * 100);

  const backup = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), players, history }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `badminton-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <Card>
      <CardHeader title="Data" action={<Database size={18} className="text-muted" />} />
      <div className="space-y-3 p-4 text-sm">
        <p className="text-muted">
          All-time stats come from one compact summary document ({Math.max(1, Math.round(bytes / 1024))} KB, {usedPct}% of Firestore's 1 MB limit), so a
          visit costs only a few reads on the free plan.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const n = await rebuildHistory();
                toast(`Rebuilt stats from ${n} sessions`, 'success');
              } catch (e) {
                toast(`Rebuild failed: ${(e as Error).message}`, 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            <RefreshCw size={15} /> {busy ? 'Rebuilding…' : 'Rebuild stats'}
          </Button>
          <Button variant="secondary" onClick={backup}>
            <Download size={15} /> Download backup
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function AdminPage() {
  const { isAdmin, user, signOut, loading } = useAuth();
  const { ready } = useData();
  if (loading || !ready) return <Spinner />;
  if (!isAdmin) return <AdminOnly what="manage the app" />;
  return (
    <div className="space-y-4">
      <PageTitle
        title="Admin"
        subtitle={`Signed in as ${user?.email}`}
        action={
          <Button variant="secondary" size="sm" onClick={signOut}>
            <LogOut size={15} /> Sign out
          </Button>
        }
      />
      <ImportCard />
      <SettingsCard />
      <AdminsCard />
      <DataCard />
    </div>
  );
}
