import { cn } from '../../lib/cn';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';

export interface MenuItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  danger?: boolean;
  /** Shows a check mark (for choices like the theme). */
  checked?: boolean;
}

export function Menu({ trigger, items, label = 'More actions' }: { trigger: ReactNode; items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
      >
        {trigger}
      </button>
      {open && (
        <div role="menu" className="animate-rise absolute right-0 z-30 mt-1.5 w-60 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-2xl">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-surface-2',
                it.danger && 'text-bad',
              )}
            >
              {it.icon}
              {it.label}
              {it.checked && <Check size={16} strokeWidth={2.5} className="ml-auto text-primary-text" aria-label="selected" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
