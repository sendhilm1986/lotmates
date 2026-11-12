import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import StatusBadge from '@/components/StatusBadge';
import DealProgress from '@/components/DealProgress';
import PriceStory from '@/components/PriceStory';
import { TourLauncher } from '@/components/GuidedTour';
import RatingStars from '@/components/RatingStars';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import BookingDialog from './BookingDialog';
import { DEAL_FIELDS, DEAL_STYLES, dealState, inr, isOpen, categoryLabel, timeLeft, allowsRepeat, dealSchedule, dealFulfilment } from '@/services/dealRules';
import { useMyBookings, forgetMyBookings } from '@/services/myBookings';
import DealGallery from '@/components/DealGallery';
import { REVIEW_FIELDS, unwrapList } from '@/services/records';

export const route = { path: '/deals/:id', layout: 'public', access: 'public' };

const { eq } = window.ApperSDK.CoreSDK;

function Detail({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

export default function DealPage() {
  const { id } = useParams();
  const { isAuthenticated, profile } = useProfile();
  const [bookOpen, setBookOpen] = useState(false);
  const myBookings = useMyBookings();

  const { data: deal, loading, error, run } = useFetch(() => {
    return sdk.table('deals_c').select(DEAL_FIELDS).get(id).then((r) => r.data);
  }, [id]);

  const vendorId = deal?.vendor_c?.Id;
  const { data: vendor } = useFetch(() => {
    if (!vendorId) return Promise.resolve(null);
    return sdk
      .table('vendors_c')
      .select(['Name', 'rating_c', 'jobsDone_c', 'status_c', 'checks_c'])
      .get(vendorId)
      .then((r) => r.data);
  }, [vendorId]);

  const { data: reviews } = useFetch(() => {
    if (!vendorId) return Promise.resolve([]);
    return sdk.table('reviews_c').select(REVIEW_FIELDS).where(eq('vendor_c', vendorId)).page(1, 50).fetch().then(unwrapList);
  }, [vendorId]);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-3">
      <Link to="/deals">
        <ApperIcon name="ArrowLeft" size={16} />
        Back to Deals
      </Link>
    </Button>
  );

  if (loading && deal === undefined) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-8">
        {back}
        <DetailSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-8">
        {back}
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load this deal: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-8">
        {back}
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="font-medium text-foreground">This deal isn't available</p>
          <p className="text-sm text-muted-foreground">It may still be a draft, or the link is wrong.</p>
        </div>
      </div>
    );
  }

  const st = dealState(deal);
  const open = isOpen(deal);
  const isAdmin = profile === 'Admin_c';
  const where = deal.community_c?.Name ?? `All communities in ${deal.locality_c?.Name ?? 'the locality'}`;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `${deal.Name}: ${st.booked} neighbours booked, price now ${inr(st.current?.price)}. Join before it closes: ${shareUrl}`;
  const lines = (deal.description_c ?? '').split('\n').filter(Boolean);
  const reviewList = reviews ?? [];
  const avg = reviewList.length
    ? reviewList.reduce((s, r) => s + Number(r.rating_c || 0), 0) / reviewList.length
    : Number(vendor?.rating_c || 0);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy. Long-press the address bar to copy the link.');
    }
  }

  // This neighbour's own bookings on this deal.
  const mine = myBookings.filter((b) => String(b.deal_c?.Id) === String(deal.Id));
  const repeat = allowsRepeat(deal);
  const myHomes = mine.reduce((n, b) => n + Number(b.homes_c || 1), 0);
  const myPaid = mine.reduce((n, b) => n + Number(b.amountPaid_c || 0), 0);
  const myBack = mine.reduce((n, b) => {
    if (b.status_c === 'Booked') return n + Math.max(0, (Number(b.unitPrice_c || 0) - Number(st.current?.price ?? b.unitPrice_c)) * Number(b.homes_c || 1));
    return n + Number(b.refundDue_c || 0);
  }, 0);
  const myRefunded = mine.length > 0 && mine.every((b) => b.status_c !== 'Booked' && b.refundStatus_c === 'Paid');
  const myLink = mine.length === 1 ? `/bookings/${mine[0].Id}` : '/bookings';
  const unitWord = (deal.unit_c || 'per home').replace(/^per\s+/, '');
  const plural = (n, w) => `${n} ${w}${n === 1 || /s$/.test(w) ? '' : 's'}`;

  let cta;
  if (mine.length) {
    cta = { to: myLink, label: mine.length === 1 ? 'View your booking' : 'View your bookings' };
  } else if (!open) {
    cta = {
      note: deal.status_c === 'Failed' ? 'This deal did not unlock. Everyone got a full refund.' : 'Bookings for this round are closed.',
      to: '/deals',
      label: 'See live deals',
      variant: 'outline',
    };
  } else if (st.full) {
    cta = { note: 'Every slot in this round is booked.', to: '/deals', label: 'See live deals', variant: 'outline' };
  } else if (!isAuthenticated) {
    cta = { to: `/customer/login?redirect=${encodeURIComponent(`/deals/${deal.Id}`)}`, label: 'Sign in to book' };
  } else if (isAdmin) {
    cta = { note: "You're signed in as the Lotmates team.", to: `/admin/deals/${deal.Id}`, label: 'Manage this deal', variant: 'outline' };
  } else if (!['Customer_c', 'Ambassador_c'].includes(profile)) {
    cta = { note: 'Booking is for neighbours. Use a neighbour account to book.', to: '/deals', label: 'See live deals', variant: 'outline' };
  } else {
    cta = { onClick: () => setBookOpen(true), label: `Book and pay ${inr(st.tier1?.price)}` };
  }

  const canBookMore = mine.length > 0 && repeat && open && !st.full && ['Customer_c', 'Ambassador_c'].includes(profile);

  const myBox = mine.length ? (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <span className="flex size-6 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ApperIcon name="Check" size={14} />
        </span>
        You're in
      </p>
      <p className="mt-2 text-sm text-foreground">
        {plural(myHomes, unitWord)}
        {mine.length === 1 ? `, ${mine[0].Name}` : `, ${mine.length} bookings`}
      </p>
      <p className="text-sm text-muted-foreground">Paid {inr(myPaid)}</p>
      <p className="mt-2 text-sm font-medium text-primary">
        {myRefunded
          ? `${inr(myBack)} refunded to you`
          : myBack > 0
            ? `${inr(myBack)} coming back to you so far`
            : 'Your refund grows as neighbours join'}
      </p>
    </div>
  ) : null;

  const bookMore = canBookMore ? (
    <Button variant="outline" className="w-full" onClick={() => setBookOpen(true)}>
      <ApperIcon name="Plus" size={16} />
      Book more
    </Button>
  ) : null;

  const ctaButton = (className) =>
    cta.onClick ? (
      <Button size="lg" className={className} onClick={cta.onClick} data-tour="book">
        {cta.label}
      </Button>
    ) : (
      <Button size="lg" variant={cta.variant ?? 'default'} className={className} asChild>
        <Link to={cta.to} data-tour="book">{cta.label}</Link>
      </Button>
    );

  const moneyNote = open ? (
    st.refundPerUnit > 0 ? (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-2">
        <span className="whitespace-nowrap rounded-md bg-highlight px-1.5 py-0.5 font-semibold text-highlight-foreground">{inr(st.refundPerUnit)} back to you</span>
        <span className="whitespace-nowrap">at close</span>
      </span>
    ) : (
      'Your refund grows as neighbours join'
    )
  ) : null;

  const barNote = open && st.refundPerUnit > 0 ? (
    <span className="flex flex-col items-start gap-1">
      <span className="rounded-md bg-highlight px-1.5 py-0.5 font-semibold text-highlight-foreground">{inr(st.refundPerUnit)} back</span>
      <span className="leading-5">to you at close</span>
    </span>
  ) : (
    moneyNote
  );

  const priceBlock = (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Price now {deal.unit_c}</p>
        <p className="mt-1.5 font-heading text-5xl font-bold leading-none tabular-nums text-foreground">{inr(st.current?.price)}</p>
        {deal.regularPrice_c ? (
          <p className="mt-3 flex items-center justify-center gap-2.5">
            <span className="text-sm text-muted-foreground line-through">{inr(deal.regularPrice_c)}</span>
            {st.savingPct > 0 && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{st.savingPct}% less than usual</span>}
          </p>
        ) : null}
      </div>
      <div data-tour="deal-meter" className="border-t border-border pt-2">
        <DealProgress deal={deal} size="lg" />
      </div>
      {open && (
        <div data-tour="price-story">
          <PriceStory st={st} />
        </div>
      )}
    </div>
  );

  const share = (
    <div className="flex gap-2" data-tour="share">
      <Button variant="outline" className="h-11 flex-1" asChild>
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
          <ApperIcon name="MessageCircle" size={16} />
          Share on WhatsApp
        </a>
      </Button>
      <Button variant="outline" size="icon" className="size-11 flex-none" onClick={copyLink} aria-label="Copy link">
        <ApperIcon name="Link" size={16} />
      </Button>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-32 pt-4 md:px-8 lg:pb-16">
      <TourLauncher id="deal" />
      {back}
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
        <div className="min-w-0 space-y-8">
          <div className="space-y-4">
            <DealGallery deal={deal}>
              {deal.status_c !== 'Live' && (
                <span className="pointer-events-none absolute left-3 top-3">
                  <StatusBadge value={deal.status_c} styles={DEAL_STYLES} />
                </span>
              )}
            </DealGallery>
            <div>
              <p className="text-sm text-muted-foreground">
                {categoryLabel(deal.category_c)}, round {deal.round_c ?? 1}
              </p>
              <h1 className="mt-1 font-heading text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">{deal.Name}</h1>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <ApperIcon name="MapPin" size={14} className="flex-none" />
                {deal.locality_c?.Id ? (
                  <Link to={`/areas/${deal.locality_c.Id}`} className="hover:text-primary hover:underline">{where}</Link>
                ) : (
                  where
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 border-y border-border py-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                <ApperIcon name="Store" size={18} />
              </span>
              <div className="min-w-0 flex-1">
                {deal.vendor_c?.Id ? (
                  <Link to={`/partners/${deal.vendor_c.Id}`} className="block truncate font-semibold text-foreground hover:text-primary">
                    {deal.vendor_c.Name}
                  </Link>
                ) : (
                  <p className="font-semibold text-foreground">Vendor to be confirmed</p>
                )}
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  {avg ? (
                    <>
                      <RatingStars value={avg} size={13} />
                      <span className="tabular-nums">{avg.toFixed(1)}</span>
                    </>
                  ) : (
                    'New on Lotmates'
                  )}
                  {reviewList.length ? <span>{reviewList.length} reviews</span> : null}
                  {vendor?.jobsDone_c ? <span>{vendor.jobsDone_c} jobs</span> : null}
                </p>
              </div>
              {vendor?.status_c === 'Active' && (
                <span className="inline-flex flex-none items-center gap-1 text-sm font-medium text-success">
                  <ApperIcon name="BadgeCheck" size={16} />
                  Checked
                </span>
              )}
            </div>
          </div>

          <p className="-mt-4 text-sm text-muted-foreground">
            Provided by {deal.vendor_c?.Name ?? 'the vendor named above'}, an independent business. Lotmates runs the booking, payment and refunds.
          </p>

          <div className="space-y-4 lg:hidden">
            {priceBlock}
            {myBox}
            {bookMore}
          </div>

          <section>
            <h2 className="font-heading text-xl font-bold text-foreground">What's included</h2>
            <ul className="mt-3 space-y-2">
              {lines.length ? (
                lines.map((l) => (
                  <li key={l} className="flex gap-2 text-foreground">
                    <ApperIcon name="Check" size={18} className="mt-0.5 flex-none text-primary" />
                    <span>{l}</span>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">Details coming soon.</li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold text-foreground">Dates and rules</h2>
            <dl className="mt-2 divide-y divide-border">
              <Detail label="Bookings close">
                {deal.deadline_c ? formatLocalDate(deal.deadline_c, DATE_FORMATS.SHORT) : '—'}
                {open ? <span className="block text-xs font-normal text-muted-foreground">{timeLeft(deal.deadline_c)}</span> : null}
              </Detail>
              <Detail label={dealFulfilment(deal) === 'delivery' ? 'Delivery window' : 'Service window'}>
                {deal.serviceStart_c ? formatLocalDate(deal.serviceStart_c, DATE_FORMATS.SHORT) : '—'}
                {' to '}
                {deal.serviceEnd_c ? formatLocalDate(deal.serviceEnd_c, DATE_FORMATS.SHORT) : '—'}
              </Detail>
              <Detail label="Timing">
                {{
                  none: dealFulfilment(deal) === 'delivery' ? 'The vendor calls before delivering' : 'The vendor calls to fix a time',
                  date: 'You pick a day when you book',
                  datetime: 'You pick a day and a time when you book',
                }[dealSchedule(deal)]}
              </Detail>
              <Detail label="Unlocks at">{st.min} bookings</Detail>
              {st.cap ? <Detail label="Places this round">{st.cap}</Detail> : null}
              {isAdmin && <Detail label="Commission (team only)">{deal.commission_c ?? 0}%, paid by the vendor</Detail>}
            </dl>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold text-foreground">How refunds work</h2>
            <ul className="mt-3 space-y-2 text-sm text-foreground">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                Everyone pays the first price, {inr(st.tier1?.price)}, whenever they book.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                When the deal closes, you get back the difference to the final price, once, to the card or UPI you paid with.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                If fewer than {st.min} book by the deadline, everyone gets all of it back.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-primary" />
                A price reached stays reached, even if someone cancels. Cancel free with a full refund until the deal closes.
              </li>
            </ul>
            <Link to="/legal/refunds" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
              Read the full refund and cancellation policy
            </Link>
          </section>

          <div className="lg:hidden">{share}</div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-[24px] bg-card p-7 shadow-md">
            {priceBlock}
            {myBox ? <div className="mt-5">{myBox}</div> : null}
            <div className="mt-6 space-y-3">
              {cta.note && <p className="text-center text-sm text-muted-foreground">{cta.note}</p>}
              {ctaButton('w-full')}
              {bookMore}
              {share}
            </div>
            <p className="mt-6 text-balance border-t border-border pt-5 text-center text-xs leading-5 text-muted-foreground">
              <ApperIcon name="ShieldCheck" size={14} className="-mt-0.5 mr-1 inline-block align-middle text-primary" />
              Paid through Razorpay. Cancel free with a full refund until the deal closes.{' '}
              <Link to="/legal/refunds" className="font-medium text-primary underline-offset-2 hover:underline">Refund policy</Link>
            </p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-border bg-background/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <p className="min-w-0 flex-1 text-xs leading-6 text-muted-foreground">{cta.note ?? (mine.length ? `You're in: ${plural(myHomes, unitWord)}` : barNote)}</p>
          {ctaButton('flex-none')}
        </div>
      </div>

      <BookingDialog open={bookOpen} onOpenChange={setBookOpen} deal={deal} onBooked={() => {
          forgetMyBookings();
          run();
        }} />
    </div>
  );
}
