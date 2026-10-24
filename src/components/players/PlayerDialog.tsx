import { useEffect, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { useData } from '../../lib/data/context';
import { createPlayer, listPlayerLinks, setPlayerLink, updateOwnProfile, updatePlayer } from '../../lib/data/mutations';
import { toast } from '../../lib/toast';
import { PROFILE_LIMITS, type CourtPosition, type Hand, type Player } from '../../lib/types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Card';
import { Dialog } from '../ui/Dialog';
import { Field, Input, LevelStepper, Select, Textarea, Toggle } from '../ui/Field';
import { PhotoCropper } from './PhotoCropper';

type Mode = 'admin' | 'self';

/**
 * Create a player (admin, player = null) or edit one. In "self" mode a linked player edits their
 * own photo, name, bio and playing style; level, status and the account link stay admin-only.
 */
export function PlayerDialog({ open, onClose, player, mode = 'admin' }: { open: boolean; onClose: () => void; player: Player | null; mode?: Mode }) {
  const title = mode === 'self' ? 'Edit your profile' : player ? `Edit ${player.name}` : 'New player';
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {open && <PlayerForm key={player?.id ?? 'new'} player={player} mode={mode} onDone={onClose} />}
    </Dialog>
  );
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function PlayerForm({ player, mode, onDone }: { player: Player | null; mode: Mode; onDone: () => void }) {
  const { players, nameOf } = useData();
  const admin = mode === 'admin';
  const [name, setName] = useState(player?.name ?? '');
  const [level, setLevel] = useState(player?.level ?? 3);
  const [active, setActive] = useState(player?.active ?? true);
  const [photo, setPhoto] = useState<string | null>(player?.photo ?? null);
  const [bio, setBio] = useState(player?.bio ?? '');
  const [hand, setHand] = useState<Hand | ''>(player?.hand ?? '');
  const [position, setPosition] = useState<CourtPosition | ''>(player?.position ?? '');
  const [racket, setRacket] = useState(player?.racket ?? '');
  const [error, setError] = useState<string | null>(null);
  // A newly picked photo waiting to be zoomed and positioned.
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  // Admin only: the Google account linked to this player (loaded on open).
  const [links, setLinks] = useState<Record<string, string> | null>(null);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  // Keyed on the id: the player object is replaced on every snapshot, which would refetch and
  // overwrite an email the admin is typing.
  const playerId = player?.id;
  useEffect(() => {
    if (!admin) return;
    let alive = true;
    listPlayerLinks()
      .then((map) => {
        if (!alive) return;
        setLinks(map);
        if (playerId) setEmail(map[playerId] ?? '');
      })
      .catch(() => alive && setLinks({}));
    return () => {
      alive = false;
    };
  }, [admin, playerId]);

  const closeCropper = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Enter a name.');
    if (trimmed.length > PROFILE_LIMITS.name) return setError(`Keep the name under ${PROFILE_LIMITS.name} characters.`);
    const clash = players.find((p) => p.id !== player?.id && p.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (clash) return setError(`There is already a player called ${clash.name}. Names must be unique so reports stay clear.`);
    const profile = {
      name: trimmed,
      photo,
      bio: bio.trim() || null,
      hand: hand || null,
      position: position || null,
      racket: racket.trim() || null,
    };

    if (!admin) {
      updateOwnProfile(player!.id, profile);
      toast('Profile saved', 'success');
      return onDone();
    }

    const wanted = email.trim().toLowerCase();
    if (wanted && !EMAIL.test(wanted)) return setError('Enter a valid Google email, or leave it empty.');
    const linkedTo = links ? Object.entries(links).find(([pid, e]) => e === wanted && pid !== player?.id)?.[0] : undefined;
    if (wanted && linkedTo) return setError(`${wanted} is already linked to ${nameOf(linkedTo)}.`);

    let id = player?.id;
    if (player) updatePlayer(player.id, { ...profile, level, active });
    else id = createPlayer({ ...profile, level });

    const previous = (player && links?.[player.id]) || null;
    if (id && wanted !== (previous ?? '')) {
      setSaving(true);
      try {
        await setPlayerLink(id, wanted || null, previous);
        toast(wanted ? `${trimmed} can now sign in as ${wanted}` : `${trimmed} is no longer linked to a Google account`, 'success');
      } catch (e) {
        setSaving(false);
        return setError(`Couldn't update the linked account: ${(e as Error).message}`);
      }
    }
    onDone();
  };

  if (cropSrc) {
    return (
      <PhotoCropper
        src={cropSrc}
        onCancel={closeCropper}
        onDone={(cropped) => {
          setPhoto(cropped);
          closeCropper();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={name || '?'} photo={photo} size={64} />
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-semibold hover:bg-surface-2">
            <Camera size={15} /> {photo ? 'Change photo' : 'Add photo'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) setCropSrc(URL.createObjectURL(file));
              }}
            />
          </label>
          {photo && (
            <Button variant="ghost" size="sm" onClick={() => setPhoto(null)}>
              <Trash2 size={15} /> Remove
            </Button>
          )}
        </div>
      </div>
      <Field label="Name" hint={mode === 'self' ? 'Shown everywhere, including reports and your profile link.' : undefined}>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={PROFILE_LIMITS.name} placeholder="e.g. Vikram" autoFocus={!player} />
      </Field>
      <Field label="Bio" hint={`${bio.length}/${PROFILE_LIMITS.bio}`}>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={PROFILE_LIMITS.bio}
          rows={2}
          className="min-h-0"
          placeholder="Smash first, ask questions later."
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Plays">
          <Select value={hand} onChange={(e) => setHand(e.target.value as Hand | '')}>
            <option value="">Not set</option>
            <option value="right">Right-handed</option>
            <option value="left">Left-handed</option>
          </Select>
        </Field>
        <Field label="Likes to play">
          <Select value={position} onChange={(e) => setPosition(e.target.value as CourtPosition | '')}>
            <option value="">Not set</option>
            <option value="front">Front court</option>
            <option value="back">Back court</option>
            <option value="both">All-court</option>
          </Select>
        </Field>
      </div>
      <Field label="Racket">
        <Input value={racket} onChange={(e) => setRacket(e.target.value)} maxLength={PROFILE_LIMITS.racket} placeholder="Yonex Astrox 88D" />
      </Field>

      {admin && (
        <>
          <Field label="Level" hint="From Amateur Low up to Professional High. Used as the default when starting a session.">
            <LevelStepper value={level} onChange={setLevel} />
          </Field>
          <Field
            label="Linked Google account"
            hint="When this person signs in with Google using this email, they can edit their own profile, RSVP and see their Me tab. Only admins can see it."
          >
            <Input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={links === null ? 'Loading…' : 'player@gmail.com'}
              disabled={links === null}
            />
          </Field>
          {player && (
            <Toggle checked={active} onChange={setActive} label={active ? 'Active (shown when starting sessions)' : 'Archived (hidden, stats kept)'} />
          )}
        </>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
      <Button block onClick={save} disabled={saving}>
        {saving ? 'Saving…' : player ? 'Save' : 'Add player'}
      </Button>
    </div>
  );
}
