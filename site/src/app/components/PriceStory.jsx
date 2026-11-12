import { cn } from '@/lib/utils';
import { inr } from '@/services/dealRules';

/**
 * The money story as a sum people can follow: what you pay now, minus what comes back,
 * equals what it costs you. Sits under the houses wherever a "Book" button is.
 */
export default function PriceStory({ st, className }) {
  const pay = st.tier1?.price;
  const final = st.current?.price;
  const back = st.refundPerUnit;
  const best = st.tiers.at(-1)?.price;
  const col = 'row-span-2 row-start-1 grid min-w-0 grid-rows-subgrid gap-y-1 text-center';
  const op = 'row-start-2 self-center flex w-5 items-center justify-center font-heading text-lg leading-7 text-muted-foreground';
  return (
    <div className={cn('rounded-2xl border border-border bg-muted/40 px-4 py-4', className)}>
      <dl className="grid grid-cols-[1fr_auto_1fr_auto_1fr] grid-rows-[auto_auto] items-center">
        <div className={cn(col, 'col-start-1')}>
          <dt className="text-sm text-muted-foreground">Pay now</dt>
          <dd className="font-heading text-lg font-bold leading-7 tabular-nums text-foreground">{inr(pay)}</dd>
        </div>
        <div aria-hidden className={cn(op, 'col-start-2')}>−</div>
        <div className={cn(col, 'col-start-3')}>
          <dt className="text-sm text-muted-foreground">Refund</dt>
          <dd className="font-heading text-lg font-bold leading-7 tabular-nums">
            {back > 0 ? <span className="rounded-md bg-highlight px-1.5 py-0.5 text-highlight-foreground">{inr(back)}</span> : <span className="text-foreground">₹0</span>}
          </dd>
        </div>
        <div aria-hidden className={cn(op, 'col-start-4')}>=</div>
        <div className={cn(col, 'col-start-5')}>
          <dt className="text-sm text-muted-foreground">Final cost</dt>
          <dd className="font-heading text-lg font-bold leading-7 tabular-nums text-primary">{inr(final)}</dd>
        </div>
      </dl>
      <p className="mt-3.5 text-balance border-t border-border pt-3 text-center text-[13px] leading-5 text-muted-foreground">
        {back > 0
          ? best < final
            ? `So far. More neighbours can bring it down to ${inr(best)}.`
            : 'The best price is unlocked.'
          : `The refund grows as neighbours join, down to ${inr(best)}.`}
      </p>
    </div>
  );
}
