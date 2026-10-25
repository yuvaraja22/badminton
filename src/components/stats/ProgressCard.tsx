import { useState } from 'react';
import { useData } from '../../lib/data/context';
import type { PlayerSessionLine } from '../../lib/engine/alltime';
import { PROVISIONAL_GAMES } from '../../lib/engine/rating';
import { oneDecimal, shortDate } from '../../lib/format';
import type { PlayerId } from '../../lib/types';
import { Card, CardHeader } from '../ui/Card';
import { Segmented } from '../ui/Segmented';
import { RatingChart } from './RatingChart';
import { WinRateChart, type WinRatePoint } from './WinRateChart';

type View = 'rating' | 'winRate';

/**
 * A player's progress in one card: their skill rating after every session, or their win rate in each
 * session, switched with the tabs at the top (only one of them when there isn't enough for both).
 */
export function ProgressCard({ playerId, sessions, you }: { playerId: PlayerId; sessions: PlayerSessionLine[]; you?: boolean }) {
  const r = useData().ratings.get(playerId);
  const [picked, setPicked] = useState<View>('rating');
  const rating = r && r.history.length >= 2 ? r : null;
  // Sessions come newest first; the chart reads oldest first.
  const winData: WinRatePoint[] = [...sessions].reverse().map((s) => ({
    label: shortDate(s.date),
    title: s.title,
    winRate: Math.round(s.winRate * 1000) / 10,
    record: `${s.won}-${s.lost}`,
  }));
  const hasWinRate = winData.length >= 2;
  if (!rating && !hasWinRate) return null;
  const both = Boolean(rating) && hasWinRate;
  const view: View = !rating ? 'winRate' : !hasWinRate ? 'rating' : picked;

  let title: string;
  let subtitle: string;
  if (view === 'rating' && rating) {
    title = you ? 'Your skill rating' : 'Skill rating';
    subtitle = rating.provisional
      ? `${oneDecimal(rating.level)} · provisional (${rating.games} of ${PROVISIONAL_GAMES} games). Starts from their level and moves with every result.`
      : `${oneDecimal(rating.level)} now${rating.peak !== null ? ` · peak ${oneDecimal(rating.peak)}` : ''}. Each point is the rating after a session.`;
  } else {
    title = you ? 'Your win rate by session' : 'Win rate by session';
    subtitle = 'Each point is one session; the sessions list below has the same numbers.';
  }

  return (
    <Card>
      {both && (
        <div className="px-4 pt-4">
          <Segmented
            value={view}
            onChange={setPicked}
            options={[
              { value: 'rating', label: 'Skill rating' },
              { value: 'winRate', label: 'Win rate' },
            ]}
          />
        </div>
      )}
      <CardHeader title={title} subtitle={subtitle} className={both ? 'pt-3' : undefined} />
      <div className="px-2 pt-3 pb-2">{view === 'rating' && rating ? <RatingChart points={rating.history} /> : <WinRateChart data={winData} />}</div>
    </Card>
  );
}
