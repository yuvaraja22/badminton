import { cn } from '../../lib/cn';
import { clampLevel, levelParts, MAX_LEVEL, MIN_LEVEL } from '../../lib/levels';
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

/** − Intermediate High + stepper for skill levels (Amateur Low … Professional High). */
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
  const set = (v: number) => onChange(clampLevel(v));
  const { tier, part } = levelParts(value);
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-surface">
      <button
        type="button"
        aria-label={`Lower ${label}`}
        disabled={disabled || value <= MIN_LEVEL}
        onClick={() => set(value - 0.5)}
        className="inline-flex size-9 items-center justify-center text-muted disabled:opacity-30"
      >
        <Minus size={16} />
      </button>
      <span className="flex w-24 flex-col items-center leading-tight" aria-label={`${label}: ${tier} ${part}`}>
        <span className="text-[13px] font-semibold">{tier}</span>
        <span className="text-[11px] text-muted">{part}</span>
      </span>
      <button
        type="button"
        aria-label={`Raise ${label}`}
        disabled={disabled || value >= MAX_LEVEL}
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
