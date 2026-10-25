import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArchiveRestore, Database, Download, Inbox, LogOut, RefreshCw, Settings, ShieldCheck, Trash2, Upload, UserCheck, UserPlus } from 'lucide-react';
import { useAuth, useData } from '../lib/data/context';
import {
  addAdmin,
  approveClaim,
  declineClaim,
  deleteForever,
  exportBackup,
  findMissing,
  listAdmins,
  listPlayerLinks,
  listTrash,
  parseBackup,
  rebuildHistory,
  removeAdmin,
  restoreFromTrash,
  restoreMissing,
  saveConfig,
  setPlayerLink,
  TRASH_DAYS,
  type Missing,
  type ParsedBackup,
} from '../lib/data/mutations';
import { useLinkClaims } from '../lib/data/useClaims';
import { defaultSessionTitle, formatStamp, listJoin, shortDate } from '../lib/format';
import { toast } from '../lib/toast';
import type { LinkClaim, PlayerId, TrashEntry } from '../lib/types';
import { AdminOnly } from '../components/AdminOnly';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, Notice, PageTitle, Spinner } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
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

/** People who signed in and tapped "This is me" on a profile, waiting to be linked. */
function RequestsCard() {
  const claims = useLinkClaims(true);
  const { nameOf, pathOf, playersById } = useData();
  const [links, setLinks] = useState<Record<PlayerId, string> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const count = claims?.length ?? 0;

  useEffect(() => {
    if (!count) return;
    let alive = true;
    listPlayerLinks()
      .then((map) => alive && setLinks(map))
      .catch(() => alive && setLinks({}));
    return () => {
      alive = false;
    };
  }, [count]);

  if (!claims?.length) return null;
  const approve = async (c: LinkClaim) => {
    setBusy(c.email);
    try {
      await approveClaim(c, links?.[c.playerId] ?? null);
      toast(`${c.email} is now linked to ${nameOf(c.playerId)}`, 'success');
    } catch (e) {
      toast(`Couldn't link: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-accent/40">
      <CardHeader
        title={`Link requests (${claims.length})`}
        subtitle="They signed in with Google and tapped “This is me” on a profile. Approving lets them edit that profile, RSVP and see their Me tab."
        action={<Inbox size={18} className="text-muted" />}
      />
      <ul className="divide-y divide-line px-4 pt-2 pb-2 text-sm">
        {claims.map((c) => {
          const existing = links?.[c.playerId];
          const known = playersById.has(c.playerId);
          return (
            <li key={c.email} className="space-y-2 py-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{c.name || c.email}</div>
                <div className="truncate text-xs text-muted">
                  {c.email} · {formatStamp(c.at)}
                </div>
                <div className="mt-1">
                  says they're{' '}
                  {known ? (
                    <Link to={pathOf(c.playerId)} className="font-semibold underline">
                      {nameOf(c.playerId)}
                    </Link>
                  ) : (
                    <span className="text-muted">a player who no longer exists</span>
                  )}
                </div>
              </div>
              {existing && existing !== c.email && (
                <Notice tone="warn">
                  {nameOf(c.playerId)} is already linked to {existing}. Approving replaces that link.
                </Notice>
              )}
              <div className="flex gap-2">
                <Button size="sm" disabled={busy !== null || !known} onClick={() => approve(c)}>
                  <UserCheck size={15} /> Approve
                </Button>
                <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => declineClaim(c.email)}>
                  Decline
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Which Google account is linked to which player (set from each player's Edit dialog). */
function PlayerAccountsCard() {
  const { nameOf, pathOf } = useData();
  const [links, setLinks] = useState<Record<string, string> | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  // An approved (or declined) link request changes the list: load it again.
  const pending = useLinkClaims(true)?.length ?? 0;

  useEffect(() => {
    let alive = true;
    listPlayerLinks()
      .then((map) => alive && setLinks(map))
      .catch((e) => toast(`Couldn't load player accounts: ${(e as Error).message}`, 'error'));
    return () => {
      alive = false;
    };
  }, [version, pending]);

  const rows = links ? Object.entries(links).sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0]))) : null;

  return (
    <Card>
      <CardHeader
        title="Player accounts"
        subtitle="Linked players can sign in with Google to edit their profile, RSVP and see their Me tab. Players can ask with “This is me” on their profile, or you can link them: profile → Edit → Linked Google account."
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

/** Deleted sessions and tournaments, restorable for TRASH_DAYS days. */
function TrashCard() {
  // The list, and when it was loaded (for "days left").
  const [loaded, setLoaded] = useState<{ items: TrashEntry[]; at: number } | null>(null);
  const [version, setVersion] = useState(0);
  const [forever, setForever] = useState<TrashEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const items = loaded?.items ?? null;

  useEffect(() => {
    let alive = true;
    listTrash()
      .then((list) => alive && setLoaded({ items: list, at: Date.now() }))
      .catch(() => alive && setLoaded({ items: [], at: Date.now() }));
    return () => {
      alive = false;
    };
  }, [version]);

  const daysLeft = (e: TrashEntry) => Math.max(0, Math.ceil(TRASH_DAYS - ((loaded?.at ?? e.deletedAt) - e.deletedAt) / 86_400_000));
  const restore = async (e: TrashEntry) => {
    setBusy(true);
    try {
      await restoreFromTrash(e);
      toast(`Restored “${e.title}”`, 'success');
      setVersion((v) => v + 1);
    } catch (err) {
      toast(`Couldn't restore: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Recently deleted"
        subtitle={`Deleted sessions and tournaments stay here for ${TRASH_DAYS} days. Restoring puts them back exactly as they were, stats included.`}
        action={<ArchiveRestore size={18} className="text-muted" />}
      />
      <div className="p-4">
        {items === null ? (
          <Spinner label="Loading…" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">Nothing deleted recently.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line text-sm">
            {items.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{e.title || 'Untitled'}</span>
                    {e.kind === 'tournament' && <Badge tone="info">Tournament</Badge>}
                  </span>
                  <span className="block text-xs text-muted">
                    {e.date && `${shortDate(e.date)} · `}deleted by {e.deletedBy}, {formatStamp(e.deletedAt)} · {daysLeft(e)} days left
                  </span>
                </span>
                <span className="flex gap-1.5">
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => restore(e)}>
                    <ArchiveRestore size={15} /> Restore
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setForever(e)} aria-label={`Delete ${e.title} for good`}>
                    <Trash2 size={15} />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog
        open={forever !== null}
        onClose={() => setForever(null)}
        title="Delete for good?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setForever(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const e = forever;
                setForever(null);
                if (!e) return;
                await deleteForever(e.id).catch((err) => toast((err as Error).message, 'error'));
                setVersion((v) => v + 1);
              }}
            >
              Delete for good
            </Button>
          </div>
        }
      >
        <p className="text-sm">“{forever?.title}” can't be restored after this, except from a backup file.</p>
      </Dialog>
    </Card>
  );
}

const WHAT: Record<keyof Missing, [string, string]> = {
  players: ['player', 'players'],
  sessions: ['session', 'sessions'],
  tournaments: ['tournament', 'tournaments'],
  events: ['planned session', 'planned sessions'],
};

function DataCard() {
  const { sessionHistory: history } = useData();
  const [busy, setBusy] = useState<'rebuild' | 'backup' | 'restore' | null>(null);
  const [restoring, setRestoring] = useState<{ backup: ParsedBackup; missing: Missing } | null>(null);
  const bytes = new Blob([JSON.stringify(history)]).size;
  const usedPct = Math.round((bytes / (1024 * 1024)) * 100);

  const backup = async () => {
    setBusy('backup');
    try {
      const data = await exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `badminton-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      toast('Backup downloaded', 'success');
    } catch (e) {
      toast(`Backup failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const pickFile = async (file: File) => {
    setBusy('restore');
    try {
      const parsed = parseBackup(await file.text());
      setRestoring({ backup: parsed, missing: await findMissing(parsed) });
    } catch (e) {
      toast(`Couldn't read that file: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const missingLines = restoring
    ? (Object.keys(WHAT) as (keyof Missing)[]).filter((k) => restoring.missing[k].length).map((k) => `${restoring.missing[k].length} ${WHAT[k][restoring.missing[k].length === 1 ? 0 : 1]}`)
    : [];

  return (
    <Card>
      <CardHeader title="Data" action={<Database size={18} className="text-muted" />} />
      <div className="space-y-3 p-4 text-sm">
        <p className="text-muted">
          All-time stats come from one compact summary document ({Math.max(1, Math.round(bytes / 1024))} KB, {usedPct}% of Firestore's 1 MB limit), so a visit costs only a few reads
          on the free plan.
        </p>
        <p className="text-muted">
          A backup holds everything: players, every session and tournament, plans and settings. Restoring one only brings back what's missing from the app now; it never changes
          anything that's still there.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy !== null} onClick={backup}>
            <Download size={15} /> {busy === 'backup' ? 'Preparing…' : 'Download backup'}
          </Button>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-5 text-[15px] font-semibold hover:bg-surface-2">
            <Upload size={15} /> {busy === 'restore' ? 'Reading…' : 'Restore from backup'}
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              disabled={busy !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void pickFile(file);
              }}
            />
          </label>
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={async () => {
              setBusy('rebuild');
              try {
                const n = await rebuildHistory();
                toast(`Rebuilt stats from ${n} sessions`, 'success');
              } catch (e) {
                toast(`Rebuild failed: ${(e as Error).message}`, 'error');
              } finally {
                setBusy(null);
              }
            }}
          >
            <RefreshCw size={15} /> {busy === 'rebuild' ? 'Rebuilding…' : 'Rebuild stats'}
          </Button>
        </div>
      </div>
      <Dialog
        open={restoring !== null}
        onClose={() => setRestoring(null)}
        title="Restore from backup"
        footer={
          missingLines.length > 0 && (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRestoring(null)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const r = restoring;
                  setRestoring(null);
                  if (!r) return;
                  try {
                    const n = await restoreMissing(r.backup, r.missing);
                    toast(`Restored ${n} item${n === 1 ? '' : 's'}`, 'success');
                  } catch (e) {
                    toast(`Restore failed: ${(e as Error).message}`, 'error');
                  }
                }}
              >
                <ArchiveRestore size={16} /> Restore
              </Button>
            </div>
          )
        }
      >
        <div className="space-y-2 text-sm">
          <p>
            Backup from <strong>{restoring?.backup.exportedAt ? formatStamp(Date.parse(restoring.backup.exportedAt)) : 'an unknown date'}</strong>.
          </p>
          {missingLines.length ? (
            <p>
              Not in the app now: <strong>{listJoin(missingLines)}</strong>. Restoring adds them back; nothing else changes.
            </p>
          ) : (
            <Notice tone="good">Everything in this backup is already in the app. Nothing to restore.</Notice>
          )}
        </div>
      </Dialog>
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
      <RequestsCard />
      <SettingsCard />
      <PlayerAccountsCard />
      <AdminsCard />
      <TrashCard />
      <DataCard />
    </div>
  );
}
