import { cn } from '../../lib/cn';
import { hash32 } from '../../lib/rng';

const COLORS = ['#3f5ba9', '#c0773a', '#3e8a75', '#7a5ea8', '#b23a3a', '#2f7a9a', '#8a6d2f', '#5a7a2f'];

export function Avatar({ name, photo, size = 36, className }: { name: string; photo?: string | null; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (photo) {
    return <img src={photo} alt="" style={style} className={cn('shrink-0 rounded-full object-cover', className)} />;
  }
  return (
    <span
      aria-hidden
      style={{ ...style, background: COLORS[hash32(name) % COLORS.length] }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white', className)}
    >
      {initials || '?'}
    </span>
  );
}
