// Categories are managed by the team (Admin > Categories). These start with the original six so
// the pages work before the list arrives, then loadCategories() (services/categories.js) replaces
// the contents in place. CATEGORY_VALUES holds the categories people can choose today; CATEGORY_META
// also keeps retired ones so old deals still show their name.
export const CATEGORY_VALUES = ['Health', 'Cleaning', 'Solar', 'Products', 'Pest', 'AC'];

export const CATEGORY_META = {
  Health: { label: 'Health checkups', icon: 'HeartPulse' },
  Cleaning: { label: 'Deep cleaning', icon: 'Sparkles' },
  Solar: { label: 'Rooftop solar', icon: 'Sun' },
  Products: { label: 'Local products', icon: 'Package' },
  Pest: { label: 'Pest control', icon: 'Bug' },
  AC: { label: 'AC care', icon: 'Wind' },
};

// Icons an admin can give a category (each must be a lucide icon name; they are bundled at build time).
export const CATEGORY_ICONS = [
  'Tag', 'HeartPulse', 'Stethoscope', 'Pill', 'Dumbbell', 'Sparkles', 'Brush', 'Droplets', 'Sun', 'Zap', 'Lightbulb', 'Wind',
  'Wrench', 'Hammer', 'Paintbrush', 'Bug', 'Package', 'ShoppingBasket', 'Gift', 'Milk', 'Apple', 'Utensils', 'Coffee', 'Cake',
  'Leaf', 'Sprout', 'Flower2', 'Dog', 'Baby', 'Shirt', 'Scissors', 'Sofa', 'Home', 'Key', 'Car', 'Bike', 'Truck', 'Camera',
  'Music', 'BookOpen', 'GraduationCap', 'Laptop', 'Smartphone', 'ShieldCheck', 'WashingMachine', 'Refrigerator', 'Fan', 'Plug',
];

export const DEAL_STATUS = ['Draft', 'Awaiting vendor', 'Awaiting team', 'Changes requested', 'Approved', 'Live', 'Closed', 'Failed'];
// Shown to people instead of the stored word.
export const DEAL_STATUS_LABEL = {
  'Awaiting vendor': 'Waiting for vendor',
  'Awaiting team': 'Waiting for the team',
  'Changes requested': 'Changes requested',
  Approved: 'Approved, not live yet',
};
export const dealStatusLabel = (s) => DEAL_STATUS_LABEL[s] ?? s;
// What each step of the review looks like on the timeline.
export const DEAL_EVENT_LABEL = {
  created: 'Deal started',
  submitted: 'Sent to the team for review',
  withdrawn: 'Withdrawn by the vendor',
  sent_to_vendor: 'Sent to the vendor for confirmation',
  recalled: 'Taken back from the vendor',
  changes_requested: 'Changes requested',
  accepted: 'Confirmed by the vendor',
  approved: 'Approved by the team',
  published: 'Opened for bookings',
  published_direct: 'Published by the team without vendor review',
  terms_changed: 'Terms changed after confirmation',
};
export const BOOKING_STATUS = ['Booked', 'Confirmed', 'Failed', 'Done', 'Cancelled'];
export const REFUND_STATUS = ['None', 'Due', 'Paid'];
export const PAYMENT_STATUS = ['Pending', 'Paid', 'Refunded'];
export const VENDOR_STATUS = ['Probation', 'Active', 'Paused', 'Removed'];
export const VENDOR_CHECKS = ['ID proof', 'Licence', 'Test job', 'References'];
export const REGION_STATUS = ['Live', 'Coming soon'];
export const COMMUNITY_TYPES = ['Apartment', 'Gated', 'Street'];
export const COMMUNITY_STATUS = ['Active', 'Onboarding'];

export const DEAL_STYLES = {
  Draft: 'bg-muted text-muted-foreground border-border',
  'Awaiting vendor': 'bg-warning-muted text-foreground border-warning-border',
  'Awaiting team': 'bg-warning-muted text-foreground border-warning-border',
  'Changes requested': 'bg-muted text-foreground border-border',
  Approved: 'bg-success/10 text-success border-success/30',
  Live: 'bg-primary/10 text-primary border-primary/25',
  Closed: 'bg-success/10 text-success border-success/30',
  Failed: 'bg-destructive/10 text-destructive border-destructive/25',
};

export const BOOKING_STYLES = {
  Booked: { badge: 'bg-primary/10 text-primary border-primary/25', row: 'bg-primary/[0.06]' },
  Confirmed: { badge: 'bg-success/10 text-success border-success/30', row: 'bg-success/[0.09]' },
  Failed: { badge: 'bg-destructive/10 text-destructive border-destructive/25', row: 'bg-destructive/[0.07]' },
  Done: { badge: 'bg-secondary text-secondary-foreground border-border', row: 'bg-secondary/40' },
  Cancelled: { badge: 'bg-muted text-muted-foreground border-border', row: 'bg-muted/50' },
};

