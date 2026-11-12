import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatLocalDate, formatRelativeTime, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import RatingStars from '@/components/RatingStars';
import ReviewPhotos from '@/components/ReviewPhotos';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { REVIEW_FIELDS, unwrapList } from '@/services/records';

const { eq } = window.ApperSDK.CoreSDK;

/** "Priya Raghavan" becomes "Priya R." so reviews name people without exposing them. */
export const shortName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'A neighbour';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

/** Shown on every review: each one comes from a paid booking whose job was finished. */
export function VerifiedTag({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success', className)} title="Written by a neighbour who booked through Lotmates, after the job was done">
      <ApperIcon name="ShieldCheck" size={12} />
      Verified booking
    </span>
  );
}

/**
 * A vendor's reviews: the average, how the stars split, and every review. With `moderate`,
 * the team can hide a review from neighbours (with a reason) or show it again. Nobody can
 * edit what a neighbour wrote.
 */
export default function VendorReviews({ vendorId, moderate = false, className }) {
  const [filter, setFilter] = useState('all');
  const [hiding, setHiding] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  const { data, loading, run } = useFetch(
    () => sdk.table('reviews_c').select([...REVIEW_FIELDS, 'hidden_c', 'hiddenReason_c']).where(eq('vendor_c', vendorId)).orderByDesc('CreatedOn').page(1, 200).fetch().then(unwrapList),
    [vendorId],
  );

  const all = data ?? [];
  const visible = all.filter((r) => !Number(r.hidden_c));
  const hiddenCount = all.length - visible.length;
  const avg = visible.length ? visible.reduce((s, r) => s + Number(r.rating_c || 0), 0) / visible.length : null;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: visible.filter((r) => Number(r.rating_c) === n).length }));
  const shown = filter === 'all' ? all.filter((r) => moderate || !Number(r.hidden_c)) : filter === 'hidden' ? all.filter((r) => Number(r.hidden_c)) : visible.filter((r) => Number(r.rating_c) === Number(filter));

  async function setHidden(review, hide) {
    setBusy(String(review.Id));
    try {
      const res = await sdk.table('reviews_c').update({ Id: review.Id, hidden_c: hide ? 1 : 0, hiddenReason_c: hide ? reason.trim() || null : null });
      if (res.messages?.length || res.message) {
        toast.error(res.messages?.[0] ?? res.message);
        return;
      }
      toast.success(hide ? 'Review hidden from neighbours' : 'Review shown again');
      setHiding(null);
      setReason('');
      run();
    } finally {
      setBusy('');
    }
  }

  return (
    <section className={cn('rounded-[22px] bg-card shadow-sm', className)} aria-labelledby={`reviews-${vendorId}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id={`reviews-${vendorId}`} className="font-heading text-lg font-bold text-foreground">Reviews</h2>
        <p className="text-sm text-muted-foreground">From neighbours who booked and had the job done</p>
      </div>

      {loading && !data ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading reviews…</p>
      ) : all.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ApperIcon name="Star" size={22} />
          </span>
          <p className="mt-3 font-medium text-foreground">No reviews yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Neighbours can review once the vendor marks their job done or their order delivered. We email them to ask.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 px-5 py-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-10">
            <div className="text-center sm:text-left">
              <p className="font-heading text-5xl font-bold leading-none tabular-nums text-foreground">{avg != null ? avg.toFixed(1) : '–'}</p>
              <RatingStars value={avg ?? 0} size={18} className="mt-2" />
              <p className="mt-1.5 text-sm text-muted-foreground">
                {visible.length} {visible.length === 1 ? 'review' : 'reviews'}
                {moderate && hiddenCount > 0 ? `, ${hiddenCount} hidden` : ''}
              </p>
            </div>
            <ul className="space-y-1.5">
              {dist.map((d) => (
                <li key={d.n}>
                  <button
                    type="button"
                    onClick={() => setFilter(filter === String(d.n) ? 'all' : String(d.n))}
                    aria-pressed={filter === String(d.n)}
                    disabled={!d.count}
                    className={cn('flex w-full items-center gap-3 rounded-lg px-1.5 py-0.5 text-sm transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent', filter === String(d.n) && 'bg-muted')}
                  >
                    <span className="w-8 flex-none text-left tabular-nums text-muted-foreground">{d.n} ★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${visible.length ? (d.count / visible.length) * 100 : 0}%` }} />
                    </span>
                    <span className="w-6 flex-none text-right tabular-nums text-muted-foreground">{d.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {(filter !== 'all' || (moderate && hiddenCount > 0)) && (
            <div className="flex flex-wrap gap-2 px-5 pb-4">
              <FilterChip on={filter === 'all'} onClick={() => setFilter('all')}>All</FilterChip>
              {filter !== 'all' && filter !== 'hidden' && <FilterChip on>{filter} stars</FilterChip>}
              {moderate && hiddenCount > 0 && <FilterChip on={filter === 'hidden'} onClick={() => setFilter('hidden')}>Hidden ({hiddenCount})</FilterChip>}
            </div>
          )}

          <ul className="divide-y divide-border border-t border-border">
            {shown.map((r) => {
              const hidden = Boolean(Number(r.hidden_c));
              return (
                <li key={r.Id} className={cn('px-5 py-5', hidden && 'bg-muted/40')}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <RatingStars value={r.rating_c} size={15} />
                    <VerifiedTag />
                    {hidden && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Hidden from neighbours</span>}
                  </div>
                  <p className="mt-2 font-heading text-[17px] font-bold leading-snug text-foreground">{r.Name}</p>
                  {r.comment_c && <p className="mt-1 whitespace-pre-line text-[15px] leading-6 text-foreground">{r.comment_c}</p>}
                  <ReviewPhotos review={r} className="mt-3" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {shortName(r.Owner?.Name)}
                    {r.deal_c?.Name ? `, ${r.deal_c.Name}` : ''}
                    {r.serviceDone_c ? `. Job done ${formatLocalDate(r.serviceDone_c, DATE_FORMATS.SHORT)}` : ''}
                    {`. Reviewed ${formatRelativeTime(r.CreatedOn)}`}
                  </p>
                  {hidden && r.hiddenReason_c && <p className="mt-2 rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground">Why it&apos;s hidden: {r.hiddenReason_c}</p>}
                  {moderate && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {hidden ? (
                        <Button size="sm" variant="outline" disabled={busy === String(r.Id)} onClick={() => setHidden(r, false)}>
                          <ApperIcon name="Eye" size={14} />
                          Show again
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setHiding(r)}>
                          <ApperIcon name="EyeOff" size={14} />
                          Hide
                        </Button>
                      )}
                      {r.booking_c?.Id && (
                        <Button size="sm" variant="ghost" className="text-muted-foreground" asChild>
                          <Link to={`/bookings/${r.booking_c.Id}`}>
                            <ApperIcon name="Ticket" size={14} />
                            Booking
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <AlertDialog open={Boolean(hiding)} onOpenChange={(v) => !v && setHiding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hide this review?</AlertDialogTitle>
            <AlertDialogDescription>
              Neighbours and the vendor won&apos;t see it, and it stops counting towards the rating. The person who wrote it still can. Hide reviews only when they break the review policy, never because they&apos;re negative.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. Shares a phone number" maxLength={160} aria-label="Reason for hiding" />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={!reason.trim() || busy === String(hiding?.Id)}
              onClick={(e) => {
                e.preventDefault();
                setHidden(hiding, true);
              }}
            >
              Hide review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function FilterChip({ on, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn('h-8 rounded-full border px-3 text-sm font-medium transition-colors', on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}
    >
      {children}
    </button>
  );
}
