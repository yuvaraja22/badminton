import { cn } from '../../lib/cn';
import { useEffect, useState } from 'react';
import { subscribeToasts, type ToastMessage } from '../../lib/toast';

export function Toaster() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(
    () =>
      subscribeToasts((t) => {
        setItems((prev) => [...prev.slice(-2), t]);
        window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.action ? 10000 : 4500);
      }),
    [],
  );

  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg',
            t.kind === 'error' ? 'bg-bad text-white' : t.kind === 'success' ? 'bg-good text-white' : 'bg-header text-white',
          )}
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="shrink-0 rounded-lg bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
              onClick={() => {
                t.action!.onClick();
                setItems((prev) => prev.filter((x) => x.id !== t.id));
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
