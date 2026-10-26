import { useState, type ReactNode } from 'react';
import { Download, Laptop, MoreVertical, Share, Smartphone, SquarePlus } from 'lucide-react';
import { promptInstall, useInstall, useInstalledElsewhere, type InstallPlatform } from '../lib/install';
import { toast } from '../lib/toast';
import { Button } from './ui/Button';
import { Card, Notice } from './ui/Card';
import { Dialog } from './ui/Dialog';

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-score inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-volt text-sm font-black text-volt-ink">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return <span className="mx-0.5 inline-flex translate-y-0.5 items-center rounded border border-line bg-surface-2 px-1">{children}</span>;
}

function Steps({ platform }: { platform: InstallPlatform }) {
  if (platform === 'ios') {
    return (
      <ol className="space-y-3 text-sm">
        <Step n={1}>
          Tap the Share button
          <Icon>
            <Share size={14} />
          </Icon>
          in Safari's toolbar (in Chrome it's next to the address bar).
        </Step>
        <Step n={2}>
          Scroll down and tap <strong>Add to Home Screen</strong>
          <Icon>
            <SquarePlus size={14} />
          </Icon>
          .
        </Step>
        <Step n={3}>
          Tap <strong>Add</strong>. The app appears on your home screen.
        </Step>
      </ol>
    );
  }
  if (platform === 'android') {
    return (
      <ol className="space-y-3 text-sm">
        <Step n={1}>
          Open the browser menu
          <Icon>
            <MoreVertical size={14} />
          </Icon>
          (top right in Chrome).
        </Step>
        <Step n={2}>
          Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
        </Step>
        <Step n={3}>Confirm. The app appears with your other apps.</Step>
      </ol>
    );
  }
  if (platform === 'mac-safari') {
    return (
      <ol className="space-y-3 text-sm">
        <Step n={1}>
          In Safari's menu bar choose <strong>File → Add to Dock</strong>.
        </Step>
        <Step n={2}>
          Click <strong>Add</strong>. The app opens from the Dock in its own window.
        </Step>
      </ol>
    );
  }
  return (
    <ol className="space-y-3 text-sm">
      <Step n={1}>
        In <strong>Chrome</strong> or <strong>Edge</strong>, click the install icon at the right end of the address bar, or open the browser menu and choose{' '}
        <strong>Install Badminton Stats</strong> (Chrome: Cast, save and share → Install page as app).
      </Step>
      <Step n={2}>The app then opens in its own window and from your Start menu, Dock or Launchpad.</Step>
      <Step n={3}>Firefox can't install web apps: open this site in Chrome or Edge instead.</Step>
    </ol>
  );
}

/** Home-page card that installs the app (native prompt where the browser offers one, steps otherwise). */
export function InstallCard() {
  const { canPrompt, installed, platform } = useInstall();
  const elsewhere = useInstalledElsewhere();
  const [help, setHelp] = useState(false);
  if (installed || elsewhere) return null;

  const phone = platform === 'ios' || platform === 'android';
  const install = async () => {
    if (!canPrompt) return setHelp(true);
    const outcome = await promptInstall();
    if (outcome === 'accepted') toast('Installed. Open it from your home screen or apps.', 'success');
    else if (outcome === 'unavailable') setHelp(true);
  };

  return (
    <Card className="flex items-center gap-3 p-3.5">
      <span className="inline-flex size-12 shrink-0 -rotate-6 items-center justify-center rounded-2xl bg-volt text-volt-ink shadow-[0_8px_18px_-10px_var(--volt)]">
        {phone ? <Smartphone size={22} /> : <Laptop size={22} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-bold tracking-tight">Install the app</div>
        <div className="text-sm text-muted">{phone ? 'One tap from your home screen, works without signal.' : 'Open it in its own window, like any app.'}</div>
      </div>
      <Button size="sm" onClick={install}>
        <Download size={15} /> Install
      </Button>
      <Dialog open={help} onClose={() => setHelp(false)} title={phone ? 'Add to your home screen' : 'Install on this computer'}>
        <div className="space-y-4">
          {/* The browser can become ready while these steps are open; then install in one tap. */}
          {canPrompt && (
            <Button
              block
              onClick={() => {
                setHelp(false);
                void install();
              }}
            >
              <Download size={16} /> Install now
            </Button>
          )}
          <Steps platform={platform} />
          {phone && (
            <Notice>
              Opened this from WhatsApp? First open it in {platform === 'ios' ? 'Safari (tap the compass or ⋯ button)' : 'Chrome (⋮ → Open in Chrome)'}, then follow these
              steps. Already installed? Open it from your home screen.
            </Notice>
          )}
        </div>
      </Dialog>
    </Card>
  );
}

const TIP_SEEN = 'open-in-app-tip';

/**
 * A link opened in Chrome although the app is installed (Android): how to carry on in the app, and the
 * phone setting that opens links there every time. Shown until dismissed.
 */
export function OpenInAppTip() {
  const elsewhere = useInstalledElsewhere();
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(TIP_SEEN) === '1';
    } catch {
      return false;
    }
  });
  if (!elsewhere || seen) return null;
  const dismiss = () => {
    setSeen(true);
    try {
      localStorage.setItem(TIP_SEEN, '1');
    } catch {
      // Private browsing: it shows again next time.
    }
  };
  return (
    <Notice className="mb-4">
      <p className="font-semibold">You have the app: open this in it</p>
      <p className="mt-1">
        Tap
        <Icon>
          <MoreVertical size={14} />
        </Icon>
        at the top right, then <strong>Open in Badminton</strong>.
      </p>
      <p className="mt-1 text-muted">
        So links open in the app every time: long-press the app's icon → App info → Open by default (Samsung: Set as default) → turn on <strong>Open supported links</strong>.
      </p>
      <div className="mt-1 flex justify-end">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </Notice>
  );
}
