import { Link } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import DealProgress from '@/components/DealProgress';
import { cn } from '@/lib/utils';
import { dealState, inr, categoryLabel, timeLeft, isOpen } from '@/services/dealRules';
import { dealCover } from '@/services/dealMedia';
import { useMyBookings } from '@/services/myBookings';

const STATUS_CHIP = {
  Draft: 'Draft',
  Closed: 'Closed',
  Failed: 'Did not unlock',
};

export default function DealCard({ record, to, className }) {
  const st = dealState(record);
  const href = to ?? `/deals/${record.Id}`;
  const where = record.community_c?.Name ?? record.locality_c?.Name ?? '';
  const open = isOpen(record);
  const mine = useMyBookings().some((b) => String(b.deal_c?.Id) === String(record.Id));

  return (
    <Link
      to={href}
      aria-label={`${record.Name}, ${inr(st.current?.price)}${record.unit_c ? ` ${record.unit_c}` : ''}${open ? `, ${timeLeft(record.deadline_c)}` : ''}`}
      className={cn(
        'group flex min-w-0 cursor-pointer flex-col rounded-[24px] bg-card p-3 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden rounded-[18px] bg-muted">
        <img
          src={dealCover(record, 720)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-(--transition-slow) group-hover:scale-[1.03]"
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1 text-xs font-medium text-foreground">
          {open ? (
            <>
              <ApperIcon name="Clock" size={12} />
              {timeLeft(record.deadline_c)}
            </>
          ) : (
            STATUS_CHIP[record.status_c] ?? 'Closed'
          )}
        </span>
        {mine && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            <ApperIcon name="Check" size={12} />
            Booked
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-2 pb-1 pt-4 text-center">
        <p className="truncate text-sm text-muted-foreground">
          {categoryLabel(record.category_c)}
          {where ? `, ${where}` : ''}
        </p>
        <h3 className="mt-1 line-clamp-2 text-lg font-semibold leading-snug text-foreground group-hover:text-primary">{record.Name}</h3>

        <div className="mt-3 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1">
          <span className="font-heading text-2xl font-bold tabular-nums text-foreground">{inr(st.current?.price)}</span>
          {record.regularPrice_c ? <span className="text-sm text-muted-foreground line-through">{inr(record.regularPrice_c)}</span> : null}
          {st.savingPct > 0 && <span className="self-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{st.savingPct}% less</span>}
        </div>
        {record.unit_c && <p className="mt-0.5 text-sm text-muted-foreground">{record.unit_c}</p>}

        <DealProgress deal={record} showCountdown={false} className="mt-3 text-left" />

        {open && (
          <dl className="mt-4 grid grid-cols-2 divide-x divide-border rounded-xl bg-muted/60 py-2.5">
            <div className="px-2">
              <dt className="text-xs text-muted-foreground">Pay today</dt>
              <dd className="mt-0.5 font-heading text-base font-bold tabular-nums text-foreground">{inr(st.tier1?.price)}</dd>
            </div>
            <div className="px-2">
              <dt className="text-xs text-muted-foreground">Back at close</dt>
              <dd className="mt-0.5 font-heading text-base font-bold tabular-nums">
                {st.refundPerUnit > 0 ? (
                  <span className="rounded-md bg-highlight px-1.5 py-0.5 text-highlight-foreground">{inr(st.refundPerUnit)}</span>
                ) : (
                  <span className="text-muted-foreground">₹0 so far</span>
                )}
              </dd>
            </div>
          </dl>
        )}

        <div className="mt-auto pt-4">
          <p className="truncate text-[13px] text-muted-foreground">By {record.vendor_c?.Name ?? 'a checked vendor'}</p>
          <span className="mt-3 flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary/10 text-sm font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            View deal
            <ApperIcon name="ChevronRight" size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}
