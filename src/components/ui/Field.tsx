import { cn } from '../../lib/cn';
import { Minus, Plus } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const control =
  'w-full rounded-xl border border-line bg-surface px-3 text-[15px] text-ink outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50';

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, 'h-11', className)} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, 'h-11 pr-8', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-28 py-2.5 leading-relaxed', className)} {...rest} />;
}

/** − 3.5 + stepper for skill levels (1–5 in half steps). */
export function LevelStepper({
  value,
  onChange,
  disabled,
  label = 'level',
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  /** e.g. "Vikram's level", for screen readers. */
  label?: string;
}) {
  const set = (v: number) => onChange(Math.min(5, Math.max(1, Math.round(v * 2) / 2)));
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-surface">
      <button
        type="button"
        aria-label={`Lower ${label}`}
        disabled={disabled || value <= 1}
        onClick={() => set(value - 0.5)}
        className="inline-flex size-9 items-center justify-center text-muted disabled:opacity-30"
      >
        <Minus size={16} />
      </button>
      <span className="tabular w-9 text-center text-sm font-semibold" aria-label={`${label} ${value}`}>
        {value.toFixed(1)}
      </span>
      <button
        type="button"
        aria-label={`Raise ${label}`}
        disabled={disabled || value >= 5}
        onClick={() => set(value + 0.5)}
        className="inline-flex size-9 items-center justify-center text-muted disabled:opacity-30"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-6 w-10 rounded-full bg-line transition peer-checked:bg-primary after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
      {label}
    </label>
  );
}
