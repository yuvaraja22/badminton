import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Database, Download, LogOut, RefreshCw, Settings, ShieldCheck, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import { addAdmin, listAdmins, listPlayerLinks, rebuildHistory, removeAdmin, saveConfig, setPlayerLink } from '../lib/data/mutations';
import { defaultSessionTitle } from '../lib/format';
import { toast } from '../lib/toast';
import { AdminOnly } from '../components/AdminOnly';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, PageTitle, Spinner } from '../components/ui/Card';
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

/** Which Google account is linked to which player (set from each player's Edit dialog). */
function PlayerAccountsCard() {
  const { nameOf, pathOf } = useData();
  const [links, setLinks] = useState<Record<string, string> | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    let alive = true;
    listPlayerLinks()
      .then((map) => alive && setLinks(map))
      .catch((e) => toast(`Couldn't load player accounts: ${(e as Error).message}`, 'error'));
    return () => {
      alive = false;
    };
  }, [version]);

  const rows = links ? Object.entries(links).sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0]))) : null;

  return (
    <Card>
      <CardHeader
        title="Player accounts"
        subtitle="Linked players can sign in with Google to edit their profile, RSVP and see their Me tab. To link someone, open their profile → Edit → Linked Google account."
        action={<UserCheck size={18} className="text-muted" />}
      />
      <div className="p-4">
        {rows === null ? (
          <Spinner label="Loading…" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No players are linked yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line text-sm">
            {rows.map(([playerId, email]) => (
              <li key={email} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0">
                  <Link to={pathOf(playerId)} className="block truncate font-semibold hover:underline">
                    {nameOf(playerId)}
                  </Link>
                  <span className="block truncate text-xs text-muted">{email}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Unlink ${email}`}
                  onClick={async () => {
                    await setPlayerLink(playerId, null, email).catch((e) => toast((e as Error).message, 'error'));
                    refresh();
                  }}
                >
                  Unlink
                </Button>
              </li>
            ))}
          </ul>
        )}
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
          <ul className="divide-y divide-line rounded-2xl border border-line">
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

function DataCard() {
  const { sessionHistory: history, players, tournaments } = useData();
  const [busy, setBusy] = useState(false);
  const bytes = new Blob([JSON.stringify(history)]).size;
  const usedPct = Math.round((bytes / (1024 * 1024)) * 100);

  const backup = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), players, history, tournaments: tournaments ?? [] }, null, 2)], { type: 'application/json' });
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
      <SettingsCard />
      <PlayerAccountsCard />
      <AdminsCard />
      <DataCard />
    </div>
  );
}
