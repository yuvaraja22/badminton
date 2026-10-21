import { useData } from '../../lib/data/context';
import { oneDecimal } from '../../lib/format';
import type { PlayerId } from '../../lib/types';
import { Badge } from '../ui/Badge';

/** "Rating 3.7" (or "Rating 3.2 · provisional"); nothing for a player with no rated games. */
export function RatingBadge({ playerId, className }: { playerId: PlayerId; className?: string }) {
  const r = useData().ratings.get(playerId);
  if (!r) return null;
  return (
    <Badge className={className}>
      <span title={`Skill rating from ${r.games} game${r.games === 1 ? '' : 's'}, on the level scale`}>
        Rating {oneDecimal(r.level)}
        {r.provisional ? ' · provisional' : ''}
      </span>
    </Badge>
  );
}
