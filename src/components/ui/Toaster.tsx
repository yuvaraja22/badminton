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
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'animate-rise pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl',
            t.kind === 'error' ? 'bg-bad text-bad-bg' : t.kind === 'success' ? 'bg-good text-good-bg' : 'bg-toast text-toast-ink',
          )}
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="shrink-0 rounded-full bg-white/15 px-3.5 py-1 font-bold hover:bg-white/25"
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
