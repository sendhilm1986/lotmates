import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { cn } from '@/lib/utils';
import ApperIcon from '@/components/ApperIcon';

const MAX = 8;
const LONG_EDGE = 2000;

// Shrink big phone photos before upload: faster for the team, lighter for neighbours.
async function prepare(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name} isn't a JPG, PNG or WebP photo.`);
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
}

/**
 * The team's photo list for a deal: upload, caption, reorder, remove.
 * The first photo is the cover on cards and at the top of the deal page.
 */
export default function PhotoManager({ value, onChange, dealName }) {
  const photos = Array.isArray(value) ? value : [];
  const [pending, setPending] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const latest = useRef(photos);
  latest.current = photos;
  const room = MAX - photos.length - pending.length;

  async function add(fileList) {
    const files = [...fileList].slice(0, Math.max(0, room));
    if (fileList.length > files.length) toast.warning(`A deal can have up to ${MAX} photos.`);
    for (const file of files) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const preview = URL.createObjectURL(file);
      setPending((p) => [...p, { key, preview }]);
      try {
        const ready = await prepare(file);
        const r = await sdk.media.upload(ready, dealName);
        if (!r.ok) throw new Error(r.error.message);
        latest.current = [...latest.current, { ...r.value, caption: '' }];
        onChange(latest.current);
      } catch (err) {
        toast.error(err.message || `${file.name} didn't upload.`);
      } finally {
        setPending((p) => p.filter((x) => x.key !== key));
        URL.revokeObjectURL(preview);
      }
    }
  }

  const update = (i, patch) => onChange(photos.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i) => onChange(photos.filter((_, j) => j !== i));

  return (
    <div className="grid gap-4">
      {(photos.length > 0 || pending.length > 0) && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-2xl bg-background/60 ring-1 ring-border">
              <div className="relative aspect-[4/3] bg-muted">
                <img src={p.medium || p.large || p.full} alt="" className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute left-2.5 top-2.5 rounded-md bg-card/95 px-2 py-0.5 text-xs font-medium text-foreground">Cover</span>}
                <div className="absolute right-2 top-2 flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" className="flex size-8 items-center justify-center rounded-full bg-card/95 text-foreground shadow-sm hover:bg-card disabled:opacity-40">
                    <ApperIcon name="ChevronLeft" size={16} />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1} aria-label="Move later" className="flex size-8 items-center justify-center rounded-full bg-card/95 text-foreground shadow-sm hover:bg-card disabled:opacity-40">
                    <ApperIcon name="ChevronRight" size={16} />
                  </button>
                  <button type="button" onClick={() => remove(i)} aria-label="Remove photo" className="flex size-8 items-center justify-center rounded-full bg-card/95 text-destructive shadow-sm hover:bg-card">
                    <ApperIcon name="Trash2" size={15} />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <label htmlFor={`cap-${p.id}`} className="sr-only">Caption for photo {i + 1}</label>
                <input
                  id={`cap-${p.id}`}
                  value={p.caption ?? ''}
                  maxLength={140}
                  onChange={(e) => update(i, { caption: e.target.value })}
                  placeholder={i === 0 ? 'e.g. Our 3-person crew at work' : 'What does this photo show?'}
                  className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </div>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="overflow-hidden rounded-2xl ring-1 ring-border">
              <div className="relative aspect-[4/3] bg-muted">
                <img src={p.preview} alt="" className="h-full w-full object-cover opacity-50" />
                <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-foreground">
                  <ApperIcon name="LoaderCircle" size={18} className="animate-spin" />
                  Uploading
                </span>
              </div>
              <div className="h-16" />
            </li>
          ))}
        </ul>
      )}

      {room > 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); add(e.dataTransfer.files); }}
          className={cn(
            'flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30 hover:bg-muted/40',
          )}
        >
          <ApperIcon name="ImagePlus" size={24} className="text-primary" />
          <span className="font-medium text-foreground">{photos.length ? 'Add more photos' : 'Add photos'}</span>
          <span className="text-sm text-muted-foreground">Drop them here or choose from your device. JPG, PNG or WebP, {room} more allowed.</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
