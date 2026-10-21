import { useState } from 'react';
import { Camera } from 'lucide-react';
import { useAuth } from '../../lib/data/context';
import { updatePlayer } from '../../lib/data/mutations';
import { toast } from '../../lib/toast';
import type { Player } from '../../lib/types';
import { Avatar } from '../ui/Avatar';
import { Dialog } from '../ui/Dialog';
import { PhotoCropper } from './PhotoCropper';

/** A player's photo. Admins can tap it to pick a new one, then zoom and position it. */
export function PhotoButton({ player, size = 64 }: { player: Player; size?: number }) {
  const { isAdmin } = useAuth();
  const [src, setSrc] = useState<string | null>(null);
  if (!isAdmin) return <Avatar name={player.name} photo={player.photo} size={size} />;

  const close = () => {
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
  };

  return (
    <>
      <label className="relative shrink-0 cursor-pointer" title={`Change ${player.name}'s photo`}>
        <Avatar name={player.name} photo={player.photo} size={size} />
        <span className="absolute -right-0.5 -bottom-0.5 inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-ink ring-2 ring-surface">
          <Camera size={13} aria-hidden />
        </span>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={`Change ${player.name}'s photo`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) setSrc(URL.createObjectURL(file));
          }}
        />
      </label>
      <Dialog open={src !== null} onClose={close} title={`${player.name}'s photo`}>
        {src && (
          <PhotoCropper
            src={src}
            onCancel={close}
            onDone={(photo) => {
              updatePlayer(player.id, { photo });
              toast(`Updated ${player.name}'s photo`, 'success');
              close();
            }}
          />
        )}
      </Dialog>
    </>
  );
}