export const REFUND_STYLES = {
  None: 'bg-muted text-muted-foreground border-border',
  Due: 'bg-highlight/25 text-foreground border-highlight/50',
  Paid: 'bg-success/10 text-success border-success/30',
};

export const VENDOR_STYLES = {
  Probation: 'bg-warning/15 text-warning border-warning/30',
  Active: 'bg-success/10 text-success border-success/30',
  Paused: 'bg-muted text-muted-foreground border-border',
  Removed: 'bg-destructive/10 text-destructive border-destructive/25',
};

export const REGION_STYLES = {
  Live: 'bg-success/10 text-success border-success/30',
  'Coming soon': 'bg-muted text-muted-foreground border-border',
  Active: 'bg-success/10 text-success border-success/30',
  Onboarding: 'bg-highlight/25 text-foreground border-highlight/50',
};

export const DEAL_FIELDS = [
  'Name',
  'category_c',
  'vendor_c',
  'locality_c',
  'community_c',
  'city_c',
  'pickupAddress_c',
  'origin_c',
  'reviewNote_c',
  'agreedBy_c',
  'agreedOn_c',
  'approvedBy_c',
  'approvedOn_c',
  'skipReview_c',
  'description_c',
  'unit_c',
  'regularPrice_c',
  'tier1Max_c',
  'tier1Price_c',
  'tier2Max_c',
  'tier2Price_c',
  'tier3Max_c',
  'tier3Price_c',
  'tier4Max_c',
  'tier4Price_c',
  'minHomes_c',
  'capacity_c',
  'commission_c',
  'deadline_c',
  'serviceStart_c',
  'serviceEnd_c',
  'status_c',
  'bookedHomes_c',
  'unlockedTier_c',
  'round_c',
  'allowRepeat_c',
  'gallery_c',
  'video_c',
  'fulfilment_c',
  'schedule_c',
  'timeSlots_c',
  'CreatedOn',
];

export const BOOKING_FIELDS = [
  'Name',
  'deal_c',
  'community_c',
  'locality_c',
  'fulfilment_c',
  'homes_c',
  'unitPrice_c',
  'amountPaid_c',
  'finalPrice_c',
  'refundDue_c',
  'refundStatus_c',
  'paymentStatus_c',
  'paymentRef_c',
  'status_c',
  'preferredDate_c',
  'preferredSlot_c',
  'address_c',
  'phone_c',
  'notes_c',
  'invoiceNo_c',
  'invoicedOn_c',
  'Owner',
  'CreatedOn',
];

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

export function getTiers(deal) {
  const tiers = [];
  let from = 1;
  const pairs = [
    [deal?.tier1Max_c, deal?.tier1Price_c],
    [deal?.tier2Max_c, deal?.tier2Price_c],
    [deal?.tier3Max_c, deal?.tier3Price_c],
    [deal?.tier4Max_c, deal?.tier4Price_c],
  ];
  for (let i = 0; i < pairs.length; i += 1) {
    const max = num(pairs[i][0]);
    const price = num(pairs[i][1]);
    if (max === null || price === null) break;
    tiers.push({ n: i + 1, from, to: max, price });
    from = max + 1;
  }
  return tiers;
}

export function tierForCount(tiers, count) {
  if (!tiers.length) return 0;
  if (count <= 0) return 1;
  const idx = tiers.findIndex((t) => count <= t.to);
  return idx === -1 ? tiers.length : idx + 1;
}

export function dealState(deal) {
  const tiers = getTiers(deal);
  const booked = Number(deal?.bookedHomes_c || 0);
  const reached = Math.min(
    tiers.length || 1,
    Math.max(Number(deal?.unlockedTier_c || 1), tierForCount(tiers, booked)),
  );
  const current = tiers[reached - 1] || tiers[0] || null;
  const tier1 = tiers[0] || null;
  const min = Number(deal?.minHomes_c || 0);
  const cap = Number(deal?.capacity_c || 0);
  const unlocked = min > 0 ? booked >= min : booked > 0;
  const next = tiers[reached] || null;
  const toNext = next ? Math.max(0, next.from - booked) : 0;
  const toMin = Math.max(0, min - booked);
  const refundPerUnit = tier1 && current ? tier1.price - current.price : 0;
  const full = cap > 0 && booked >= cap;
  const remaining = cap > 0 ? Math.max(0, cap - booked) : 999;
  const scaleMax = cap || tiers.at(-1)?.to || 1;
  const progressPct = Math.min(100, Math.round((booked / scaleMax) * 100));
  const minPct = Math.min(100, Math.round((min / scaleMax) * 100));
  const savingPct = deal?.regularPrice_c && current
    ? Math.round(((Number(deal.regularPrice_c) - current.price) / Number(deal.regularPrice_c)) * 100)
    : 0;
  return {
    tiers,
    booked,
    reached,
    current,
    tier1,
    min,
    cap,
    unlocked,
    next,
    toNext,
    toMin,
    refundPerUnit,
    full,
    remaining,
    scaleMax,
    progressPct,
    minPct,
    savingPct,
  };
}

