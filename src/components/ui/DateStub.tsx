import { cn } from '../../lib/cn';
import { dateParts, shortDate } from '../../lib/format';

/** A tear-off calendar stub: weekday, big day number, month (read out as the short date). */
export function DateStub({ date, tone = 'paper', className }: { date: string; tone?: 'paper' | 'chip'; className?: string }) {
  const { weekday, day, month } = dateParts(date);
  return (
    <span
      className={cn(
        'inline-flex w-13 shrink-0 flex-col items-center rounded-2xl pt-1.5 pb-1 leading-none',
        tone === 'chip' ? 'bg-chip text-chip-ink' : 'border border-line bg-surface-2 text-ink',
        className,
      )}
    >
      <span className="sr-only">{shortDate(date)}</span>
      <span aria-hidden className="text-[9.5px] font-bold tracking-[0.16em] uppercase opacity-70">
        {weekday}
      </span>
      <span aria-hidden className="font-score text-[1.75rem] leading-[1.05] font-black">
        {day}
      </span>
      <span aria-hidden className="text-[9.5px] font-bold tracking-[0.16em] uppercase opacity-70">
        {month}
      </span>
    </span>
  );
}
