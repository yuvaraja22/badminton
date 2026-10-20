import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/Button';

/**
 * Offers a reload when a new version is deployed, so every phone runs the same scheduler
 * (all devices must compute the same "Up next").
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-0 top-[calc(3.75rem+env(safe-area-inset-top))] z-50 flex justify-center px-4">
      <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-xl bg-header px-4 py-3 text-sm text-white shadow-lg">
        <span>A new version is available.</span>
        <span className="flex gap-2">
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
          <Button size="sm" variant="accent" onClick={() => updateServiceWorker(true)}>
            Update
          </Button>
        </span>
      </div>
    </div>
  );
}
