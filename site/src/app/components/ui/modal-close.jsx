import { XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The close control every modal, alert and sheet uses: an "Esc" hint on wider screens and a
 * round close button. Pass the Radix Close (or AlertDialog Cancel) primitive as `as`.
 */
export function ModalClose({ as: Comp, label = 'Close', size = 'md', className, buttonClassName, ...props }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <kbd aria-hidden className="hidden rounded-md border border-border bg-card px-1.5 py-0.5 font-sans text-xs text-muted-foreground md:inline">
        Esc
      </kbd>
      <Comp
        className={cn(
          'group flex flex-none items-center justify-center rounded-full bg-card text-foreground shadow-sm ring-1 ring-border transition-[background-color,box-shadow,transform] duration-200 hover:bg-muted hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          size === 'lg' ? 'size-11' : 'size-10',
          buttonClassName,
        )}
        {...props}
      >
        <XIcon className={cn('transition-transform duration-200 group-hover:rotate-90', size === 'lg' ? 'size-5' : 'size-[18px]')} strokeWidth={1.75} />
        <span className="sr-only">{label}</span>
      </Comp>
    </div>
  );
}
