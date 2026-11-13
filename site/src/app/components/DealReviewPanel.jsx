import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import { DEAL_EVENT_LABEL, DEAL_STYLES, dealFulfilment, dealOpenTo, dealStatusLabel, getTiers, inr, windowText } from '@/services/dealRules';

const { eq } = window.ApperSDK.CoreSDK;

const HOW = {
  service: 'A service at the neighbour\'s home',
  delivery: 'Delivered to the door',
  pickup: 'Collected from the vendor',
  both: 'Delivery or pickup, the buyer chooses',
};

/** The terms a vendor is asked to agree to, laid out so nothing is hidden. */
export function DealTerms({ deal }) {
  const tiers = getTiers(deal);
  const unit = String(deal.unit_c || 'per home').replace(/^per\s+/, '');
  const rows = [
    ['Open to', dealOpenTo(deal)],
    ['How buyers get it', `${HOW[dealFulfilment(deal)]}${['pickup', 'both'].includes(dealFulfilment(deal)) && deal.pickupAddress_c ? `. Pickup: ${deal.pickupAddress_c}` : ''}`],
    ['Regular price', deal.regularPrice_c ? `${inr(deal.regularPrice_c)} per ${unit}` : '—'],
    ['Minimum to go ahead', `${deal.minHomes_c ?? '—'} ${unit}s`],
    ['Most this round', deal.capacity_c ? `${deal.capacity_c} ${unit}s` : 'No cap'],
    ['Lotmates commission', `${deal.commission_c ?? 0}% of sales, paid by the vendor`],
    ['Bookings close', deal.deadline_c ? formatLocalDate(deal.deadline_c, DATE_FORMATS.SHORT) : 'Not set'],
    ['Work window', windowText(deal) || 'Not set'],
  ];
  return (
    <div>
      <dl className="divide-y divide-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className="text-right text-sm font-medium text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm font-medium text-foreground">Price tiers</p>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
        {tiers.map((t, i) => (
          <li key={t.n ?? i} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">Up to {t.to} {unit}s</span>
            <span className="font-semibold tabular-nums text-foreground">{inr(t.price)} each</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Everyone pays the first tier price when they book, and the difference comes back as more neighbours join.</p>
    </div>
  );
}

function Timeline({ dealId, refreshKey }) {
  const { data: events } = useFetch(
    () =>
      sdk
        .table('dealEvents_c')
        .select(['Name', 'kind_c', 'note_c', 'role_c', 'Owner', 'CreatedOn'])
        .where(eq('deal_c', dealId))
        .orderByDesc('CreatedOn')
        .page(1, 50)
        .fetch()
        .then((r) => (r.success ? r.data : [])),
    [dealId, refreshKey],
  );
  if (!events?.length) return null;
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground">History</h3>
      <ol className="mt-3 space-y-3">
        {events.map((e) => (
          <li key={e.Id} className="flex gap-3">
            <span aria-hidden className="mt-1.5 size-2 flex-none rounded-full bg-primary/60" />
            <div className="min-w-0 text-sm">
              <p className="text-foreground">{DEAL_EVENT_LABEL[e.kind_c] ?? e.kind_c}</p>
              <p className="text-[13px] text-muted-foreground">
                {[e.Owner?.Name, e.role_c === 'Admin' ? 'Lotmates team' : e.role_c === 'Vendor' ? 'Vendor' : null].filter(Boolean).join(', ')}
                {e.CreatedOn ? ` · ${formatLocalDate(e.CreatedOn, DATE_FORMATS.SHORT)}` : ''}
              </p>
              {e.note_c && <p className="mt-1 whitespace-pre-line rounded-lg bg-muted/60 px-3 py-2 text-[13px] leading-5 text-foreground">{e.note_c}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Where a deal stands in review, what each side can do next, and the history.
 * role: 'admin' (the team) or 'vendor'. onChanged runs after any step so the page reloads.
 */
export default function DealReviewPanel({ deal, role, onChanged, editTo, showTerms = false }) {
  const [busy, setBusy] = useState('');
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [tick, setTick] = useState(0);
  const s = deal.status_c;
  const vendorOwns = deal.origin_c === 'vendor';
  const admin = role === 'admin';

  async function act(action, extra = {}, doneMsg) {
    setBusy(action);
    const r = await sdk.dealFlow.act(deal.Id, action, extra);
    setBusy('');
    if (!r.ok) {
      toast.error(r.error.message);
      return;
    }
    toast.success(doneMsg);
    setAsking(false);
    setNote('');
    setConfirm(false);
    setTick((t) => t + 1);
    onChanged?.();
  }

  const btn = (action, label, doneMsg, opts = {}) => (
    <Button
      type="button"
      variant={opts.variant ?? 'default'}
      disabled={Boolean(busy)}
      onClick={() => act(action, opts.extra ?? {}, doneMsg)}
      className="h-11 rounded-full px-5"
    >
      {busy === action ? <ApperIcon name="LoaderCircle" size={16} className="animate-spin" /> : null}
      {label}
    </Button>
  );

  const ask = (label) => (
    <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => setAsking(true)} className="h-11 rounded-full px-5">
      {label}
    </Button>
  );

  let message = null;
  let actions = null;
  if (['Live', 'Closed', 'Failed'].includes(s) && !deal.skipReview_c && !deal.agreedOn_c && !deal.approvedOn_c) {
    // Older deals, from before sign-off was recorded: nothing to show.
  }
  if (s === 'Draft') {
    message = admin ? 'A draft only the team can see. Send it to the vendor to confirm, or publish it without their review.' : 'Your draft. Only you can see it. Send it to the team when it is ready.';
    actions = admin ? (
      <>
        {btn('send_to_vendor', 'Send to vendor for review', 'Sent to the vendor to confirm')}
        {btn('publish_direct', 'Publish without vendor review', 'Published without vendor review', { variant: 'outline' })}
      </>
    ) : (
      <>
        {editTo && (
          <Button asChild variant="outline" className="h-11 rounded-full px-5"><Link to={editTo}>Edit the deal</Link></Button>
        )}
        {btn('submit', 'Send to the team for review', 'Sent to the team for review')}
      </>
    );
  } else if (s === 'Changes requested') {
    message = admin
      ? vendorOwns ? 'You asked the vendor for changes. It comes back here when they send it again.' : 'The vendor asked for changes. Update the deal, then send it back to them.'
      : vendorOwns ? 'The team asked for changes. Update the deal and send it again.' : 'You asked for changes. The team will update the deal and send it back to you.';
    actions = admin ? (
      !vendorOwns && (
        <>
          {btn('send_to_vendor', 'Send to vendor for review', 'Sent to the vendor to confirm')}
          {btn('publish_direct', 'Publish without vendor review', 'Published without vendor review', { variant: 'outline' })}
        </>
      )
    ) : (
      vendorOwns && (
        <>
          {editTo && <Button asChild variant="outline" className="h-11 rounded-full px-5"><Link to={editTo}>Edit the deal</Link></Button>}
          {btn('submit', 'Send again for review', 'Sent to the team for review')}
        </>
      )
    );
  } else if (s === 'Awaiting vendor') {
    message = admin ? 'Waiting for the vendor to read and confirm the terms.' : 'The Lotmates team set this deal up for you. Read the terms below, then confirm them or ask for changes.';
    actions = admin ? (
      <>
        {btn('recall', 'Take it back', 'Taken back from the vendor', { variant: 'outline' })}
        {btn('publish_direct', 'Publish without vendor review', 'Published without vendor review', { variant: 'outline' })}
      </>
    ) : (
      <>
        <label className="flex w-full items-start gap-3 text-sm text-foreground">
          <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} className="mt-0.5" aria-label="I have read and confirm these terms" />
          <span>I have read these terms and confirm Lotmates may open this deal for bookings on them. This confirmation is saved with today's date and the exact terms.</span>
        </label>
        <Button type="button" disabled={!confirm || Boolean(busy)} onClick={() => act('accept', { confirm: true }, 'Confirmed. The team will open the deal.')} className="h-11 rounded-full px-5">
          {busy === 'accept' ? <ApperIcon name="LoaderCircle" size={16} className="animate-spin" /> : <ApperIcon name="Check" size={16} />}
          Confirm these terms
        </Button>
        {ask('Ask for changes')}
      </>
    );
  } else if (s === 'Awaiting team') {
    message = admin ? 'The vendor wrote this deal and sent it for your review. Check the tiers, commission and dates.' : 'With the team for review. You will get an email when they decide.';
    actions = admin ? (
      <>
        {btn('approve_publish', 'Approve and publish', 'Approved and live')}
        {btn('approve', 'Approve, publish later', 'Approved', { variant: 'outline' })}
        {ask('Ask for changes')}
      </>
    ) : (
      vendorOwns && btn('withdraw', 'Withdraw to edit', 'Taken back to draft', { variant: 'outline' })
    );
  } else if (s === 'Approved') {
    message = admin ? 'Both sides agree. Open it for bookings when you are ready.' : 'Confirmed on both sides. The team will open it for bookings.';
    actions = admin && btn('go_live', 'Open for bookings', 'Deal is live');
  }

  const showPanel = message || deal.agreedOn_c || deal.skipReview_c;
  if (!showPanel) return null;

  return (
    <section className="space-y-5 rounded-[22px] bg-card p-5 shadow-sm md:p-6" aria-label="Deal review">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge value={s} styles={DEAL_STYLES} label={dealStatusLabel(s)} />
        {deal.skipReview_c ? <span className="text-sm text-muted-foreground">Published by the team without vendor review</span> : null}
        {deal.agreedOn_c ? <span className="text-sm text-muted-foreground">Vendor confirmed on {formatLocalDate(deal.agreedOn_c, DATE_FORMATS.SHORT)}</span> : null}
        {deal.approvedOn_c ? <span className="text-sm text-muted-foreground">Team approved on {formatLocalDate(deal.approvedOn_c, DATE_FORMATS.SHORT)}</span> : null}
      </div>
      {message && <p className="text-[15px] leading-6 text-foreground">{message}</p>}
      {deal.reviewNote_c && s === 'Changes requested' && (
        <div className="rounded-xl bg-highlight/20 px-4 py-3 text-sm text-foreground">
          <p className="font-medium">What needs to change</p>
          <p className="mt-1 whitespace-pre-line">{deal.reviewNote_c}</p>
        </div>
      )}
      {(showTerms || (!admin && s === 'Awaiting vendor')) && <DealTerms deal={deal} />}
      {asking && (
        <div className="space-y-3">
          <label htmlFor="review-note" className="text-sm font-medium text-foreground">{admin ? 'What should the vendor change?' : 'What should change?'}</label>
          <Textarea id="review-note" autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Be specific so it takes one round, e.g. lower the minimum to 8 homes." />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!note.trim() || Boolean(busy)} onClick={() => act('request_changes', { note }, 'Sent back with your note')} className="h-11 rounded-full px-5">
              {busy === 'request_changes' ? <ApperIcon name="LoaderCircle" size={16} className="animate-spin" /> : null}
              Send back
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAsking(false)} className="h-11 rounded-full px-5">Cancel</Button>
          </div>
        </div>
      )}
      {actions && !asking && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      <Timeline dealId={deal.Id} refreshKey={tick} />
    </section>
  );
}
