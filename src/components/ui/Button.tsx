import { cn } from '../../lib/cn';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'accent' | 'volt' | 'secondary' | 'ghost' | 'danger' | 'good';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_8px_18px_-10px_var(--primary)] hover:brightness-110 active:brightness-95',
  accent: 'bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_8px_18px_-10px_var(--accent)] hover:brightness-110 active:brightness-95',
  volt: 'bg-volt text-volt-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_8px_18px_-10px_var(--volt)] hover:brightness-105 active:brightness-95',
  secondary: 'border border-line bg-surface text-ink hover:border-muted/40 hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'border border-bad/40 bg-bad-bg text-bad hover:brightness-95',
  good: 'bg-good text-good-bg hover:brightness-110',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 gap-1.5 px-3.5 text-sm',
  md: 'h-11 gap-2 px-5 text-[15px]',
  lg: 'h-13 gap-2 px-6 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export function Button({ variant = 'primary', size = 'md', block, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-full font-semibold tracking-tight transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    />
  );
}
