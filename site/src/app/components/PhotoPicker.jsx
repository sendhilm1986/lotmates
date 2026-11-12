import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { optimizeImage, formatBytes } from '@/services/imageOptimize';
import { reviewPhotos } from '@/services/records';

let tempId = 0;

/**
 * Photos for a review or complaint. Each one is shrunk and re-encoded in the browser, then
 * uploaded; the record only stores the ids when it's saved. Photos uploaded but not saved are
 * discarded when the form closes.
 */
export function usePhotoUploads(max = 4) {
  const [photos, setPhotos] = useState([]);
  const saved = useRef(false);

  function reset(record) {
    saved.current = false;
    setPhotos(reviewPhotos(record).map((p) => ({ key: p.id, id: p.id, thumb: p.thumb || p.src, status: 'ready', existing: true })));
  }

  async function addFiles(list) {
    const files = [...(list ?? [])].filter((f) => f.type.startsWith('image/'));
    const room = max - photos.length;
    if (!files.length) return;
    if (files.length > room) toast.message(`You can add up to ${max} photos, so we used the first ${Math.max(room, 0)}.`);
    for (const file of files.slice(0, Math.max(room, 0))) {
      const key = `t${++tempId}`;
      const preview = URL.createObjectURL(file);
      setPhotos((ps) => [...ps, { key, preview, status: 'working' }]);
      try {
        if (file.size > 25 * 1024 * 1024) throw new Error('That photo is over 25 MB. Choose a smaller one.');
        const opt = await optimizeImage(file);
        const r = await sdk.reviewPhotos.upload(opt.blob, 'photo');
        if (!r.ok) throw new Error(r.error.message);
        setPhotos((ps) => ps.map((p) => (p.key === key ? { ...p, id: r.value.id, thumb: r.value.thumb, status: 'ready', saved: opt.before - r.value.bytes } : p)));
      } catch (e) {
        setPhotos((ps) => ps.map((p) => (p.key === key ? { ...p, status: 'error', message: e.message } : p)));
      }
    }
  }

  function remove(p) {
    if (!p.existing && p.id) sdk.reviewPhotos.discard(p.id);
    if (p.preview) URL.revokeObjectURL(p.preview);
    setPhotos((ps) => ps.filter((x) => x.key !== p.key));
  }

  /** Call when the form closes without saving. */
  function discardUnsaved() {
    if (saved.current) return;
    photos.filter((p) => !p.existing && p.id).forEach((p) => sdk.reviewPhotos.discard(p.id));
  }

  return {
    photos,
    max,
    reset,
    addFiles,
    remove,
    discardUnsaved,
    markSaved: () => {
      saved.current = true;
    },
    working: photos.some((p) => p.status === 'working'),
    ids: photos.filter((p) => p.status === 'ready' && p.id).map((p) => p.id),
    savedBytes: photos.reduce((n, p) => n + (p.saved > 0 ? p.saved : 0), 0),
  };
}

export default function PhotoPicker({ uploads, label = 'Photos (optional)', hint = 'Avoid faces and house numbers.' }) {
  const fileRef = useRef(null);
  const { photos, max } = uploads;
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{photos.length} of {max}</span>
      </div>
      <div
        className="grid grid-cols-4 gap-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          uploads.addFiles(e.dataTransfer.files);
        }}
      >
        {photos.map((p) => (
          <div key={p.key} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
            <img src={p.thumb || p.preview} alt="" className={cn('size-full object-cover', p.status !== 'ready' && 'opacity-50')} />
            {p.status === 'working' && (
              <span className="absolute inset-0 flex items-center justify-center">
                <ApperIcon name="LoaderCircle" size={20} className="animate-spin text-foreground" />
              </span>
            )}
            {p.status === 'error' && (
              <span className="absolute inset-x-1 bottom-1 rounded-md bg-destructive px-1.5 py-0.5 text-center text-[11px] font-medium leading-tight text-white" title={p.message}>
                Didn&apos;t upload
              </span>
            )}
            <button
              type="button"
              onClick={() => uploads.remove(p)}
              aria-label="Remove photo"
              className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ApperIcon name="X" size={14} />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ApperIcon name="ImagePlus" size={20} />
            <span className="text-xs font-medium">Add</span>
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          uploads.addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <p className="text-xs text-muted-foreground">
        Photos are made smaller before they upload{uploads.savedBytes > 0 ? ` (saved ${formatBytes(uploads.savedBytes)} so far)` : ''}, and location details are removed. {hint}
      </p>
    </div>
  );
}
