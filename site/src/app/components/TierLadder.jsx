import ApperIcon from '@/components/ApperIcon';
import { cn } from '@/lib/utils';
import { dealState, inr } from '@/services/dealRules';

export default function TierLadder({ deal, compact = false }) {
  const st = dealState(deal);
  if (!st.tiers.length) {
    return <p className="text-sm text-muted-foreground">No price tiers set yet.</p>;
  }
  return (
    <div className="space-y-2">
      {st.tiers.map((t) => {
        const isCurrent = t.n === st.reached;
        const passed = t.n < st.reached;
        return (
          <div
            key={t.n}
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg border px-3 transition-colors duration-(--transition-fast)',
              compact ? 'py-2' : 'py-3',
              isCurrent
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : passed
                  ? 'border-border bg-muted/60 text-muted-foreground'
                  : 'border-border bg-card text-card-foreground',
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold',
                  isCurrent ? 'bg-primary-foreground text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {passed ? <ApperIcon name="Check" size={14} /> : t.n}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Tier {t.n}</p>
                <p className={cn('text-xs', isCurrent ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {t.from}–{t.to} {deal?.unit_c?.includes('person') ? 'people' : 'bookings'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn('font-heading text-lg font-bold tabular-nums', passed && 'line-through decoration-1')}>
                {inr(t.price)}
              </p>
              {isCurrent && !compact && (
                <p className="text-xs text-primary-foreground/80">Price now</p>
              )}
            </div>
          </div>
        );
      })}
      {st.refundPerUnit > 0 && (
        <div className="flex items-center gap-2 rounded-full bg-highlight px-3 py-1.5 text-sm font-semibold text-highlight-foreground">
          <ApperIcon name="ArrowDownLeft" size={16} />
          <span>{inr(st.refundPerUnit)} back to everyone who paid {inr(st.tier1?.price)}</span>
        </div>
      )}
    </div>
  );
}
