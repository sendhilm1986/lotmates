import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog as Primitive } from 'radix-ui';
import { sdk } from '@/services/sdk';
import { useFunction } from '@/hooks/useFunction';
import { cn } from '@/lib/utils';
import ApperIcon from '@/components/ApperIcon';
import { Input } from '@/components/ui/input';
import DateCalendar from '@/components/DateCalendar';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dealState, inr, tierForCount, dealSchedule, dealFulfilment, dealSlots, scheduleLine } from '@/services/dealRules';
import { dealCover } from '@/services/dealMedia';
import { loadCheckout, openCheckout } from '@/services/razorpay';

const { eq } = window.ApperSDK.CoreSDK;

const BRAND_HEX = '#1F5C45';
const SAVED = 'lotmates.checkout';
const emptyForm = { homes: 1, community: '', preferredDate: '', preferredSlot: '', address: '', phone: '', notes: '' };

function readSaved() {
  try {
    return JSON.parse(window.localStorage.getItem(SAVED) || 'null');
  } catch {
    return null;
  }
}
function writeSaved(v) {
  try {
    window.localStorage.setItem(SAVED, JSON.stringify(v));
  } catch {
    /* only a convenience for next time */
  }
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// The next few days inside the service window, as tappable chips.
function dateOptions(start, end, count = 6) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = start ? new Date(`${start}T00:00:00`) : today;
  const first = from > today ? from : today;
  const last = end ? new Date(`${end}T00:00:00`) : null;
  const out = [];
  for (let i = 0; i < 21 && out.length < count; i += 1) {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    if (last && d > last) break;
    out.push({
      value: iso(d),
      day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      num: d.getDate(),
      month: d.toLocaleDateString('en-IN', { month: 'short' }),
      date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    });
  }
  return out;
}

