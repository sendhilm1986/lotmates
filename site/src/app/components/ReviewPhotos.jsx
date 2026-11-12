import { useState } from 'react';
import { Dialog as Primitive } from 'radix-ui';
import ApperIcon from '@/components/ApperIcon';
import { ModalClose } from '@/components/ui/modal-close';
import { cn } from '@/lib/utils';
import { reviewPhotos } from '@/services/records';

/** A review's photos as small thumbnails; tapping one opens it full size. */
export default function ReviewPhotos({ review, className, size = 'md' }) {
  const photos = reviewPhotos(review);
  const [index, setIndex] = useState(-1);
  if (!photos.length) return null;
  const open = index >= 0;
  const go = (n) => setIndex((i) => (i + n + photos.length) % photos.length);

  return (
    <>
      <ul className={cn('flex flex-wrap gap-2', className)} aria-label="Photos from this review">
        {photos.map((p, i) => (
          <li key={p.id ?? i}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className={cn('block overflow-hidden rounded-xl bg-muted ring-1 ring-border transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', size === 'lg' ? 'size-28' : 'size-20')}
              aria-label={`Open photo ${i + 1} of ${photos.length}`}
            >
              <img src={p.thumb || p.src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      <Primitive.Root open={open} onOpenChange={(v) => !v && setIndex(-1)}>
        <Primitive.Portal>
          <Primitive.Overlay className="fixed inset-0 z-50 bg-[#0b1d16]/95 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Primitive.Content
            aria-describedby={undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') go(1);
              if (e.key === 'ArrowLeft') go(-1);
            }}
            className="fixed inset-0 z-50 flex flex-col outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <div className="flex h-16 flex-none items-center justify-between gap-4 px-4 text-white md:h-20 md:px-8">
              <Primitive.Title className="text-sm text-white/80">
                {review?.Name}
                {photos.length > 1 && <span className="ml-2 tabular-nums text-white/50">{index + 1} / {photos.length}</span>}
              </Primitive.Title>
              <ModalClose as={Primitive.Close} size="lg" label="Close photo" buttonClassName="bg-white/10 text-white ring-white/20 hover:bg-white/20" className="[&_kbd]:border-white/25 [&_kbd]:bg-transparent [&_kbd]:text-white/70" />
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 md:px-20">
              {open && <img src={photos[index].src} alt={`Photo ${index + 1} from the review`} className="max-h-full max-w-full rounded-lg object-contain" />}
              {photos.length > 1 && (
                <>
                  <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 md:left-6">
                    <ApperIcon name="ChevronLeft" size={22} />
                  </button>
                  <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 md:right-6">
                    <ApperIcon name="ChevronRight" size={22} />
                  </button>
                </>
              )}
            </div>
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </>
  );
}
