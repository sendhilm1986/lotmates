import { Dialog as Primitive } from 'radix-ui';
import ApperIcon from '@/components/ApperIcon';
import { ModalClose } from '@/components/ui/modal-close';
import { cn } from '@/lib/utils';

/**
 * A full-screen modal in the checkout's style: a slim header with a label on the left and
 * Esc and close on the right, then a roomy page with the main content and an optional aside.
 */
export default function FullScreenModal({ open, onOpenChange, label, icon = 'Sparkles', title, description, aside, closeLabel = 'Close', busy = false, children }) {
  return (
    <Primitive.Root open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <Primitive.Portal>
        <Primitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-50 flex flex-col bg-background outline-none will-change-[opacity,transform] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-6 data-[state=open]:duration-300 data-[state=open]:ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-3 data-[state=closed]:duration-200 data-[state=closed]:ease-in motion-reduce:animate-none"
        >
          <header className="flex-none border-b border-border/70 bg-background/90 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 md:h-[72px] md:px-8">
              <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                <ApperIcon name={icon} size={18} className="flex-none text-primary" />
                <span className="truncate">{label}</span>
              </p>
              <ModalClose as={Primitive.Close} size="lg" label={closeLabel} disabled={busy} />
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className={cn('mx-auto grid max-w-6xl gap-12 px-5 pb-12 pt-7 md:px-8 md:pt-12', aside && 'lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20')}>
              <div className="min-w-0">
                <Primitive.Title className="font-heading text-2xl font-bold leading-tight tracking-tight text-foreground md:text-[2rem]">{title}</Primitive.Title>
                {description ? (
                  <Primitive.Description className="mt-2 max-w-xl text-[15px] leading-6 text-muted-foreground">{description}</Primitive.Description>
                ) : (
                  <Primitive.Description className="sr-only">{title}</Primitive.Description>
                )}
                <div className="mt-8">{children}</div>
              </div>
              {aside && <aside className="lg:sticky lg:top-12 lg:self-start">{aside}</aside>}
            </div>
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
