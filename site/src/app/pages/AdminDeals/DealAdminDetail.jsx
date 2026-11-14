import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useFunction } from '@/hooks/useFunction';
import { isGatewayPayment, toPaise } from '@/services/razorpay';
import PayoutDialog from '@/pages/Payouts/PayoutDialog';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import StatusBadge from '@/components/StatusBadge';
import DealProgress from '@/components/DealProgress';
import DealReviewPanel from '@/components/DealReviewPanel';
import { DetailSkeleton, ListSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import {
  DEAL_FIELDS,
  BOOKING_FIELDS,
  DEAL_STYLES,
  BOOKING_STYLES,
  REFUND_STYLES,
  dealState,
  inr,
  planClose,
  dealStatusLabel,
  categoryLabel,
  timeLeft,
} from '@/services/dealRules';

export const route = { path: '/admin/deals/:id', layout: 'owner', access: "profile === 'Admin_c'" };

const { eq } = window.ApperSDK.CoreSDK;

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums text-foreground">{children}</dd>
    </div>
  );
}

export default function DealAdminDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const { invoke: closeDealFn } = useFunction('close-deal');
  const { invoke: sendRefunds } = useFunction('send-refunds');

  const { data: deal, loading, error, run } = useFetch(() => {
    return sdk
      .table('deals_c')
      .select(DEAL_FIELDS)
      .get(id)
      .then((r) => r.data);
  }, [id]);

  const { data: bookings, loading: bLoading, run: refetchBookings } = useFetch(() => {
    return sdk
      .table('bookings_c')
      .select(BOOKING_FIELDS)
      .where(eq('deal_c', id))
      .orderByDesc('CreatedOn')
      .page(1, 100)
      .fetch()
      .then((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      });
  }, [id]);

  const back = (
    <Link to="/admin/deals" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
      <ApperIcon name="ChevronLeft" size={16} />
      Deals
    </Link>
  );

  if (loading && deal === undefined) {
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
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load this deal: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!deal) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-[22px] bg-card shadow-sm p-10 text-center text-muted-foreground">Deal not found.</div>
      </div>
    );
  }

  const st = dealState(deal);
  const rows = bookings ?? [];
  const plan = planClose(deal, rows);
  const dueRows = rows.filter((b) => b.refundStatus_c === 'Due');
  const dueTotal = dueRows.reduce((s, b) => s + Number(b.refundDue_c || 0), 0);
  const activeBookings = rows.filter((b) => b.status_c !== 'Cancelled');
  const rate = Number(deal.commission_c || 0) / 100;
  // Earned only once the deal has gone ahead: confirmed bookings at their final price.
  const settled = ['Closed', 'Failed'].includes(deal.status_c);
  const commission = settled
    ? rows.filter((b) => ['Confirmed', 'Done'].includes(b.status_c)).reduce((s, b) => s + Number(b.finalPrice_c || 0) * Number(b.homes_c || 1), 0) * rate
    : (st.current?.price ?? 0) * st.booked * rate;

  async function publish() {
    if (!deal.deadline_c || new Date(deal.deadline_c).getTime() <= Date.now()) {
      toast.error('Set a closing time in the future before publishing.');
      return;
    }
    setBusy('publish');
    try {
      const res = await sdk.table('deals_c').update({ Id: deal.Id, status_c: 'Live' });
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) return;
      toast.success('Deal is live. Share the link in the community group.');
      run();
    } finally {
      setBusy('');
    }
  }

  async function closeDeal() {
    setBusy('close');
    try {
      const r = await closeDealFn({ dealId: deal.Id });
      const res = r?.data;
      if (!res) return;
      toast.success(
        res.unlocked
          ? `Closed at ${inr(res.finalPrice)}. ${inr(res.totalRefund)} in refunds, ${res.refundsSent} sent through Razorpay.`
          : `Deal did not unlock. ${inr(res.totalRefund)} in full refunds, ${res.refundsSent} sent through Razorpay.`,
      );
      setCloseOpen(false);
      run();
      refetchBookings();
    } finally {
      setBusy('');
    }
  }

  async function markRefundsPaid() {
    setBusy('refunds');
    try {
      const r = await sendRefunds({ dealId: deal.Id });
      if (!r) return;
      const sent = r?.data?.sent ?? 0;
      if (sent < dueRows.length) toast.warning(`${dueRows.length - sent} refunds did not go through. They stay due so you can retry.`);
      if (sent) toast.success(`${sent} refunds sent through Razorpay`);
      refetchBookings();
    } finally {
      setBusy('');
    }
  }

  async function emailInvoices(onlyMissing) {
    setBusy('invoices');
    try {
      const r = await sdk.invoices.sendForDeal(deal.Id, onlyMissing);
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      const { sent, failed, total } = r.value ?? {};
      if (failed) toast.warning(`${failed} invoice emails didn't send. Try those again from each booking.`);
      if (sent) toast.success(`${sent} ${sent === 1 ? 'invoice' : 'invoices'} emailed${total > sent + failed ? `. ${total - sent - failed} more will go out next` : ''}.`);
      setInvoiceOpen(false);
      refetchBookings();
    } finally {
      setBusy('');
    }
  }

  async function removeDeal() {
    setBusy('delete');
    try {
      const res = await sdk.table('deals_c').remove(deal.Id);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (res.success === false && !res.data?.length) return;
      toast.success(`Deleted ${deal.Name}`);
      setDeleteOpen(false);
      navigate('/admin/deals');
    } finally {
      setBusy('');
    }
  }

  const collected = activeBookings.reduce((sum, b) => sum + Number(b.amountPaid_c || 0) - (b.refundStatus_c === 'Paid' ? Number(b.refundDue_c || 0) : 0), 0);
  const fmt = (v, f) => (v ? formatLocalDate(v, f) : '—');

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        {back}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge value={deal.status_c} label={dealStatusLabel(deal.status_c)} />
              <span className="text-sm text-muted-foreground">{categoryLabel(deal.category_c)}, round {deal.round_c ?? 1}</span>
            </div>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-foreground md:text-[2.25rem]">{deal.Name}</h1>
            <p className="mt-1 text-muted-foreground">
              {deal.vendor_c?.Id ? (
                <Link to={`/admin/vendors/${deal.vendor_c.Id}`} className="font-medium text-foreground hover:text-primary hover:underline">{deal.vendor_c.Name}</Link>
              ) : (
                'No vendor yet'
              )}
              {' for '}
              {deal.community_c?.Name ?? (deal.locality_c?.Id ? 'the whole locality' : deal.city_c?.Name ? `all of ${deal.city_c.Name}` : 'the whole locality')}
              {deal.locality_c?.Id && (
                <>
                  {' in '}
                  <Link to={`/areas/${deal.locality_c.Id}`} className="hover:text-primary hover:underline">{deal.locality_c.Name}</Link>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild className="h-11 rounded-full px-4">
              <Link to={`/admin/deals/${deal.Id}/edit`}>
                <ApperIcon name="Pencil" size={16} />
                Edit
              </Link>
            </Button>
            {deal.status_c === 'Live' && (
              <Button onClick={() => setCloseOpen(true)} className="h-11 rounded-full px-5">
                <ApperIcon name="Lock" size={16} />
                Close deal
              </Button>
            )}
            {deal.status_c === 'Closed' && deal.vendor_c?.Id && (
              <Button onClick={() => setPayoutOpen(true)} className="h-11 rounded-full px-5">
                <ApperIcon name="Banknote" size={16} />
                Create payout
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-11 rounded-full" aria-label="More actions">
                  <ApperIcon name="Ellipsis" size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {deal.status_c !== 'Draft' && (
                  <DropdownMenuItem asChild>
                    <Link to={`/deals/${deal.Id}`}>
                      <ApperIcon name="ExternalLink" size={16} />
                      See the public page
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/deals/${deal.Id}`);
                    toast.success('Link copied. Paste it in the community group.');
                  }}
                >
                  <ApperIcon name="Link" size={16} />
                  Copy deal link
                </DropdownMenuItem>
                {deal.status_c === 'Closed' && (
                  <>
                    <DropdownMenuItem onSelect={() => setInvoiceOpen(true)}>
                      <ApperIcon name="Send" size={16} />
                      Email invoices
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <ApperIcon name="Trash2" size={16} />
                  Delete deal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <DealReviewPanel deal={deal} role="admin" onChanged={run} showTerms={['Awaiting team'].includes(deal.status_c)} />

      {dueRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-highlight/20 px-5 py-4">
          <div>
            <p className="font-medium text-foreground">{inr(dueTotal)} to refund on {dueRows.length} {dueRows.length === 1 ? 'booking' : 'bookings'}</p>
            <p className="text-sm text-muted-foreground">Razorpay payments go back through Razorpay. Demo bookings are just marked sent.</p>
          </div>
          <Button onClick={markRefundsPaid} disabled={busy === 'refunds'} className="h-11 rounded-full px-5">
            {busy === 'refunds' ? (
              <>
                <ApperIcon name="LoaderCircle" size={16} className="animate-spin" />
                Sending
              </>
            ) : 'Send refunds'}
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <section className="rounded-[22px] bg-card p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Price now {deal.unit_c}</p>
              <p className="font-heading text-4xl font-bold tabular-nums text-foreground">{inr(st.current?.price)}</p>
            </div>
            {st.refundPerUnit > 0 && (
              <p className="text-right text-sm text-muted-foreground">
                Started at {inr(st.tier1?.price)}
                <br />
                <span className="font-medium text-foreground">{inr(st.refundPerUnit)} back to each home</span>
              </p>
            )}
          </div>
          <div className="mt-5">
            <DealProgress deal={deal} size="lg" />
          </div>
        </section>

        <section className="rounded-[22px] bg-card px-5 py-3 shadow-sm md:px-6">
          <dl className="divide-y divide-border">
            <Row label="Regular price">{inr(deal.regularPrice_c)}</Row>
            <Row label="Goes ahead at">{st.min} homes</Row>
            <Row label="Capacity">{st.cap || '—'}</Row>
            <Row label="Collected">{inr(collected)} after refunds</Row>
            <Row label="Commission">{deal.commission_c ?? 0}%, {inr(commission)} {settled ? 'earned' : 'if it closes now'}</Row>
            <Row label="Closes">{fmt(deal.deadline_c, DATE_FORMATS.WITH_TIME)}</Row>
            <Row label="Service window">
              {fmt(deal.serviceStart_c, DATE_FORMATS.SHORT)} to {fmt(deal.serviceEnd_c, DATE_FORMATS.SHORT)}
            </Row>
          </dl>
          {deal.description_c && (
            <details className="group border-t border-border py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-foreground">
                What's included
                <ApperIcon name="ChevronDown" size={16} className="text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{deal.description_c}</p>
            </details>
          )}
        </section>
      </div>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-xl font-bold text-foreground">Bookings</h2>
          <span className="text-sm text-muted-foreground">{activeBookings.length} active{rows.length > activeBookings.length ? `, ${rows.length - activeBookings.length} cancelled` : ''}</span>
        </div>
        {bLoading && bookings === undefined ? (
          <div className="mt-3"><ListSkeleton rows={3} /></div>
        ) : rows.length === 0 ? (
          <p className="mt-3 rounded-[22px] bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">No bookings yet. Copy the deal link and share it in the community group.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-[22px] bg-card shadow-sm">
            <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] gap-4 border-b border-border px-5 py-3 text-[13px] text-muted-foreground md:grid">
              <span>Neighbour</span>
              <span>Community</span>
              <span>Paid</span>
              <span>Refund</span>
              <span className="text-right">Status</span>
            </div>
            <ul className="divide-y divide-border">
              {rows.map((b) => (
                <li key={b.Id}>
                  <Link
                    to={`/bookings/${b.Id}`}
                    className={cn(
                      'grid grid-cols-2 gap-x-4 gap-y-1.5 px-5 py-3.5 transition-colors duration-(--transition-fast) hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] md:items-center',
                      b.status_c === 'Cancelled' && 'opacity-60',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{b.Owner?.Name ?? 'Neighbour'}</p>
                      <p className="text-[13px] text-muted-foreground">{b.Name}</p>
                    </div>
                    <p className="text-sm leading-snug text-muted-foreground">{b.community_c?.Name ?? b.locality_c?.Name ?? '—'}</p>
                    <p className="text-sm tabular-nums text-foreground">
                      {inr(b.amountPaid_c)}
                      <span className="block text-[13px] text-muted-foreground">{b.homes_c} × {inr(b.unitPrice_c)}</span>
                    </p>
                    <p className="text-sm tabular-nums">
                      {b.refundStatus_c === 'Due' ? (
                        <><span className="font-medium text-foreground">{inr(b.refundDue_c)}</span> <span className="text-[oklch(0.5_0.13_50)]">to send</span></>
                      ) : b.refundStatus_c === 'Paid' ? (
                        <span className="text-muted-foreground">{inr(b.refundDue_c)} sent</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </p>
                    <div className="md:text-right">
                      <StatusBadge value={b.status_c} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <PayoutDialog
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        record={null}
        initial={{
          vendor_c: deal.vendor_c,
          deal_c: { Id: deal.Id, Name: deal.Name },
          gross_c: Math.round((st.current?.price ?? 0) * st.booked * 100) / 100,
          commission_c: Math.round((st.current?.price ?? 0) * st.booked * Number(deal.commission_c || 0)) / 100,
        }}
        onSaved={(p) => navigate(`/payouts/${p?.Id ?? ''}`)}
      />

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {deal.Name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {plan.unlocked ? (
                  <p>
                    {st.booked} booked, minimum {st.min}: the deal goes ahead at {inr(plan.finalPrice)}.
                    {' '}{plan.updates.length} open bookings will be confirmed with {inr(plan.totalRefund)} in refunds.
                  </p>
                ) : (
                  <p>
                    Only {st.booked} of the {st.min} needed booked. The deal fails and {plan.updates.length} bookings get a full
                    refund of {inr(plan.totalRefund)}.
                  </p>
                )}
                <p>Bookings stop immediately. This can't be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'close'}>Keep it open</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                closeDeal();
              }}
              disabled={busy === 'close'}
            >
              {busy === 'close' ? 'Closing…' : plan.unlocked ? 'Close and confirm' : 'Close and refund all'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Email invoices for {deal.Name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const confirmed = rows.filter((b) => ['Confirmed', 'Done'].includes(b.status_c));
                const missing = confirmed.filter((b) => !b.invoicedOn_c).length;
                return `${confirmed.length} confirmed ${confirmed.length === 1 ? 'booking' : 'bookings'}. ${missing ? `${missing} haven't had an invoice yet.` : 'Everyone already has one.'} Each neighbour gets their invoice as a PDF by email.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={busy === 'invoices'}>Cancel</AlertDialogCancel>
            {rows.some((b) => ['Confirmed', 'Done'].includes(b.status_c) && !b.invoicedOn_c) && (
              <Button variant="outline" disabled={busy === 'invoices'} onClick={() => emailInvoices(true)}>Only those missing</Button>
            )}
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                emailInvoices(false);
              }}
              disabled={busy === 'invoices'}
            >
              {busy === 'invoices' ? 'Sending…' : 'Email everyone'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deal.Name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeBookings.length
                ? `${activeBookings.length} bookings are attached. Close the deal instead so neighbours are refunded properly.`
                : 'This removes the deal for good.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'delete'}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                removeDeal();
              }}
              disabled={busy === 'delete'}
            >
              {busy === 'delete' ? 'Deleting…' : 'Delete deal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
