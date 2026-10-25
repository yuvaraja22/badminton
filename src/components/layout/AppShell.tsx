import clsx from 'clsx';
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router';
import { CalendarDays, Home, LogIn, LogOut, Monitor, Moon, RefreshCw, ShieldCheck, Sun, Trophy, UserRound, Users } from 'lucide-react';
import { useAuth, useData } from '../../lib/data/context';
import { useLinkClaims } from '../../lib/data/useClaims';
import { usingEmulators } from '../../lib/firebase';
import { useThemePref } from '../../lib/theme';
import { Logo } from '../Logo';
import { SyncPill } from '../SyncPill';
import { Button } from '../ui/Button';
import { Notice, Spinner } from '../ui/Card';
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
  const { user, isAdmin, playerId, claim, signIn, signOut, loading } = useAuth();
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
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-ink hover:bg-surface-2"
        >
          <LogIn size={16} className="hidden min-[400px]:block" /> Sign in
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
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-chip text-sm font-extrabold text-chip-ink">
          {initial}
        </span>
      }
      items={[
        {
          label: `${user.email}${isAdmin ? ' · admin' : playerId ? '' : ' · viewer'}`,
          icon: <ShieldCheck size={16} className={isAdmin ? 'text-good' : 'text-muted'} />,
          onClick: () => undefined,
        },
        ...(playerId
          ? [{ label: `My stats (${nameOf(playerId)})`, icon: <UserRound size={16} />, onClick: () => navigate('/me') }]
          : [{ label: claim ? 'Link request sent' : 'Link my player profile', icon: <UserRound size={16} />, onClick: () => navigate('/me') }]),
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
        { label: 'Match device', icon: <Monitor size={16} />, checked: pref === 'system', onClick: () => setPref('system') },
        { label: 'Light', icon: <Sun size={16} />, checked: pref === 'light', onClick: () => setPref('light') },
        { label: 'Dark', icon: <Moon size={16} />, checked: pref === 'dark', onClick: () => setPref('dark') },
      ]}
    />
  );
}

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/sessions', label: 'Play', icon: CalendarDays },
  { to: '/leaderboard', label: 'Leaders', icon: Trophy },
  { to: '/players', label: 'Players', icon: Users },
];

/** Live updates stopped (a listener failed): say so, and offer to reconnect. */
function ConnectionBanner() {
  const { connectionError, retry } = useData();
  if (!connectionError) return null;
  return (
    <Notice tone="warn" className="mb-4 flex items-center justify-between gap-3">
      <span>Live updates stopped: {connectionError}. You're seeing what was last loaded.</span>
      <Button variant="secondary" size="sm" onClick={retry} className="shrink-0">
        <RefreshCw size={14} /> Try again
      </Button>
    </Notice>
  );
}

export function AppShell() {
  const { isAdmin, playerId } = useAuth();
  // A dot on Admin while someone is waiting to be linked to their profile.
  const claims = useLinkClaims(isAdmin);
  // Tournaments are listed under Play along with sessions.
  const inTournaments = useLocation().pathname.startsWith('/tournaments');
  const items = [
    ...NAV,
    ...(playerId ? [{ to: '/me', label: 'Me', icon: UserRound }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck, dot: Boolean(claims?.length) }] : []),
  ];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-header/80 pt-[env(safe-area-inset-top)] text-header-ink backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-15 max-w-5xl items-center justify-between gap-2 px-4">
          <Link to="/" className="group flex min-w-0 items-center gap-2.5" aria-label="Badminton Stats, home">
            <Logo className="size-9 shrink-0 drop-shadow-[0_4px_10px_rgb(17_98_75/0.35)] transition group-hover:-rotate-6" />
            <span className="flex min-w-0 items-baseline gap-1.5 text-[1.2rem] leading-none font-extrabold tracking-[-0.04em]">
              <span className="truncate">Badminton</span>
              <span className="font-score -rotate-3 rounded-md bg-volt px-1.5 py-0.5 text-[0.95rem] font-black tracking-[0.06em] text-volt-ink uppercase">Stats</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {usingEmulators && <span className="mr-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">Emulator</span>}
            <SyncPill />
            <ThemeMenu />
            <AccountButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <ConnectionBanner />
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Floating dock: the active tab is a volt pill. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]" aria-label="Main">
        <div className="mx-auto flex max-w-md gap-0.5 rounded-full border border-white/5 bg-dock p-1.5 text-dock-ink shadow-[0_18px_40px_-12px_rgb(6_14_11/0.6)]">
          {items.map(({ to, label, icon: Icon, end, dot }: (typeof items)[number] & { end?: boolean; dot?: boolean }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10.5px] font-bold tracking-tight transition',
                  isActive || (inTournaments && to === '/sessions') ? 'bg-volt text-volt-ink shadow-[0_6px_16px_-6px_var(--volt)]' : 'hover:text-white',
                )
              }
            >
              <span className="relative">
                <Icon size={21} strokeWidth={2.1} />
                {dot && <span className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-accent ring-2 ring-dock" aria-label="Waiting for you" />}
              </span>
              <span className="max-w-full truncate">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <Toaster />
      <ScrollRestoration />
    </div>
  );
}
