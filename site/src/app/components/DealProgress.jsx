import ApperIcon from '@/components/ApperIcon';
import DotMeter from '@/components/DotMeter';
import { cn } from '@/lib/utils';
import { dealState, timeLeft, isOpen, inr } from '@/services/dealRules';

export function progressCaption(st) {
  if (st.full) return 'Round full';
  if (!st.unlocked) return `${st.toMin} more to unlock`;
  if (st.next) return `${st.toNext} more for ${inr(st.next.price)}`;
  return 'Best price reached';
}

export default function DealProgress({ deal, showCountdown = true, size = 'md', className }) {
  const st = dealState(deal);
  const open = isOpen(deal);

  return (
    <div className={cn('space-y-3', className)}>
      <DotMeter deal={deal} size={size} />
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium tabular-nums text-foreground">{st.booked} booked</span>
        <span className={cn('text-right', st.unlocked ? 'font-medium text-primary' : 'text-muted-foreground')}>{progressCaption(st)}</span>
      </div>
      {showCountdown && (
        <p className="flex justify-center pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[13px] text-muted-foreground">
            <ApperIcon name="Clock" size={13} className="flex-none" />
            {open ? timeLeft(deal?.deadline_c) : deal?.status_c === 'Draft' ? 'Not published' : 'Closed'}
            {st.min && !st.unlocked ? `, unlocks at ${st.min}` : ''}
          </span>
        </p>
      )}
    </div>
  );
}
