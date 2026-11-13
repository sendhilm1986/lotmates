import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useFunction } from '@/hooks/useFunction';
import { useProfile } from '@/hooks/useProfile';
import { formatLocalDate, formatRelativeTime, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import StatusBadge from '@/components/StatusBadge';
import DealProgress from '@/components/DealProgress';
import RatingStars from '@/components/RatingStars';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BOOKING_STATUS, BOOKING_STYLES, REFUND_STATUS, REFUND_STYLES, DEAL_FIELDS, dealState, inr, isOpen, dealSchedule, dealFulfilment, bookingMode, dealSlots, scheduleLine, shareMessage } from '@/services/dealRules';
import { JOB_FIELDS, REVIEW_FIELDS, COMPLAINT_FIELDS, COMPLAINT_STYLES, userIdOf, sameId, unwrapList } from '@/services/records';
import { isGatewayPayment, toPaise } from '@/services/razorpay';
import { forgetMyBookings } from '@/services/myBookings';
import ReviewDialog from '@/pages/Reviews/ReviewDialog';
import ComplaintDialog from '@/pages/Complaints/ComplaintDialog';

export const route = { path: '/bookings/:id', layout: 'owner', access: "['Admin_c','Customer_c','Ambassador_c'].includes(profile)" };

const { eq } = window.ApperSDK.CoreSDK;

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const user = useSelector((s) => s.user.user);
  const isAdmin = profile === 'Admin_c';
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({});

  const { invoke: cancelBooking } = useFunction('cancel-booking');

  const { data: booking, loading, error, run } = useFetch(() => {
    return sdk.table('bookings_c').select(JOB_FIELDS).get(id).then((r) => r.data);
  }, [id]);

  const dealId = booking?.deal_c?.Id;
  const { data: deal, run: refetchDeal } = useFetch(() => {
    if (!dealId) return Promise.resolve(null);
    return sdk.table('deals_c').select(DEAL_FIELDS).get(dealId).then((r) => r.data);
  }, [dealId]);

  const { data: reviews, run: refetchReviews } = useFetch(() => {
    return sdk.table('reviews_c').select(REVIEW_FIELDS).where(eq('booking_c', id)).fetch().then(unwrapList);
  }, [id]);

  const { data: complaints, run: refetchComplaints } = useFetch(() => {
    return sdk.table('complaints_c').select(COMPLAINT_FIELDS).where(eq('booking_c', id)).fetch().then(unwrapList);
  }, [id]);

  useEffect(() => {
    if (!booking || !deal || booking.status_c !== 'Booked' || !sameId(booking.Owner?.Id, userIdOf(user))) return;
    const s = dealState(deal);
    const key = `lotmates.seenTier.${booking.Id}`;
    let seen = 1;
    try {
      seen = Number(window.localStorage.getItem(key) || 1);
    } catch {
      /* first time on this device */
    }
    if (s.reached > seen) {
      const back = Math.max(0, (Number(booking.unitPrice_c || 0) - (s.current?.price ?? 0)) * Number(booking.homes_c || 1));
      toast.success(`The price dropped to ${inr(s.current?.price)}.${back > 0 ? ` ${inr(back)} is coming back to you.` : ''}`);
    }
    try {
      window.localStorage.setItem(key, String(Math.max(seen, s.reached)));
    } catch {
      /* not remembered, so it may show again */
    }
  }, [booking, deal]);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link to="/bookings">
        <ApperIcon name="ArrowLeft" size={16} />
        Back to Bookings
      </Link>
    </Button>
  );

  if (loading && booking === undefined) {
    return (
      <div className="space-y-4">
        {back}
        <DetailSkeleton />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load this booking: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!booking) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-[22px] bg-card shadow-sm p-8 text-center text-muted-foreground">
          Booking not found. It may have been removed.
        </div>
      </div>
    );
  }

  const mine = sameId(booking.Owner?.Id, userIdOf(user));
  const st = deal ? dealState(deal) : null;
  const dealOpen = deal ? isOpen(deal) : false;
  const soFar =
    st && booking.status_c === 'Booked'
      ? Math.max(0, (Number(booking.unitPrice_c || 0) - (st.current?.price ?? 0)) * Number(booking.homes_c || 1))
      : 0;
  const canCancel = booking.status_c === 'Booked' && dealOpen;
  const gateway = isGatewayPayment(booking.paymentRef_c);
  const myReview = (reviews ?? []).find((r) => sameId(r.Owner?.Id, userIdOf(user)));
  const photos = Array.isArray(booking.jobPhotos_c) ? booking.jobPhotos_c : [];

  const steps = [
    { label: 'Booked and paid', done: true, note: formatRelativeTime(booking.CreatedOn) },
    {
      label: booking.status_c === 'Failed' ? 'Deal did not unlock' : booking.status_c === 'Cancelled' ? 'Cancelled' : 'Deal closed',
      done: ['Confirmed', 'Failed', 'Done', 'Cancelled'].includes(booking.status_c),
      note: deal?.deadline_c ? `Closes ${formatLocalDate(deal.deadline_c, DATE_FORMATS.SHORT)}` : '',
    },
    {
      label:
        booking.refundStatus_c === 'Paid'
          ? `Refund of ${inr(booking.refundDue_c)} paid`
          : booking.refundStatus_c === 'Due'
            ? `Refund of ${inr(booking.refundDue_c)} on its way`
            : 'Refund settled at close',
      done: booking.refundStatus_c === 'Paid',
      note: '',
    },
    {
      label: deal && bookingMode(deal, booking) === 'delivery' ? 'Delivered' : deal && bookingMode(deal, booking) === 'pickup' ? 'Collected' : 'Service done',
      done: booking.status_c === 'Done',
      note: booking.doneOn_c
        ? formatLocalDate(booking.doneOn_c, DATE_FORMATS.SHORT)
        : booking.preferredDate_c
          ? `Planned ${formatLocalDate(booking.preferredDate_c, DATE_FORMATS.SHORT)}${booking.preferredSlot_c ? `, ${booking.preferredSlot_c.split(',')[0].toLowerCase()}` : ''}`
          : '',
    },
  ];

  function openEdit() {
    setForm({
      preferredDate_c: booking.preferredDate_c ?? '',
      preferredSlot_c: booking.preferredSlot_c ?? '',
      address_c: booking.address_c ?? '',
      phone_c: booking.phone_c ?? '',
      notes_c: booking.notes_c ?? '',
      status_c: booking.status_c,
      refundStatus_c: booking.refundStatus_c,
    });
    setEditOpen(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!form.address_c?.trim()) {
      toast.error('Address is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        Id: booking.Id,
        ...(deal && dealSchedule(deal) !== 'none' ? { preferredDate_c: form.preferredDate_c || null } : {}),
        ...(deal && dealSchedule(deal) === 'datetime' ? { preferredSlot_c: form.preferredDate_c ? form.preferredSlot_c || null : null } : {}),
        address_c: form.address_c.trim(),
        phone_c: form.phone_c.trim(),
        notes_c: form.notes_c?.trim() || null,
      };
      if (isAdmin) {
        payload.status_c = form.status_c;
        payload.refundStatus_c = form.refundStatus_c;
        if (form.refundStatus_c === 'Paid' && ['Failed', 'Cancelled'].includes(form.status_c)) payload.paymentStatus_c = 'Refunded';
      }
      const res = await sdk.table('bookings_c').update(payload);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) return;
      toast.success('Booking updated');
      setEditOpen(false);
      run();
    } finally {
      setSaving(false);
    }
  }

  async function confirmCancel() {
    setCancelling(true);
    try {
      const r = await cancelBooking({ bookingId: booking.Id });
      if (!r) return;
      const refunded = Boolean(r?.data?.refunded);
      toast.success(refunded ? `Cancelled. ${inr(booking.amountPaid_c)} refunded through Razorpay.` : `Cancelled. ${inr(booking.amountPaid_c)} will be refunded.`);
      setCancelOpen(false);
      forgetMyBookings();
      run();
      refetchDeal();
    } finally {
      setCancelling(false);
    }
  }


  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await sdk.table('bookings_c').remove(booking.Id);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length && res.success === false) return;
      toast.success(`Deleted booking ${booking.Name}`);
      setDeleteOpen(false);
      navigate('/bookings');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {back}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Booking {booking.Name}</p>
        <h1 className="font-heading text-2xl font-extrabold leading-tight tracking-tight text-foreground md:text-3xl">{booking.deal_c?.Name}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <StatusBadge value={booking.status_c} styles={BOOKING_STYLES} label={isAdmin ? undefined : booking.status_c === 'Failed' ? "Deal didn't go ahead" : booking.status_c === 'Cancelled' ? 'You cancelled' : undefined} />
          {booking.refundStatus_c !== 'None' && (
            <StatusBadge
              value={`Refund ${booking.refundStatus_c.toLowerCase()}`}
              styles={{ [`Refund ${booking.refundStatus_c.toLowerCase()}`]: REFUND_STYLES[booking.refundStatus_c] }}
            />
          )}
          {booking.deal_c?.Id && <Link to={`/deals/${booking.deal_c.Id}`} className="font-medium text-primary hover:underline">Deal page</Link>}
          {deal?.vendor_c?.Id && <Link to={`/partners/${deal.vendor_c.Id}`} className="font-medium text-primary hover:underline">{deal.vendor_c.Name}</Link>}
          {deal?.locality_c?.Id && <Link to={`/areas/${deal.locality_c.Id}`} className="font-medium text-primary hover:underline">{deal.locality_c.Name}</Link>}
        </div>
        <div className="flex flex-wrap gap-2">
          {booking.status_c === 'Done' && mine && !myReview && (
            <Button onClick={() => setReviewOpen(true)}>
              <ApperIcon name="Star" size={16} />
              Rate this job
            </Button>
          )}
          {(mine || isAdmin) && (
            <Button variant="outline" onClick={openEdit}>
              <ApperIcon name="Pencil" size={16} />
              Edit
            </Button>
          )}
          {canCancel && (mine || isAdmin) && (
            <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setCancelOpen(true)}>
              <ApperIcon name="XCircle" size={16} />
              Cancel booking
            </Button>
          )}
          {mine && (
            <Button variant="ghost" onClick={() => setComplaintOpen(true)}>
              <ApperIcon name="MessageSquareWarning" size={16} />
              Report a problem
            </Button>
          )}
          {isAdmin && (
            <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <ApperIcon name="Trash2" size={16} />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-[22px] bg-card shadow-sm p-5">
            <h2 className="font-heading text-lg font-bold text-foreground">Where it stands</h2>
            <ol className="mt-4 space-y-4">
              {steps.map((s, i) => (
                <li key={s.label} className="flex gap-3">
                  <span
                    className={cn(
                      'flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-semibold',
                      s.done ? 'bg-primary text-primary-foreground' : 'border border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {s.done ? <ApperIcon name="Check" size={14} /> : i + 1}
                  </span>
                  <div>
                    <p className={cn('font-medium', s.done ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</p>
                    {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {deal && booking.status_c === 'Booked' && (
            <section className="space-y-4 rounded-[22px] bg-card shadow-sm p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-lg font-bold text-foreground">Deal right now</h2>
                <span className="text-sm text-muted-foreground">Tier {st?.reached}, {inr(st?.current?.price)}</span>
              </div>
              <DealProgress deal={deal} size="lg" />
              {soFar > 0 ? (
                <div className="flex items-center justify-between rounded-full bg-highlight px-4 py-2 font-semibold text-highlight-foreground">
                  <span>Coming back to you so far</span>
                  <span className="tabular-nums">{inr(soFar)}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Share the deal: the next tier puts money back in your pocket.</p>
              )}
              {mine && (st.next || (!st.unlocked && st.toMin > 0)) && (
                <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
                  <p className="font-heading text-lg font-bold leading-snug">
                    {!st.unlocked && st.toMin > 0
                      ? `${st.toMin} more ${st.toMin === 1 ? 'neighbour' : 'neighbours'} and this goes ahead`
                      : `${st.toNext} more ${st.toNext === 1 ? 'neighbour' : 'neighbours'} = ${inr(Math.max(0, (Number(st.current?.price || 0) - Number(st.next?.price || 0)) * Number(booking.homes_c || 1)))} more back to you`}
                  </p>
                  <Button asChild variant="secondary" className="mt-3 h-12 w-full rounded-full">
                    <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage(deal, st, `${window.location.origin}/deals/${deal.Id}`))}`} target="_blank" rel="noreferrer">
                      <ApperIcon name="MessageCircle" size={18} />
                      Ask your building group on WhatsApp
                    </a>
                  </Button>
                </div>
              )}
            </section>
          )}

          {booking.status_c === 'Done' && (booking.jobNote_c || photos.length > 0) && (
            <section className="space-y-3 rounded-[22px] bg-card shadow-sm p-5">
              <h2 className="font-heading text-lg font-bold text-foreground">From the vendor</h2>
              {booking.jobNote_c && <p className="whitespace-pre-line text-sm text-foreground">{booking.jobNote_c}</p>}
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((f, i) => (
                    <a key={f.Id ?? f.id ?? i} href={f.url ?? '#'} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                      {f.url ? <img src={f.url} alt={f.name ?? 'Job photo'} className="h-full w-full object-cover" /> : null}
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}

          {((reviews ?? []).length > 0 || (complaints ?? []).length > 0) && (
            <section className="space-y-3">
              <h2 className="font-heading text-lg font-bold text-foreground">Feedback</h2>
              <ul className="divide-y divide-border rounded-[22px] bg-card shadow-sm">
                {(reviews ?? []).map((r) => (
                  <li key={r.Id} className="p-4">
                    <Link to={`/reviews/${r.Id}`} className="block space-y-1">
                      <RatingStars value={r.rating_c} size={14} />
                      <p className="font-medium text-foreground">{r.Name}</p>
                    </Link>
                  </li>
                ))}
                {(complaints ?? []).map((c) => (
                  <li key={c.Id} className="flex items-center justify-between gap-3 p-4">
                    <Link to={`/complaints/${c.Id}`} className="min-w-0 font-medium text-foreground hover:text-primary">{c.Name}</Link>
                    <StatusBadge value={c.status_c} styles={COMPLAINT_STYLES} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-[22px] bg-card shadow-sm px-5 pt-4">
            <h2 className="font-heading text-lg font-bold text-foreground">Service details</h2>
            <div className="divide-y divide-border">
              {isAdmin && <Row label="Neighbour">{booking.Owner?.Name ?? '—'}</Row>}
              <Row label="Area">{[booking.community_c?.Name, booking.locality_c?.Name].filter(Boolean).join(', ') || '—'}</Row>
              <Row label="Quantity">{booking.homes_c ?? 1}</Row>
              <Row label="When">{deal ? scheduleLine(booking, deal) : '—'}</Row>
              {deal && bookingMode(deal, booking) === 'pickup' ? (
                <Row label="Collect from">{deal.pickupAddress_c || 'The vendor will tell you where'}</Row>
              ) : (
                <Row label="Address">{booking.address_c ?? '—'}</Row>
              )}
              <Row label="Phone">{booking.phone_c ?? '—'}</Row>
              <Row label="Notes">{booking.notes_c ?? '—'}</Row>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[22px] bg-card shadow-sm px-5 pt-4 pb-4">
            <h2 className="font-heading text-lg font-bold text-foreground">Money</h2>
            <div className="divide-y divide-border">
              <Row label="Paid at the first price">{booking.homes_c ?? 1} × {inr(booking.unitPrice_c)}</Row>
              <Row label="Amount paid">{inr(booking.amountPaid_c)}</Row>
              <Row label="Final price">{booking.finalPrice_c ? `${inr(booking.finalPrice_c)} each` : 'Set when the deal closes'}</Row>
              <Row label="Refund">
                {booking.refundStatus_c === 'None' ? (soFar > 0 ? `${inr(soFar)} so far` : '—') : `${inr(booking.refundDue_c)}, ${booking.refundStatus_c.toLowerCase()}`}
              </Row>
              <Row label="Payment">{booking.paymentStatus_c ?? '—'}</Row>
              <Row label="Reference">
                <span className="break-all text-xs">{booking.paymentRef_c ?? '—'}</span>
              </Row>
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <ApperIcon name="Info" size={14} className="mt-0.5 flex-none" />
              {gateway
                ? 'Paid through Razorpay test mode. Refunds go back to the same card or UPI ID.'
                : 'Demo payment: no money moved. Refunds go back to the original payment method in the live app.'}
            </p>
          </section>

          {(mine || isAdmin) && (
            <InvoiceCard booking={booking} isAdmin={isAdmin} onSent={run} />
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Edit booking {booking.Name}</DialogTitle>
            <DialogDescription>Change when and where the service happens.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="grid gap-4">
            {deal && dealSchedule(deal) !== 'none' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="ed-date">{bookingMode(deal, booking) === 'delivery' ? 'Delivery date' : bookingMode(deal, booking) === 'pickup' ? 'Pickup date' : 'Preferred date'}</Label>
                  <Input
                    id="ed-date"
                    type="date"
                    min={deal?.serviceStart_c ?? undefined}
                    max={deal?.serviceEnd_c ?? undefined}
                    value={form.preferredDate_c ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, preferredDate_c: e.target.value }))}
                    autoFocus
                    className="h-11"
                  />
                </div>
                {dealSchedule(deal) === 'datetime' && (
                  <div className="grid gap-1.5">
                    <Label>Time</Label>
                    <Select value={form.preferredSlot_c || undefined} onValueChange={(v) => setForm((f) => ({ ...f, preferredSlot_c: v }))}>
                      <SelectTrigger aria-label="Time" className="h-11"><SelectValue placeholder="Pick a time" /></SelectTrigger>
                      <SelectContent>
                        {dealSlots(deal).map((sl) => (
                          <SelectItem key={sl} value={sl}>{sl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="ed-address">Address</Label>
              <Input id="ed-address" value={form.address_c ?? ''} onChange={(e) => setForm((f) => ({ ...f, address_c: e.target.value }))} placeholder="Flat or house number, community name" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ed-phone">Phone</Label>
              <Input id="ed-phone" type="tel" value={form.phone_c ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone_c: e.target.value }))} placeholder="+91 98765 43210" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ed-notes">Notes for the vendor</Label>
              <Textarea id="ed-notes" rows={2} value={form.notes_c ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes_c: e.target.value }))} placeholder="e.g. Please call before coming" />
            </div>
            {isAdmin && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select value={form.status_c} onValueChange={(v) => setForm((f) => ({ ...f, status_c: v }))}>
                    <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BOOKING_STATUS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Refund status</Label>
                  <Select value={form.refundStatus_c} onValueChange={(v) => setForm((f) => ({ ...f, refundStatus_c: v }))}>
                    <SelectTrigger aria-label="Refund status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REFUND_STATUS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <ApperIcon name="LoaderCircle" size={16} className="animate-spin" />
                    Saving…
                  </>
                ) : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking {booking.Name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You get the full {inr(booking.amountPaid_c)} back{gateway ? ' through Razorpay' : ''}. The price your neighbours unlocked stays the same.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmCancel();
              }}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling…' : 'Cancel and refund'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete booking {booking.Name}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the record completely. Use Cancel instead if the neighbour should be refunded.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete booking'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        record={null}
        context={{ bookingId: booking.Id, dealId: booking.deal_c?.Id, vendorId: deal?.vendor_c?.Id }}
        onSaved={refetchReviews}
      />
      <ComplaintDialog open={complaintOpen} onOpenChange={setComplaintOpen} record={null} booking={booking} onSaved={refetchComplaints} />
    </div>
  );
}

function InvoiceCard({ booking, isAdmin, onSent }) {
  const [busy, setBusy] = useState('');
  const ready = ['Confirmed', 'Done'].includes(booking.status_c) && booking.paymentStatus_c !== 'Pending';

  async function download() {
    setBusy('download');
    const r = await sdk.invoices.download(booking.Id);
    setBusy('');
    if (!r.ok) toast.error(r.error.message);
  }

  async function send() {
    setBusy('send');
    const r = await sdk.invoices.send(booking.Id);
    setBusy('');
    if (!r.ok) return toast.error(r.error.message);
    toast.success(`Invoice ${r.value?.invoiceNo ?? ''} emailed to ${r.value?.to ?? 'the neighbour'}`);
    onSent?.();
  }

  return (
    <section className="rounded-[22px] bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">Invoice</h2>
          {ready ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {booking.invoiceNo_c ? <span className="font-medium text-foreground">{booking.invoiceNo_c}</span> : 'Ready to download'}
              {booking.invoicedOn_c ? `, emailed ${formatRelativeTime(booking.invoicedOn_c)}` : isAdmin ? ', not emailed yet' : ''}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin ? 'Available once the deal closes and this booking is confirmed.' : "We'll email your invoice when the deal closes and your booking is confirmed."}
            </p>
          )}
        </div>
        <ApperIcon name="FileText" size={20} className="mt-1 flex-none text-muted-foreground" />
      </div>
      {ready && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={download} disabled={busy === 'download'} className="h-11 rounded-full px-5">
            <ApperIcon name={busy === 'download' ? 'LoaderCircle' : 'Download'} size={16} className={busy === 'download' ? 'animate-spin' : ''} />
            Download PDF
          </Button>
          {isAdmin && (
            <Button onClick={send} disabled={busy === 'send'} className="h-11 rounded-full px-5">
              <ApperIcon name={busy === 'send' ? 'LoaderCircle' : 'Send'} size={16} className={busy === 'send' ? 'animate-spin' : ''} />
              {booking.invoicedOn_c ? 'Resend invoice' : 'Email invoice'}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
