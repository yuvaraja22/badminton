import type { ReactNode } from 'react';
import { Feather, Hand as HandIcon, MapPin, Quote } from 'lucide-react';
import type { Player } from '../../lib/types';

const HAND = { left: 'Left-handed', right: 'Right-handed' } as const;
const POSITION = { front: 'Front court', back: 'Back court', both: 'All-court' } as const;

/** A player's bio and playing style, as set on their profile. Renders nothing if empty. */
export function ProfileDetails({ player }: { player: Player }) {
  const chips = [
    player.hand && { icon: <HandIcon size={13} aria-hidden />, text: HAND[player.hand] },
    player.position && { icon: <MapPin size={13} aria-hidden />, text: POSITION[player.position] },
    player.racket && { icon: <Feather size={13} aria-hidden />, text: player.racket },
  ].filter(Boolean) as { icon: ReactNode; text: string }[];
  if (!player.bio && !chips.length) return null;
  return (
    <div className="space-y-2">
      {player.bio && (
        <p className="flex gap-2 text-sm leading-relaxed text-ink">
          <Quote size={14} className="mt-1 shrink-0 text-muted" aria-hidden />
          <span className="min-w-0 break-words">{player.bio}</span>
        </p>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.text} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
              {c.icon}
              {c.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
