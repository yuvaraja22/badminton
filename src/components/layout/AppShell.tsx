import clsx from 'clsx';
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useNavigate } from 'react-router';
import { CalendarDays, Home, LogIn, LogOut, Monitor, Moon, ShieldCheck, Sun, Trophy, UserRound, Users } from 'lucide-react';
import { useAuth, useData } from '../../lib/data/context';
import { usingEmulators } from '../../lib/firebase';
import { useThemePref } from '../../lib/theme';
import { Logo } from '../Logo';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Field';
import { Menu } from '../ui/Menu';
import { Toaster } from '../ui/Toaster';

function EmulatorSignIn({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  return (
    <Dialog open={open} onClose={onClose} title="Sign in (local emulator)">
      <div className="space-y-3">
        <p className="text-sm text-muted">Local testing only: sign in as any email. Admins are the emails listed in the emulator's admins collection.</p>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Test email" />
        <Button
          block
          onClick={async () => {
            await signIn(email.trim().toLowerCase());
            onClose();
          }}
        >
          Sign in
        </Button>
      </div>
    </Dialog>
  );
}

function AccountButton() {
  const { user, isAdmin, playerId, signIn, signOut, loading } = useAuth();
  const { nameOf } = useData();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [emulatorOpen, setEmulatorOpen] = useState(false);
  if (loading && !user) return null;
  if (!user) {
    return (
      <>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (usingEmulators) return setEmulatorOpen(true);
            setBusy(true);
            await signIn();
            setBusy(false);
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap text-muted hover:bg-surface-2 hover:text-ink"
        >
          <LogIn size={16} /> Sign in
        </button>
        {usingEmulators && <EmulatorSignIn open={emulatorOpen} onClose={() => setEmulatorOpen(false)} />}
      </>
    );
  }
  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();
  return (
    <Menu
      label="Account"
      trigger={
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-ink ring-1 ring-line">
          {initial}
        </span>
      }
      items={[
        {
          label: `${user.email}${isAdmin ? ' · admin' : playerId ? '' : ' · viewer'}`,
          icon: <ShieldCheck size={16} className={isAdmin ? 'text-good' : 'text-muted'} />,
          onClick: () => undefined,
        },
        ...(playerId ? [{ label: `My stats (${nameOf(playerId)})`, icon: <UserRound size={16} />, onClick: () => navigate('/me') }] : []),
        { label: 'Sign out', icon: <LogOut size={16} />, onClick: () => void signOut() },
      ]}
    />
  );
}

/** Light / Dark / follow the phone. Remembered on this device. */
function ThemeMenu() {
  const [pref, setPref] = useThemePref();
  const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : Monitor;
  return (
    <Menu
      label="Theme"
      trigger={<Icon size={19} />}
      items={[
        { label: 'Match phone', icon: <Monitor size={16} />, checked: pref === 'system', onClick: () => setPref('system') },
        { label: 'Light', icon: <Sun size={16} />, checked: pref === 'light', onClick: () => setPref('light') },
        { label: 'Dark', icon: <Moon size={16} />, checked: pref === 'dark', onClick: () => setPref('dark') },
      ]}
    />
  );
}

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/sessions', label: 'Sessions', icon: CalendarDays },
  { to: '/leaderboard', label: 'Leaders', icon: Trophy },
  { to: '/players', label: 'Players', icon: Users },
];

export function AppShell() {
  const { isAdmin, playerId } = useAuth();
  const items = [
    ...NAV,
    ...(playerId ? [{ to: '/me', label: 'Me', icon: UserRound }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
  ];
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-header pt-[env(safe-area-inset-top)] text-header-ink">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 font-bold tracking-tight">
            <Logo className="size-8 shrink-0" />
            <span className="truncate">Badminton Stats</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {usingEmulators && <span className="mr-1 rounded bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">Emulator</span>}
            <ThemeMenu />
            <AccountButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
        <div className="mx-auto flex max-w-5xl">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition', isActive ? 'text-primary-text' : 'text-muted hover:text-ink')
              }
            >
              <Icon size={22} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Toaster />
      <ScrollRestoration />
    </div>
  );
}
