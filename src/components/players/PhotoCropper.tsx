import { useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { Minus, Plus } from 'lucide-react';
import { cropToDataUrl } from '../../lib/image';
import { toast } from '../../lib/toast';
import { Button } from '../ui/Button';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

/** Position and zoom a new photo inside the round frame (pinch, drag, scroll or the slider). */
export function PhotoCropper({ src, onCancel, onDone }: { src: string; onCancel: () => void; onDone: (dataUrl: string) => void }) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const nudge = (by: number) => setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + by)));

  const save = async () => {
    if (!area) return;
    setBusy(true);
    try {
      onDone(await cropToDataUrl(src, area));
    } catch {
      toast("Couldn't use that image. Try a JPEG or PNG.", 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative h-72 overflow-hidden rounded-xl bg-black sm:h-80">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
        />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Zoom out" onClick={() => nudge(-0.25)} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-2">
          <Minus size={18} />
        </button>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="h-2 flex-1 cursor-pointer accent-[var(--primary)]"
        />
        <button type="button" aria-label="Zoom in" onClick={() => nudge(0.25)} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-2">
          <Plus size={18} />
        </button>
      </div>
      <p className="text-xs text-muted">Pinch or use the slider to zoom, and drag to move. The circle is what everyone will see.</p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={!area || busy} onClick={save}>
          {busy ? 'Saving…' : 'Use photo'}
        </Button>
      </div>
    </div>
  );
}
