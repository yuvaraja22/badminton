import { useState } from 'react';
import { Camera } from 'lucide-react';
import { useAuth } from '../../lib/data/context';
import { updatePlayer } from '../../lib/data/mutations';
import { photoToDataUrl } from '../../lib/image';
import { toast } from '../../lib/toast';
import type { Player } from '../../lib/types';
import { Avatar } from '../ui/Avatar';

/** A player's photo. Admins can tap it to pick a new one (cropped to a square automatically). */
export function PhotoButton({ player, size = 64 }: { player: Player; size?: number }) {
  const { isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return <Avatar name={player.name} photo={player.photo} size={size} />;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      updatePlayer(player.id, { photo: await photoToDataUrl(file) });
      toast(`Updated ${player.name}'s photo`, 'success');
    } catch {
      toast("Couldn't read that image. Try a JPEG or PNG.", 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="relative shrink-0 cursor-pointer" title={`Change ${player.name}'s photo`}>
      <Avatar name={player.name} photo={player.photo} size={size} className={busy ? 'opacity-50' : undefined} />
      <span className="absolute -right-0.5 -bottom-0.5 inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-ink ring-2 ring-surface">
        <Camera size={13} aria-hidden />
      </span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={`Change ${player.name}'s photo`}
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </label>
  );
}
