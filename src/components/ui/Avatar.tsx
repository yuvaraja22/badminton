import { cn } from '../../lib/cn';
import { hash32 } from '../../lib/rng';

// Kit colours for initials (white text stays readable on each).
const COLORS = ['#3a4a9f', '#c2410c', '#1e5a8a', '#7a3e9d', '#99560f', '#3f5560', '#b4233c', '#4f5d1c'];

export function Avatar({ name, photo, size = 36, className }: { name: string; photo?: string | null; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (photo) {
    return <img src={photo} alt="" style={style} className={cn('shrink-0 rounded-full object-cover ring-2 ring-surface', className)} />;
  }
  return (
    <span
      aria-hidden
      style={{ ...style, background: `radial-gradient(circle at 30% 25%, rgb(255 255 255 / 0.22), transparent 55%), ${COLORS[hash32(name) % COLORS.length]}` }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-extrabold tracking-tight text-white ring-2 ring-surface', className)}
    >
      {initials || '?'}
    </span>
  );
}
