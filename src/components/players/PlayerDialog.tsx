import { useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { useData } from '../../lib/data/context';
import { createPlayer, updatePlayer } from '../../lib/data/mutations';
import { photoToDataUrl } from '../../lib/image';
import { toast } from '../../lib/toast';
import type { Player } from '../../lib/types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Field, Input, LevelStepper, Toggle } from '../ui/Field';

/** Create a player (player = null) or edit one. */
export function PlayerDialog({ open, onClose, player }: { open: boolean; onClose: () => void; player: Player | null }) {
  return (
    <Dialog open={open} onClose={onClose} title={player ? `Edit ${player.name}` : 'New player'}>
      {open && <PlayerForm key={player?.id ?? 'new'} player={player} onDone={onClose} />}
    </Dialog>
  );
}

function PlayerForm({ player, onDone }: { player: Player | null; onDone: () => void }) {
  const { players } = useData();
  const [name, setName] = useState(player?.name ?? '');
  const [level, setLevel] = useState(player?.level ?? 3);
  const [active, setActive] = useState(player?.active ?? true);
  const [photo, setPhoto] = useState<string | null>(player?.photo ?? null);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await photoToDataUrl(file));
    } catch {
      toast("Couldn't read that image", 'error');
    }
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Enter a name.');
    const clash = players.find((p) => p.id !== player?.id && p.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (clash) return setError(`There is already a player called ${clash.name}. Names must be unique so reports stay clear.`);
    if (player) updatePlayer(player.id, { name: trimmed, level, active, photo });
    else createPlayer({ name: trimmed, level, photo });
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={name || '?'} photo={photo} size={64} />
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold hover:bg-surface-2">
            <Camera size={15} /> {photo ? 'Change photo' : 'Add photo'}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </label>
          {photo && (
            <Button variant="ghost" size="sm" onClick={() => setPhoto(null)}>
              <Trash2 size={15} /> Remove
            </Button>
          )}
        </div>
      </div>
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vikram" autoFocus={!player} />
      </Field>
      <Field label="Level" hint="From Amateur Low up to Professional High. Used as the default when starting a session.">

        <LevelStepper value={level} onChange={setLevel} />
      </Field>
      {player && (
        <Toggle checked={active} onChange={setActive} label={active ? 'Active (shown when starting sessions)' : 'Archived (hidden, stats kept)'} />
      )}
      {error && <Notice tone="bad">{error}</Notice>}
      <Button block onClick={save}>
        {player ? 'Save' : 'Add player'}
      </Button>
    </div>
  );
}
