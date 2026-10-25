import { useState } from 'react';
import { BadgeCheck, Clock } from 'lucide-react';
import { useAuth } from '../../lib/data/context';
import { cancelLinkRequest, requestLink } from '../../lib/data/mutations';
import { toast } from '../../lib/toast';
import type { Player } from '../../lib/types';
import { Button } from '../ui/Button';

/**
 * "This is me", for someone signed in whose Google account isn't linked to a player yet. It asks an
 * admin to link them; while it waits, the button says so (and can withdraw the request).
 */
export function ClaimButton({ player, size = 'sm' }: { player: Player; size?: 'sm' | 'md' }) {
  const { user, playerId, claim } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user?.email || playerId) return null;
  const email = user.email;
  const mine = claim?.playerId === player.id;

  const run = async (work: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await work();
      toast(done, 'success');
    } catch (e) {
      toast(`Couldn't send that: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return mine ? (
    <Button variant="secondary" size={size} disabled={busy} onClick={() => run(() => cancelLinkRequest(email), 'Request withdrawn')} title="Tap to withdraw the request">
      <Clock size={14} /> Waiting for an admin
    </Button>
  ) : (
    <Button
      variant="secondary"
      size={size}
      disabled={busy}
      onClick={() => run(() => requestLink(email, player.id, user.displayName ?? ''), `Sent. Once an admin confirms, you can edit ${player.name}'s profile and RSVP.`)}
    >
      <BadgeCheck size={14} /> This is me
    </Button>
  );
}