export const inr = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  return `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export function timeLeft(iso) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((ms % 36e5) / 6e4);
  return `${h}h ${m}m left`;
}

export const isOpen = (deal) => deal?.status_c === 'Live' && new Date(deal?.deadline_c).getTime() > Date.now();

export const categoryLabel = (c) => CATEGORY_META[c]?.label ?? c ?? '—';
export const categoryIcon = (c) => CATEGORY_META[c]?.icon ?? 'Tag';

export function bookingAfterJoin(deal, homes) {
  const st = dealState(deal);
  const newBooked = st.booked + homes;
  const newTier = Math.max(st.reached, tierForCount(st.tiers, newBooked));
  return { bookedHomes_c: newBooked, unlockedTier_c: newTier };
}

export function planClose(deal, bookings) {
  const st = dealState(deal);
  const finalPrice = st.current?.price ?? null;
  const open = bookings.filter((b) => b.status_c === 'Booked');
  const updates = open.map((b) => {
    const homes = Number(b.homes_c || 1);
    if (st.unlocked) {
      const refund = Math.max(0, (Number(b.unitPrice_c || 0) - finalPrice) * homes);
      return {
        Id: b.Id,
        status_c: 'Confirmed',
        finalPrice_c: finalPrice,
        refundDue_c: refund,
        refundStatus_c: refund > 0 ? 'Due' : 'None',
      };
    }
    return {
      Id: b.Id,
      status_c: 'Failed',
      finalPrice_c: null,
      refundDue_c: Number(b.amountPaid_c || 0),
      refundStatus_c: 'Due',
    };
  });
  const totalRefund = updates.reduce((s, u) => s + Number(u.refundDue_c || 0), 0);
  return {
    unlocked: st.unlocked,
    finalPrice,
    updates,
    totalRefund,
    dealStatus: st.unlocked ? 'Closed' : 'Failed',
  };
}

export function newBookingRef() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `LM-${n}`;
}

export function demoPaymentRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return `demo_pay_${out}`;
}

// Can one neighbour book this deal more than once? Set per deal; these are the defaults.
export const REPEAT_DEFAULT = { Health: true, AC: true, Products: true, Cleaning: false, Pest: false, Solar: false };

/** Swap in the team's categories (called by services/categories.js). Keeps the same objects so imports stay live. */
export function applyCategories(rows) {
  if (!rows?.length) return;
  CATEGORY_VALUES.length = 0;
  for (const k of Object.keys(CATEGORY_META)) delete CATEGORY_META[k];
  for (const k of Object.keys(REPEAT_DEFAULT)) delete REPEAT_DEFAULT[k];
  for (const k of Object.keys(SCHEDULE_DEFAULTS)) delete SCHEDULE_DEFAULTS[k];
  for (const r of rows) {
    const key = r.key_c;
    if (!key) continue;
    CATEGORY_META[key] = { label: r.Name, icon: r.icon_c || 'Tag' };
    REPEAT_DEFAULT[key] = Number(r.repeat_c) === 1;
    SCHEDULE_DEFAULTS[key] = [r.fulfilment_c || 'service', r.schedule_c || 'date'];
    if (r.status_c !== 'Retired') CATEGORY_VALUES.push(key);
  }
}
export const allowsRepeat = (deal) =>
  deal?.allowRepeat_c === null || deal?.allowRepeat_c === undefined || deal?.allowRepeat_c === ''
    ? Boolean(REPEAT_DEFAULT[deal?.category_c])
    : Number(deal.allowRepeat_c) === 1;


// ---- Delivery and scheduling ----
// fulfilment: 'service' (done at the home), 'delivery' (brought to the home), 'pickup' (collected from the vendor)
// or 'both' (the buyer chooses delivery or pickup at checkout)
// schedule: 'none' (vendor calls to fix a time), 'date' (pick a day), 'datetime' (a day and a time slot)
export const SCHEDULE_DEFAULTS = {
  Health: ['service', 'datetime'],
  Cleaning: ['service', 'date'],
  Pest: ['service', 'date'],
  AC: ['service', 'date'],
  Solar: ['service', 'none'],
  Products: ['delivery', 'none'],
};
export const DEFAULT_SLOTS = 'Morning, 8 am to 12 pm\nAfternoon, 12 pm to 4 pm\nEvening, 4 pm to 8 pm';

export const dealFulfilment = (deal) =>
  ['service', 'delivery', 'pickup', 'both'].includes(deal?.fulfilment_c) ? deal.fulfilment_c : SCHEDULE_DEFAULTS[deal?.category_c]?.[0] ?? 'service';
/** What one booking does: 'service', 'delivery' or 'pickup'. A 'both' deal follows the buyer's choice. */
export const bookingMode = (deal, booking) => {
  const f = dealFulfilment(deal);
  return f === 'both' ? (booking?.fulfilment_c === 'pickup' ? 'pickup' : 'delivery') : f;
};

/** Who can book: one community, one locality (houses and communities alike) or a whole city. */
export const dealReach = (deal) => (deal?.community_c?.Id ? 'community' : deal?.locality_c?.Id ? 'locality' : deal?.city_c?.Id ? 'city' : 'locality');

/** Short place label for cards and lists. */
export const dealWhere = (deal) => deal?.community_c?.Name ?? deal?.locality_c?.Name ?? (deal?.city_c?.Name ? `All of ${deal.city_c.Name}` : '');

/** The same in a sentence: who this deal is open to. */
export const dealOpenTo = (deal) => {
  const r = dealReach(deal);
  if (r === 'community') return `Only for ${deal.community_c.Name}`;
  if (r === 'city') return `Open to everyone in ${deal.city_c?.Name ?? 'the city'}`;
  return `Open to homes in ${deal?.locality_c?.Name ?? 'the locality'}, houses and communities alike`;
};

export const dealSchedule = (deal) =>
  ['none', 'date', 'datetime'].includes(deal?.schedule_c) ? deal.schedule_c : SCHEDULE_DEFAULTS[deal?.category_c]?.[1] ?? 'date';
export const dealSlots = (deal) =>
  String(deal?.timeSlots_c || DEFAULT_SLOTS)
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

const dayMonth = (iso, withDay) =>
  iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', withDay ? { weekday: 'long', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' }) : '';

/** When the deal's work happens, in a short line for people to read (the server writes the same). */
export function windowText(deal) {
  if (!deal?.serviceEnd_c) return '';
  return deal.serviceStart_c ? `between ${dayMonth(deal.serviceStart_c)} and ${dayMonth(deal.serviceEnd_c)}` : `by ${dayMonth(deal.serviceEnd_c)}`;
}

export function scheduleLine(booking, deal) {
  const fm = bookingMode(deal, booking);
  const delivery = fm === 'delivery';
  const pickup = fm === 'pickup';
  const at = pickup && deal?.pickupAddress_c ? ` at ${deal.pickupAddress_c}` : '';
  const mode = dealSchedule(deal);
  const win = windowText(deal);
  if (mode !== 'none' && booking?.preferredDate_c) {
    const slot = mode === 'datetime' && booking.preferredSlot_c ? `, ${booking.preferredSlot_c.charAt(0).toLowerCase()}${booking.preferredSlot_c.slice(1)}` : '';
    return `${delivery ? 'Delivery on ' : pickup ? 'Pickup on ' : ''}${dayMonth(booking.preferredDate_c, true)}${slot}${at}`;
  }
  if (mode !== 'none') return `${delivery ? 'Delivery any day' : pickup ? 'Pickup any day' : 'Any day'}${at}${win ? ` ${win}` : ''}. The vendor confirms the time with you.`;
  if (pickup) return `Pick up${at}${win ? ` ${win}` : ''}. The vendor will call to confirm.`;
  return delivery ? `Delivered${win ? ` ${win}` : ''}. The vendor will call before coming.` : `The vendor will call to fix a time${win ? ` ${win}` : ''}.`;
}

/** The WhatsApp message people send to their building group: says what is needed and what everyone gains. */
export function shareMessage(deal, st, url) {
  const closesOn = deal?.deadline_c ? new Date(deal.deadline_c).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
  const ask = !st.unlocked && st.toMin > 0
    ? `${st.toMin} more ${st.toMin === 1 ? 'neighbour' : 'neighbours'} needed for this to go ahead`
    : st.next
      ? `${st.toNext} more and we all pay ${inr(st.next.price)} instead of ${inr(st.current?.price)}`
      : `Best price reached: ${inr(st.current?.price)}`;
  return `${deal.Name}: ${st.booked} neighbours are in. ${ask}.${closesOn ? ` Closes ${closesOn}.` : ''} ${url}`;
}