export default function BookingDialog({ open, onOpenChange, deal, onBooked }) {
  const navigate = useNavigate();
  const st = dealState(deal);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [communities, setCommunities] = useState([]);
  const [paying, setPaying] = useState(false);
  // While Razorpay's window is up, our own screen steps aside so nothing sits over it or holds focus.
  const [handoff, setHandoff] = useState(false);
  const [editContact, setEditContact] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [otherDate, setOtherDate] = useState(false);
  // Bring the calendar into view once, when it opens.
  useEffect(() => {
    if (!otherDate) return undefined;
    const t = requestAnimationFrame(() => calendarRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    return () => cancelAnimationFrame(t);
  }, [otherDate]);
  const bodyRef = useRef(null);
  const profileRef = useRef(null);
  const calendarRef = useRef(null);
  const maxQty = Math.max(1, Math.min(10, st.remaining));
  const unitWord = (deal?.unit_c || 'per home').replace(/^per\s+/, '');
  const plural = (n) => `${n} ${unitWord}${n === 1 || /s$/.test(unitWord) ? '' : 's'}`;

  const { invoke: createOrder } = useFunction(import.meta.env.VITE_RAZORPAY_CREATE_ORDER);
  const { invoke: verifyPayment } = useFunction(import.meta.env.VITE_RAZORPAY_VERIFY_PAYMENT, { showError: false });

  const dates = useMemo(() => dateOptions(deal?.serviceStart_c, deal?.serviceEnd_c), [deal?.serviceStart_c, deal?.serviceEnd_c]);
  // How this deal is scheduled, and what room is left on each day or time slot.
  const mode = dealSchedule(deal);
  const delivery = dealFulfilment(deal) === 'delivery';
  const slots = useMemo(() => dealSlots(deal), [deal]);
  const [avail, setAvail] = useState({ capacity: 0, left: {} });
  const loadAvail = () => {
    if (!deal?.Id || mode === 'none') return;
    sdk.availability(deal.Id).then((r) => r.ok && setAvail({ capacity: r.value.capacity || 0, left: r.value.left || {} }));
  };

  useEffect(() => {
    if (!open) return;
    loadAvail();
    setErrors({});
    setShowNotes(false);
    setOtherDate(false);
    const saved = readSaved();
    const hasSaved = Boolean(saved?.address && saved?.phone);
    setEditContact(!hasSaved);
    setForm({
      ...emptyForm,
      community: deal?.community_c?.Id ?? (saved?.community ? String(saved.community) : ''),
      address: saved?.address ?? '',
      phone: saved?.phone ?? '',
    });
    // The profile is the source of truth for home and phone; fill from it when it has them.
    sdk.account.get().then((r) => {
      const me = r.ok ? r.value : null;
      if (!me) return;
      profileRef.current = me;
      setForm((f) => ({
        ...f,
        address: f.address || me.address || '',
        phone: f.phone || me.phone || '',
        community: f.community || (me.community?.Id ? String(me.community.Id) : ''),
      }));
      if ((me.address || saved?.address) && (me.phone || saved?.phone)) setEditContact(false);
    });
    let q = sdk.table('communities_c').select(['Name', 'locality_c']);
    if (deal?.community_c?.Id) q = q.where(eq('Id', deal.community_c.Id));
    else if (deal?.locality_c?.Id) q = q.where(eq('locality_c', deal.locality_c.Id));
    else return;
    q.orderBy('Name')
      .fetch()
      .then((r) => {
        const list = r.success ? r.data : [];
        setCommunities(list);
        // A saved community from another locality doesn't apply here.
        setForm((f) => (f.community && !list.some((c) => String(c.Id) === String(f.community)) ? { ...f, community: list.length === 1 ? String(list[0].Id) : '' } : f));
        if (list.length === 1) setForm((f) => ({ ...f, community: String(list[0].Id) }));
      });
  }, [open, deal]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const qty = Math.min(maxQty, Math.max(1, Number(form.homes) || 1));
  const limited = mode !== 'none' && avail.capacity > 0;
  const roomLeft = (date, slot) => (limited ? avail.left?.[date]?.[slot || 'day'] ?? avail.capacity : Infinity);
  const dayFull = (date) => (mode === 'datetime' ? slots.every((sl) => roomLeft(date, sl) < qty) : roomLeft(date) < qty);
  const dayLeft = (date) => (mode === 'datetime' ? Math.max(0, ...slots.map((sl) => roomLeft(date, sl))) : roomLeft(date));
  const pickDate = (v) => setForm((f) => ({ ...f, preferredDate: v, preferredSlot: v && f.preferredSlot && roomLeft(v, f.preferredSlot) >= qty ? f.preferredSlot : '' }));
  const total = (st.tier1?.price ?? 0) * qty;
  const backNow = st.refundPerUnit * qty;

  // What this booking does to the deal: the count after you join and the price it reaches.
  const after = st.booked + qty;
  const reachedAfter = Math.max(st.reached, tierForCount(st.tiers, after));
  const priceAfter = st.tiers[reachedAfter - 1]?.price ?? st.current?.price;
  const nextAfter = st.tiers[reachedAfter] ?? null;
  const backAfter = Math.max(0, ((st.tier1?.price ?? 0) - (priceAfter ?? 0)) * qty);
  const bestPrice = st.tiers.at(-1)?.price;
  const community = communities.find((c) => String(c.Id) === String(form.community));

  let impact;
  if (st.min > 0 && after < st.min) {
    impact = `${plural(st.min - after)} more after you and the deal is on.`;
  } else if (reachedAfter > st.reached) {
    impact = `Your booking drops the price to ${inr(priceAfter)} for everyone.`;
  } else if (nextAfter) {
    const gap = nextAfter.from - after;
    impact = `${gap} more after you and it drops to ${inr(nextAfter.price)}.`;
  } else {
    impact = 'The deal is at its best price.';
  }

  function validate() {
    const e = {};
    if (!form.community) e.community = 'Pick your community';
    if (!form.address.trim()) e.address = 'Add the flat or house number';
    if (!/^[+\d][\d\s-]{8,}$/.test(form.phone.trim())) e.phone = 'Add a phone number the vendor can call';
    if (form.preferredDate && deal?.serviceStart_c && form.preferredDate < deal.serviceStart_c) e.preferredDate = 'Pick a date inside the service window';
    if (form.preferredDate && deal?.serviceEnd_c && form.preferredDate > deal.serviceEnd_c) e.preferredDate = 'Pick a date inside the service window';
    if (limited && !form.preferredDate) e.preferredDate = mode === 'datetime' ? 'Pick a day, then a time' : 'Pick a day';
    if (mode === 'datetime' && form.preferredDate && !form.preferredSlot) e.preferredSlot = 'Pick a time for that day';
    if (form.preferredDate && dayFull(form.preferredDate)) e.preferredDate = 'That day is full. Pick another';
    setErrors(e);
    if (e.address || e.phone) setEditContact(true);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => bodyRef.current?.querySelector('[aria-invalid="true"]')?.focus());
    }
    return Object.keys(e).length === 0;
  }

  // The server prices the booking and creates the Razorpay order; the browser only opens checkout.
  async function pay(e) {
    e?.preventDefault();
    if (paying || !validate()) return;
    setPaying(true);
    try {
      let o;
      try {
        o = (await createOrder({
          dealId: deal.Id,
          homes: qty,
          communityId: form.community,
          preferredDate: mode === 'none' ? null : form.preferredDate || null,
          preferredSlot: mode === 'datetime' ? form.preferredSlot || null : null,
          address: form.address.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim(),
        }))?.data;
      } catch (err) {
        toast.error(err.message || 'Could not start the payment. Try again.');
        loadAvail();
        return;
      }
      if (!o?.orderId) return;
      writeSaved({ address: form.address.trim(), phone: form.phone.trim(), community: form.community });
      // First booking: keep these on the profile so every device fills them in next time.
      const me = profileRef.current;
      if (me && ['Customer_c', 'Ambassador_c'].includes(me.profile) && (!me.address || !me.phone || !me.community)) {
        sdk.account.update({
          ...(me.address ? {} : { address: form.address.trim() }),
          ...(me.phone ? {} : { phone: form.phone.trim() }),
          ...(me.community ? {} : { communityId: form.community }),
        });
      }
      const loaded = await loadCheckout();
      if (!loaded) {
        toast.error('Could not open Razorpay. Check your connection and try again.');
        return;
      }
      let resp;
      setHandoff(true);
      // Let our screen finish closing (and release the page) before Razorpay opens on top.
      await new Promise((r) => setTimeout(r, 260));
      try {
        resp = await openCheckout({
          key: o.keyId,
          amount: o.amount,
          currency: o.currency || 'INR',
          order_id: o.orderId,
          name: 'Lotmates',
          description: deal.Name,
          prefill: { contact: form.phone.replace(/\s/g, '') },
          notes: { deal: deal.Name },
          theme: { color: BRAND_HEX },
        });
      } catch (err) {
        setHandoff(false);
        if (!err?.dismissed) toast.error(err.message);
        else if (err.lastError) toast.error(`Payment didn't go through: ${err.lastError}`);
        return;
      }
      setHandoff(false);
      const confirm = async () => {
        try {
          return (await verifyPayment({
            orderId: resp.razorpay_order_id,
            paymentId: resp.razorpay_payment_id,
            signature: resp.razorpay_signature,
          }))?.data;
        } catch {
          return null;
        }
      };
      let v = await confirm();
      if (!v?.valid) {
        await new Promise((r) => setTimeout(r, 4000));
        v = await confirm();
      }
      if (!v?.valid) {
        toast.error(`We couldn't confirm payment ${resp.razorpay_payment_id} yet. If it went through, your booking appears within a few minutes.`);
        return;
      }
      toast.success(backAfter > 0 ? `Booked. ${inr(backAfter)} is coming back to you at close.` : 'Booked. Your refund grows as neighbours join.');
      onOpenChange(false);
      onBooked?.();
      if (v.bookingId) navigate(`/bookings/${v.bookingId}`);
    } finally {
      setPaying(false);
    }
  }

  if (!deal) return null;

  const fieldError = (k) => errors[k] && <p className="mt-1.5 text-sm text-destructive">{errors[k]}</p>;

  const payButton = (
    <button
      type="submit"
      form="checkout"
      disabled={paying}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-80"
    >
      {paying ? (
        <>
          <ApperIcon name="LoaderCircle" size={18} className="animate-spin" />
          Confirming your payment
        </>
      ) : (
        <>
          <ApperIcon name="Lock" size={16} />
          Pay {inr(total)}
        </>
      )}
    </button>
  );

  const whenText =
    mode === 'none'
      ? null
      : form.preferredDate
        ? `${new Date(`${form.preferredDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}${form.preferredSlot ? `, ${form.preferredSlot.split(',')[0].toLowerCase()}` : ''}`
        : limited
          ? 'Not picked yet'
          : 'Any day';
  const summaryRows = (full) => (
    <dl className="grid gap-2.5 text-sm">
      {full && whenText && (
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{delivery ? 'Delivery' : 'When'}</dt>
          <dd className="text-right text-foreground">{whenText}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Pay now, {plural(qty)}</dt>
        <dd className="tabular-nums text-foreground">{inr(total)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Refund at close, so far</dt>
        <dd className="tabular-nums">
          {backAfter > 0 ? <span className="rounded-md bg-highlight px-1.5 font-semibold text-highlight-foreground">{inr(backAfter)}</span> : <span className="text-foreground">₹0</span>}
        </dd>
      </div>
      {full && (
        <div className="flex justify-between gap-4 border-t border-border pt-2.5">
          <dt className="font-medium text-foreground">Final cost, so far</dt>
          <dd className="font-heading font-bold tabular-nums text-foreground">{inr(total - backAfter)}</dd>
        </div>
      )}
      {full && bestPrice && bestPrice < (priceAfter ?? 0) && (
        <p className="text-[13px] leading-5 text-muted-foreground">Drops to {inr(bestPrice * qty)} if the deal fills up. The difference comes back to you.</p>
      )}
    </dl>
  );

  const legal = (
    <p className="text-center text-xs leading-5 text-muted-foreground">
      Full refund if the deal doesn't go ahead. Paying means you agree to the{' '}
      <a href="/legal/terms" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">terms</a>,{' '}
      <a href="/legal/refunds" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">refund</a> and{' '}
      <a href="/legal/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">privacy</a> policies.
    </p>
  );

  return (
    <Primitive.Root open={open && !handoff} onOpenChange={(v) => !paying && onOpenChange(v)}>
      <Primitive.Portal>
        <Primitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => {
            if (handoff) e.preventDefault();
          }}
          className="fixed inset-0 z-50 flex flex-col bg-background outline-none will-change-[opacity,transform] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-6 data-[state=open]:duration-300 data-[state=open]:ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-3 data-[state=closed]:duration-200 data-[state=closed]:ease-in motion-reduce:animate-none"
        >
          <header className="flex-none border-b border-border/70 bg-background/90 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 md:h-[72px] md:px-8">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ApperIcon name="ShieldCheck" size={18} className="text-primary" />
                <span>Secure checkout<span className="hidden sm:inline">, paid through Razorpay</span></span>
              </p>
              <div className="flex items-center gap-3">
                <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 font-sans text-xs text-muted-foreground md:inline">Esc</kbd>
                <Primitive.Close
                  disabled={paying}
                  className="group flex size-11 items-center justify-center rounded-full bg-card text-foreground shadow-[0_0_0_1px_rgb(15_42_32/0.08),0_2px_6px_rgb(15_42_32/0.08)] transition-[background-color,box-shadow,transform] duration-200 hover:bg-muted hover:shadow-[0_0_0_1px_rgb(15_42_32/0.12),0_4px_12px_rgb(15_42_32/0.12)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <ApperIcon name="X" size={20} strokeWidth={1.75} className="transition-transform duration-200 group-hover:rotate-90" />
                  <span className="sr-only">Close checkout</span>
                </Primitive.Close>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-10 pt-7 md:px-8 md:pt-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-20">
              <div className="min-w-0">
                <div className="flex items-center gap-4">
                  <img src={dealCover(deal, 200)} alt="" className="size-16 flex-none rounded-2xl object-cover lg:hidden" />
                  <div className="min-w-0">
                    <Primitive.Title className="font-heading text-2xl font-bold leading-tight tracking-tight text-foreground md:text-[2rem]">{deal.Name}</Primitive.Title>
                    <p className="mt-1 text-muted-foreground">
                      {[deal.vendor_c?.Name, deal.community_c?.Name ?? deal.locality_c?.Name].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>

                <form id="checkout" onSubmit={pay} noValidate ref={bodyRef} className="mt-8">
              {/* How many */}
              <section className="border-t border-border pt-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-[17px] font-medium text-foreground">How many {/s$/.test(unitWord) ? unitWord : `${unitWord}s`}?</h3>
                    <p className="text-sm text-muted-foreground">{inr(st.tier1?.price)} each today</p>
                  </div>
                  <div className="flex items-center rounded-full border border-border bg-card p-1">
                    <button
                      type="button"
                      aria-label="One fewer"
                      disabled={qty <= 1}
                      onClick={() => setForm((f) => ({ ...f, homes: Math.max(1, qty - 1) }))}
                      className="flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
                    >
                      <ApperIcon name="Minus" size={18} />
                    </button>
                    <output aria-live="polite" className="w-9 text-center font-heading text-lg font-bold tabular-nums">{qty}</output>
                    <button
                      type="button"
                      aria-label="One more"
                      disabled={qty >= maxQty}
                      onClick={() => setForm((f) => ({ ...f, homes: Math.min(maxQty, qty + 1) }))}
                      className="flex size-10 items-center justify-center rounded-full text-foreground hover:bg-muted disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
                    >
                      <ApperIcon name="Plus" size={18} />
                    </button>
                  </div>
                </div>
                <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-primary/[0.07] px-4 py-3 text-sm text-foreground">
                  <ApperIcon name="Users" size={16} className="mt-0.5 flex-none text-primary" />
                  <span>
                    You'd make it {after}
                    {st.cap ? ` of ${st.cap}` : ''}. {impact}
                  </span>
                </p>
              </section>

              {/* When */}
              <section className="mt-9 border-t border-border pt-7">
                {mode === 'none' ? (
                  <>
                    <h3 className="text-[17px] font-medium text-foreground">{delivery ? 'Delivery' : 'When it happens'}</h3>
                    <p className="mt-2 flex items-start gap-2.5 text-[15px] text-foreground">
                      <ApperIcon name={delivery ? 'Truck' : 'PhoneCall'} size={18} className="mt-0.5 flex-none text-primary" />
                      {scheduleLine({}, deal)}
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-[17px] font-medium text-foreground">{delivery ? 'When should it arrive?' : 'When suits you?'}</h3>
                    <p className="text-sm text-muted-foreground">
                      {limited
                        ? `Pick a ${mode === 'datetime' ? 'day and time' : 'day'}. Full ${mode === 'datetime' ? 'times' : 'days'} can't be booked.`
                        : delivery
                          ? 'The vendor confirms the delivery time with you.'
                          : 'The vendor confirms the exact time with you.'}
                    </p>
                    <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0" role="radiogroup" aria-label="Preferred date" aria-invalid={Boolean(errors.preferredDate)}>
                      {(() => {
                        const chip = (active, disabled) =>
                          cn(
                            'flex h-[76px] flex-none flex-col items-center justify-center rounded-xl border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            active
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : disabled
                                ? 'cursor-not-allowed border-dashed border-border bg-transparent text-muted-foreground/50'
                                : 'border-border bg-card text-foreground hover:border-foreground/30',
                          );
                        const sub = (active) => cn('text-xs', active ? 'text-primary-foreground/80' : 'text-muted-foreground');
                        const anyActive = !otherDate && !form.preferredDate;
                        return (
                          <>
                            {!limited && (
                              <button
                                type="button"
                                role="radio"
                                aria-checked={anyActive}
                                onClick={() => {
                                  setOtherDate(false);
                                  pickDate('');
                                }}
                                className={cn(chip(anyActive), 'min-w-[80px] gap-1.5')}
                              >
                                <ApperIcon name="CalendarCheck" size={18} className={anyActive ? 'text-primary-foreground' : 'text-primary'} />
                                <span className="text-sm font-medium leading-none">Any day</span>
                              </button>
                            )}
                            {dates.map((d) => {
                              const active = !otherDate && form.preferredDate === d.value;
                              const full = dayFull(d.value);
                              const left = dayLeft(d.value);
                              return (
                                <button
                                  key={d.value}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  disabled={full}
                                  aria-label={`${d.day} ${d.date}${full ? ', full' : ''}`}
                                  onClick={() => {
                                    setOtherDate(false);
                                    pickDate(d.value);
                                  }}
                                  className={cn(chip(active, full), 'w-[60px] gap-0.5')}
                                >
                                  <span className={sub(active)}>{d.day}</span>
                                  <span className={cn('font-heading text-xl font-bold leading-tight tabular-nums', full && 'line-through decoration-1')}>{d.num}</span>
                                  <span className={cn(sub(active), !full && limited && left <= 3 && !active && 'font-medium text-[oklch(0.5_0.13_50)]')}>
                                    {full ? 'Full' : limited && left <= 3 ? `${left} left` : d.month}
                                  </span>
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setOtherDate(true)}
                              aria-pressed={otherDate}
                              className={cn(chip(otherDate), 'min-w-[80px] gap-1.5', !otherDate && 'border-dashed text-muted-foreground hover:text-foreground')}
                            >
                              <ApperIcon name="CalendarDays" size={18} className={otherDate ? 'text-primary-foreground' : ''} />
                              <span className="text-sm font-medium leading-none">
                                {otherDate && form.preferredDate && !dates.some((d) => d.value === form.preferredDate)
                                  ? new Date(`${form.preferredDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                  : 'Other date'}
                              </span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                    {otherDate && (
                      <div
                        ref={calendarRef}
                        className="mt-4 max-w-[340px] scroll-mb-40 animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none"
                      >
                        <DateCalendar
                          label="Pick a date"
                          value={form.preferredDate}
                          min={[iso(new Date()), deal.serviceStart_c].filter(Boolean).sort().at(-1)}
                          max={deal.serviceEnd_c ?? undefined}
                          isDisabled={(v) => dayFull(v)}
                          onChange={pickDate}
                        />
                        <p className="mt-2.5 text-sm text-muted-foreground">
                          {form.preferredDate
                            ? `You picked ${new Date(`${form.preferredDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}.`
                            : deal.serviceEnd_c
                              ? `Any day up to ${new Date(`${deal.serviceEnd_c}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}${limited ? ' that still has room' : ''}.`
                              : 'Pick a day that suits you.'}
                        </p>
                      </div>
                    )}
                    {fieldError('preferredDate')}

                    {mode === 'datetime' && form.preferredDate && (
                      <div className="mt-6 animate-in fade-in-0 duration-200 motion-reduce:animate-none">
                        <p className="text-[15px] font-medium text-foreground">What time?</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Time slot" aria-invalid={Boolean(errors.preferredSlot)}>
                          {slots.map((sl) => {
                            const left = roomLeft(form.preferredDate, sl);
                            const full = left < qty;
                            const active = form.preferredSlot === sl;
                            const [label, ...rest] = sl.split(',');
                            return (
                              <button
                                key={sl}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={full}
                                onClick={() => setForm((f) => ({ ...f, preferredSlot: sl }))}
                                className={cn(
                                  'flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                  active
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : full
                                      ? 'cursor-not-allowed border-dashed border-border text-muted-foreground/50'
                                      : 'border-border bg-card text-foreground hover:border-foreground/30',
                                )}
                              >
                                <span>
                                  <span className="block text-sm font-medium">{label}</span>
                                  {rest.length > 0 && <span className={cn('block text-[13px]', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{rest.join(',').trim()}</span>}
                                </span>
                                {(full || (limited && left <= 3)) && (
                                  <span className={cn('flex-none text-xs font-medium', active ? 'text-primary-foreground/80' : full ? '' : 'text-[oklch(0.5_0.13_50)]')}>{full ? 'Full' : `${left} left`}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {fieldError('preferredSlot')}
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Where */}
              <section className="mt-9 border-t border-border pt-7">
                <h3 className="text-[17px] font-medium text-foreground">{delivery ? 'Where to deliver, and who to call' : 'Where and who to call'}</h3>
                <p className="text-sm text-muted-foreground">Shared only with the vendor for this job.</p>
                <div className="mt-4">
                  {deal.community_c?.Id || communities.length === 1 ? (
                    <p className="flex items-center gap-2 text-sm text-foreground">
                      <ApperIcon name="Building2" size={16} className="text-muted-foreground" />
                      {community?.Name ?? deal.community_c?.Name ?? 'Your community'}
                    </p>
                  ) : (
                    <>
                      <Select value={form.community ? String(form.community) : ''} onValueChange={set('community')}>
                        <SelectTrigger aria-label="Community" aria-invalid={Boolean(errors.community)} className="h-11 w-full">
                          <SelectValue placeholder="Your apartment, enclave or street" />
                        </SelectTrigger>
                        <SelectContent>
                          {communities.map((c) => (
                            <SelectItem key={c.Id} value={String(c.Id)}>{c.Name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldError('community')}
                    </>
                  )}
                </div>

                {editContact ? (
                  <div className="mt-3 grid gap-3">
                    <div>
                      <label htmlFor="bk-address" className="sr-only">Flat or house number</label>
                      <Input id="bk-address" autoComplete="address-line1" aria-invalid={Boolean(errors.address)} value={form.address} onChange={set('address')} placeholder="Flat or house number, block" className="h-11" />
                      {fieldError('address')}
                    </div>
                    <div>
                      <label htmlFor="bk-phone" className="sr-only">Phone</label>
                      <Input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} value={form.phone} onChange={set('phone')} placeholder="Phone, e.g. 98765 43210" className="h-11" />
                      {fieldError('phone')}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-start justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                    <div className="min-w-0 text-sm">
                      <p className="truncate text-foreground">{form.address}</p>
                      <p className="text-muted-foreground">{form.phone}</p>
                    </div>
                    <button type="button" onClick={() => setEditContact(true)} className="flex-none text-sm font-medium text-primary hover:underline">
                      Change
                    </button>
                  </div>
                )}

                {showNotes ? (
                  <div className="mt-3">
                    <label htmlFor="bk-notes" className="sr-only">Note for the vendor</label>
                    <Textarea id="bk-notes" autoFocus value={form.notes} onChange={set('notes')} placeholder="e.g. Please call before coming" rows={2} />
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowNotes(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                    <ApperIcon name="Plus" size={14} />
                    Add a note for the vendor
                  </button>
                )}
              </section>
                </form>
              </div>

              <aside className="hidden lg:block">
                <div className="sticky top-0 rounded-[28px] bg-card p-6 shadow-[0_1px_2px_rgb(15_42_32/0.06),0_12px_32px_-12px_rgb(15_42_32/0.18)]">
                  <img src={dealCover(deal, 760)} alt="" className="aspect-[16/9] w-full rounded-[20px] object-cover" />
                  <p className="mt-5 font-medium text-foreground">Your booking</p>
                  <div className="mt-3">{summaryRows(true)}</div>
                  <div className="mt-6">{payButton}</div>
                  <div className="mt-4">{legal}</div>
                  <details className="mt-3 text-center text-xs text-muted-foreground">
                    <summary className="cursor-pointer list-none hover:text-foreground">Test mode: no real money moves</summary>
                    <p className="mt-1">Card 4111 1111 1111 1111, any future expiry and CVV, or UPI success@razorpay.</p>
                  </details>
                </div>
              </aside>
            </div>
          </div>

          {/* Phones and tablets: total and pay stay in view */}
          <footer className="flex-none border-t border-border bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 lg:hidden">
            <div className="mx-auto max-w-xl">
              {summaryRows(false)}
              <div className="mt-4">{payButton}</div>
              <div className="mt-3">{legal}</div>
            </div>
          </footer>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
