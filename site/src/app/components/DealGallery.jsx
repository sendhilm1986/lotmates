import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog as Primitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import ApperIcon from '@/components/ApperIcon';
import { dealMediaItems } from '@/services/dealMedia';

// A horizontal, swipeable strip of photos that reports which one is in view.
function useTrack(count) {
  const ref = useRef(null);
  const [index, setIndex] = useState(0);
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el || !el.clientWidth) return;
    setIndex(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth))));
  }, [count]);
  const go = useCallback((i, smooth = true) => {
    const el = ref.current;
    if (!el) return;
    const next = (i + count) % count;
    el.scrollTo({ left: next * el.clientWidth, behavior: smooth ? 'smooth' : 'instant' });
    setIndex(next);
  }, [count]);
  return { ref, index, onScroll, go };
}

const arrow =
  'absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/95 text-foreground shadow-[0_2px_10px_rgb(15_42_32/0.18)] transition-[opacity,transform] duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function DealGallery({ deal, children }) {
  const photos = dealMediaItems(deal);
  const [playing, setPlaying] = useState(null);
  const many = photos.length > 1;
  const main = useTrack(photos.length);
  const [lightbox, setLightbox] = useState(null);
  const current = photos[main.index] ?? photos[0];
  useEffect(() => {
    if (playing !== null && playing !== main.index) setPlaying(null);
  }, [main.index, playing]);

  return (
    <div>
      <div className="group relative aspect-[16/9] overflow-hidden rounded-[24px] bg-muted">
        <div
          ref={main.ref}
          onScroll={main.onScroll}
          className="flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((p, i) =>
            p.video ? (
              <div key={p.key} className="relative h-full w-full flex-none snap-center bg-[#0b1d16]">
                {playing === i ? (
                  <iframe
                    src={p.video.embed(true)}
                    title="Video about this deal"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full border-0"
                  />
                ) : (
                  <button type="button" onClick={() => setPlaying(i)} className="group/play absolute inset-0 focus-visible:outline-none" aria-label="Play the video">
                    {p.large && <img src={p.large} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover opacity-90" />}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    <span className="absolute left-1/2 top-1/2 flex size-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-primary shadow-[0_8px_30px_rgb(0_0_0/0.25)] transition-transform duration-200 group-hover/play:scale-105 group-focus-visible/play:ring-4 group-focus-visible/play:ring-white/60">
                      <ApperIcon name="Play" size={30} className="ml-1 fill-current" />
                    </span>
                    <span className="absolute bottom-3 left-3 rounded-full bg-[#0f2a20]/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">Video</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                key={p.key}
                type="button"
                onClick={() => setLightbox(i)}
                className="relative h-full w-full flex-none snap-center cursor-zoom-in focus-visible:outline-none"
                aria-label={`Open photo ${i + 1} of ${photos.length}${p.caption ? `: ${p.caption}` : ''}`}
              >
                <img src={p.large} alt={p.caption} loading={i === 0 ? 'eager' : 'lazy'} draggable={false} className="h-full w-full object-cover" />
              </button>
            ),
          )}
        </div>

        {children}

        {many && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => main.go(main.index - 1)} className={cn(arrow, 'left-3 hidden opacity-0 group-hover:opacity-100 focus-visible:opacity-100 md:flex')}>
              <ApperIcon name="ChevronLeft" size={20} />
            </button>
            <button type="button" aria-label="Next photo" onClick={() => main.go(main.index + 1)} className={cn(arrow, 'right-3 hidden opacity-0 group-hover:opacity-100 focus-visible:opacity-100 md:flex')}>
              <ApperIcon name="ChevronRight" size={20} />
            </button>
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-[#0f2a20]/70 px-2.5 py-1 text-xs font-medium tabular-nums text-white backdrop-blur-sm">
              {main.index + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      {current?.caption && <p className="mt-3 text-sm text-muted-foreground">{current.caption}</p>}

      {many && (
        <div className="-mx-1.5 mt-2 flex gap-2.5 overflow-x-auto px-1.5 py-1.5 [scrollbar-width:none]" role="tablist" aria-label="Photos">
          {photos.map((p, i) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={i === main.index}
              aria-label={`Photo ${i + 1}${p.caption ? `: ${p.caption}` : ''}`}
              onClick={() => main.go(i)}
              className={cn(
                'relative aspect-[4/3] w-20 flex-none overflow-hidden rounded-xl transition-[opacity,box-shadow] duration-200 focus-visible:outline-none md:w-24',
                i === main.index ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100',
              )}
            >
              {p.thumb ? <img src={p.thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-[#0b1d16]" />}
              {p.video && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <span className="flex size-7 items-center justify-center rounded-full bg-white/95 text-primary">
                    <ApperIcon name="Play" size={13} className="ml-0.5 fill-current" />
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <Lightbox photos={photos} start={lightbox} onClose={(i) => { if (i != null) main.go(i, false); setLightbox(null); }} title={deal?.Name} />
    </div>
  );
}

function Lightbox({ photos, start, onClose, title }) {
  const open = start !== null && start !== undefined;
  const track = useTrack(photos.length);
  const many = photos.length > 1;

  // Jump to the photo that was tapped as soon as the viewer opens.
  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => track.go(start, false));
    return () => cancelAnimationFrame(t);
  }, [open, start]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = photos[track.index] ?? photos[0];

  return (
    <Primitive.Root open={open} onOpenChange={(v) => !v && onClose(track.index)}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 bg-[#0b1d16]/95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200" />
        <Primitive.Content
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') track.go(track.index + 1);
            if (e.key === 'ArrowLeft') track.go(track.index - 1);
          }}
          className="fixed inset-0 z-50 flex flex-col outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=open]:duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200 motion-reduce:animate-none"
        >
          <div className="flex h-16 flex-none items-center justify-between gap-4 px-4 text-white md:h-20 md:px-8">
            <Primitive.Title className="min-w-0 truncate text-sm text-white/80">
              {title}
              {many && <span className="ml-2 tabular-nums text-white/50">{track.index + 1} / {photos.length}</span>}
            </Primitive.Title>
            <div className="flex flex-none items-center gap-2.5">
            <kbd aria-hidden className="hidden rounded-md border border-white/25 px-1.5 py-0.5 font-sans text-xs text-white/70 md:inline">Esc</kbd>
            <Primitive.Close className="group flex size-11 flex-none items-center justify-center rounded-full bg-white/10 text-white transition-[background-color,transform] duration-200 hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
              <ApperIcon name="X" size={20} strokeWidth={1.75} className="transition-transform duration-200 group-hover:rotate-90" />
              <span className="sr-only">Close photos</span>
            </Primitive.Close>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <div ref={track.ref} onScroll={track.onScroll} className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {photos.map((p, i) => (
                <div key={p.key} className="flex h-full w-full flex-none snap-center items-center justify-center px-4 md:px-24">
                  {p.video ? (
                    i === track.index ? (
                      <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-lg bg-black">
                        <iframe src={p.video.embed(false)} title="Video about this deal" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="h-full w-full border-0" />
                      </div>
                    ) : null
                  ) : (
                    <img src={p.large} alt={p.caption} draggable={false} className="max-h-full max-w-full rounded-lg object-contain" />
                  )}
                </div>
              ))}
            </div>
            {many && (
              <>
                <button type="button" aria-label="Previous photo" onClick={() => track.go(track.index - 1)} className="absolute left-6 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:flex">
                  <ApperIcon name="ChevronLeft" size={22} />
                </button>
                <button type="button" aria-label="Next photo" onClick={() => track.go(track.index + 1)} className="absolute right-6 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:flex">
                  <ApperIcon name="ChevronRight" size={22} />
                </button>
              </>
            )}
          </div>

          <div className="flex min-h-20 flex-none items-center justify-center px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
            <p className="max-w-2xl text-center text-[15px] leading-6 text-white/85">{current?.caption}</p>
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
