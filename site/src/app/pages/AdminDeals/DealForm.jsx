import { useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { loadCategories } from '@/services/categories';
import ApperIcon from '@/components/ApperIcon';
import LookupPicker from '@/components/LookupPicker';
import PhotoManager from '@/components/PhotoManager';
import { parseVideo } from '@/services/dealMedia';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORY_VALUES, DEAL_STATUS, categoryLabel, allowsRepeat, REPEAT_DEFAULT, SCHEDULE_DEFAULTS, DEFAULT_SLOTS, dealFulfilment, dealSchedule } from '@/services/dealRules';
import { cn } from '@/lib/utils';

const { eq } = window.ApperSDK.CoreSDK;

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const str = (v) => (v === null || v === undefined ? '' : String(v));

export function dealToForm(deal) {
  return {
    Name: deal?.Name ?? '',
    category_c: deal?.category_c ?? 'Cleaning',
    vendor_c: deal?.vendor_c?.Id ?? deal?.vendor_c ?? null,
    locality_c: deal?.locality_c?.Id ?? deal?.locality_c ?? null,
    community_c: deal?.community_c?.Id ?? deal?.community_c ?? null,
    city_c: deal?.city_c?.Id ?? deal?.city_c ?? null,
    reach: deal?.community_c ? 'community' : deal?.city_c && !deal?.locality_c ? 'city' : 'locality',
    pickupAddress_c: deal?.pickupAddress_c ?? '',
    description_c: deal?.description_c ?? '',
    unit_c: deal?.unit_c ?? 'per home',
    regularPrice_c: str(deal?.regularPrice_c),
    tier1Max_c: str(deal?.tier1Max_c),
    tier1Price_c: str(deal?.tier1Price_c),
    tier2Max_c: str(deal?.tier2Max_c),
    tier2Price_c: str(deal?.tier2Price_c),
    tier3Max_c: str(deal?.tier3Max_c),
    tier3Price_c: str(deal?.tier3Price_c),
    tier4Max_c: str(deal?.tier4Max_c),
    tier4Price_c: str(deal?.tier4Price_c),
    minHomes_c: str(deal?.minHomes_c ?? 10),
    capacity_c: str(deal?.capacity_c ?? 40),
    commission_c: str(deal?.commission_c ?? 15),
    round_c: str(deal?.round_c ?? 1),
    deadline_c: toLocalInput(deal?.deadline_c),
    serviceStart_c: deal?.serviceStart_c ?? '',
    serviceEnd_c: deal?.serviceEnd_c ?? '',
    status_c: deal?.status_c ?? 'Draft',
    allowRepeat_c: allowsRepeat(deal ?? { category_c: 'Cleaning' }) ? '1' : '0',
    gallery_c: Array.isArray(deal?.gallery_c) ? deal.gallery_c : [],
    video_c: deal?.video_c ?? '',
    fulfilment_c: dealFulfilment(deal ?? { category_c: 'Cleaning' }),
    schedule_c: dealSchedule(deal ?? { category_c: 'Cleaning' }),
    timeSlots_c: deal?.timeSlots_c || DEFAULT_SLOTS,
    slotCapacity_c: str(deal?.slotCapacity_c),
  };
}

const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

export function formToPayload(form) {
  return {
    Name: form.Name.trim(),
    category_c: form.category_c,
    vendor_c: form.vendor_c || null,
    locality_c: form.reach === 'city' ? null : form.locality_c || null,
    community_c: form.reach === 'community' ? form.community_c || null : null,
    city_c: form.reach === 'city' ? form.city_c || null : null,
    pickupAddress_c: ['pickup', 'both'].includes(form.fulfilment_c) ? form.pickupAddress_c.trim() || null : null,
    description_c: form.description_c.trim() || null,
    unit_c: form.unit_c.trim() || 'per home',
    regularPrice_c: numOrNull(form.regularPrice_c),
    tier1Max_c: numOrNull(form.tier1Max_c),
    tier1Price_c: numOrNull(form.tier1Price_c),
    tier2Max_c: numOrNull(form.tier2Max_c),
    tier2Price_c: numOrNull(form.tier2Price_c),
    tier3Max_c: numOrNull(form.tier3Max_c),
    tier3Price_c: numOrNull(form.tier3Price_c),
    tier4Max_c: numOrNull(form.tier4Max_c),
    tier4Price_c: numOrNull(form.tier4Price_c),
    minHomes_c: numOrNull(form.minHomes_c),
    capacity_c: numOrNull(form.capacity_c),
    commission_c: numOrNull(form.commission_c),
    round_c: numOrNull(form.round_c),
    deadline_c: form.deadline_c ? new Date(form.deadline_c).toISOString() : null,
    serviceStart_c: form.serviceStart_c || null,
    serviceEnd_c: form.serviceEnd_c || null,
    status_c: form.status_c,
    allowRepeat_c: Number(form.allowRepeat_c) === 1 ? 1 : 0,
    gallery_c: (form.gallery_c ?? []).map((g) => ({ id: g.id, caption: (g.caption ?? '').trim() })),
    video_c: (form.video_c ?? '').trim() || null,
    fulfilment_c: form.fulfilment_c,
    schedule_c: form.schedule_c,
    timeSlots_c: form.schedule_c === 'datetime' ? form.timeSlots_c.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).join('\n') : form.timeSlots_c,
    slotCapacity_c: form.schedule_c === 'none' ? null : numOrNull(form.slotCapacity_c),
  };
}

export function validateDeal(form, mode = 'admin') {
  const e = {};
  if (!form.Name.trim()) e.Name = 'Give the deal a title neighbours will recognise';
  if (mode === 'admin' && !form.vendor_c) e.vendor_c = 'Pick the vendor delivering this deal';
  if (form.reach === 'city' && !form.city_c) e.city_c = 'Pick the city';
  if (form.reach !== 'city' && !form.locality_c) e.locality_c = 'Pick the locality';
  if (form.reach === 'community' && !form.community_c) e.community_c = 'Pick the community';
  if (['pickup', 'both'].includes(form.fulfilment_c) && !String(form.pickupAddress_c ?? '').trim()) e.pickupAddress_c = 'Add the address buyers collect from';
  const tiers = [1, 2, 3, 4]
    .map((n) => ({ n, max: numOrNull(form[`tier${n}Max_c`]), price: numOrNull(form[`tier${n}Price_c`]) }))
    .filter((t) => t.max !== null || t.price !== null);
  if (!tiers.length || tiers[0].n !== 1) e.tiers = 'Tier 1 needs a size and a price';
  for (let i = 0; i < tiers.length; i += 1) {
    const t = tiers[i];
    if (t.max === null || t.price === null) e.tiers = `Tier ${t.n} needs both a size and a price`;
    if (i > 0 && t.max !== null && tiers[i - 1].max !== null && t.max <= tiers[i - 1].max) e.tiers = `Tier ${t.n} must go up to more than tier ${tiers[i - 1].n}`;
    if (i > 0 && t.price !== null && tiers[i - 1].price !== null && t.price >= tiers[i - 1].price) e.tiers = `Tier ${t.n} must be cheaper than tier ${tiers[i - 1].n}`;
    if (t.n !== i + 1) e.tiers = 'Fill tiers in order without gaps';
  }
  const min = numOrNull(form.minHomes_c);
  const cap = numOrNull(form.capacity_c);
  if (!min || min < 1) e.minHomes_c = 'Set a minimum of at least 1';
  if (cap !== null && min !== null && cap < min) e.capacity_c = 'Capacity cannot be below the minimum';
  if (form.status_c === 'Live' && !form.deadline_c) e.deadline_c = 'A live deal needs a closing time';
  if (form.serviceStart_c && form.serviceEnd_c && form.serviceEnd_c < form.serviceStart_c) e.serviceEnd_c = 'Service must end after it starts';
  if ((form.video_c ?? '').trim() && !parseVideo(form.video_c)) e.video_c = 'Paste a YouTube or Vimeo link, e.g. https://youtu.be/…';
  if (form.schedule_c === 'datetime' && !form.timeSlots_c.split(/\r?\n/).some((x) => x.trim())) e.timeSlots_c = 'Add at least one time slot';
  if (form.schedule_c !== 'none' && form.slotCapacity_c !== '' && !(Number(form.slotCapacity_c) >= 1)) e.slotCapacity_c = 'Enter 1 or more, or leave empty for no limit';
  return e;
}

const STEPS = ['What', 'Price', 'Where', 'When'];
// Which step each validation message belongs to.
const STEP_FIELDS = [
  ['Name', 'vendor_c', 'video_c'],
  ['tiers', 'minHomes_c', 'capacity_c'],
  ['city_c', 'locality_c', 'community_c'],
  ['deadline_c', 'serviceEnd_c', 'pickupAddress_c', 'timeSlots_c', 'slotCapacity_c'],
];

function Field({ label, htmlFor, error, children, hint }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Section({ title, description, children, step, cur }) {
  return (
    <section hidden={step !== undefined && step !== cur} className="grid gap-4 [&[hidden]]:hidden rounded-[22px] bg-card shadow-sm p-5 shadow-sm md:grid-cols-[14rem_1fr]">
      <div>
        <h2 className="font-heading text-base font-bold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

export default function DealForm({ initial, saving, submitLabel, onSubmit, onCancel, mode = 'admin', actions }) {
  const vendorMode = mode === 'vendor';
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const [repeatTouched, setRepeatTouched] = useState(false);
  const [scheduleTouched, setScheduleTouched] = useState(Boolean(initial?.Name));
  // Until the team picks a repeat rule, it follows the category's default.
  const [suggesting, setSuggesting] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  async function suggestCategory() {
    setAddingCat(true);
    try {
      const res = await sdk.categories.suggest(newCat);
      if (!res.ok) return toast.error(res.error.message);
      const d = res.value?.data ?? res.value;
      await loadCategories(true);
      setCategory(d.key);
      setSuggesting(false);
      setNewCat('');
      toast.success(d.existing ? `${d.label} already exists, picked it for you` : `${d.label} sent to the team for approval. You can carry on with the deal.`);
    } finally {
      setAddingCat(false);
    }
  }
  const setCategory = (v) =>
    setForm((f) => ({
      ...f,
      category_c: v,
      ...(repeatTouched ? {} : { allowRepeat_c: REPEAT_DEFAULT[v] ? '1' : '0' }),
      ...(scheduleTouched ? {} : { fulfilment_c: SCHEDULE_DEFAULTS[v]?.[0] ?? 'service', schedule_c: SCHEDULE_DEFAULTS[v]?.[1] ?? 'date' }),
    }));
  const pick = (k) => (v) => {
    setScheduleTouched(true);
    setForm((f) => ({ ...f, [k]: v }));
  };
  const delivery = ['delivery', 'both'].includes(form.fulfilment_c);

  // The form is filled in four short steps. Editing an existing deal can jump between them freely.
  const editing = Boolean(initial?.Name);
  const [step, setStep] = useState(1);
  const stepOf = (key) => STEP_FIELDS.findIndex((keys) => keys.includes(key)) + 1 || 1;
  function toStep(n) {
    setStep(n);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
  function next() {
    const all = validateDeal(form, mode);
    const here = Object.fromEntries(Object.entries(all).filter(([k]) => stepOf(k) === step));
    setErrors(here);
    if (!Object.keys(here).length) toStep(step + 1);
  }

  // intent: 'save' keeps a draft; any other action also needs the deal to be complete (a closing time included).
  function go(intent = 'save') {
    const errs = validateDeal(form, mode);
    if (intent !== 'save' && !form.deadline_c) errs.deadline_c = 'Set when bookings close before this step';
    setErrors(errs);
    if (Object.keys(errs).length) {
      setStep(Math.min(...Object.keys(errs).map(stepOf)));
      requestAnimationFrame(() => document.querySelector('form [aria-invalid="true"], form .text-destructive')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      return;
    }
    onSubmit(formToPayload(form), intent);
  }
  function submit(e) {
    e.preventDefault();
    go('save');
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <ol className="grid grid-cols-4 gap-2" aria-label="Steps">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const can = editing || n <= step;
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!can}
                aria-current={step === n ? 'step' : undefined}
                onClick={() => toStep(n)}
                className={cn(
                  'flex w-full flex-col gap-1.5 rounded-xl px-1 py-1 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  step === n ? 'text-foreground' : can ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/50',
                )}
              >
                <span className={cn('h-1.5 rounded-full', n <= step ? 'bg-primary' : 'bg-border')} />
                <span className="truncate"><span className="tabular-nums">{n}.</span> {label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <Section step={1} cur={step} title="Basics" description="What neighbours see first.">
        <Field label="Deal title" htmlFor="df-name" error={errors.Name}>
          <Input id="df-name" value={form.Name} onChange={set('Name')} placeholder="e.g. Deep cleaning, 2BHK" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select value={form.category_c} onValueChange={(v) => (v === '__new' ? setSuggesting(true) : setCategory(v))}>
              <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[...new Set([...CATEGORY_VALUES, ...(form.category_c ? [form.category_c] : [])])].map((c) => (
                  <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                ))}
                {vendorMode && <SelectItem value="__new">+ Suggest a new category</SelectItem>}
              </SelectContent>
            </Select>
            {suggesting && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-3">
                <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Home appliances" aria-label="New category name" className="min-w-0 flex-1" />
                <Button type="button" size="sm" disabled={addingCat || newCat.trim().length < 3} onClick={suggestCategory}>{addingCat ? 'Adding…' : 'Add'}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSuggesting(false)}>Cancel</Button>
                <p className="w-full text-xs text-muted-foreground">The team checks the name before it goes live for everyone. Your deal can't open for bookings until they approve it.</p>
              </div>
            )}
          </Field>
        </div>
        {!vendorMode && (
          <Field label="Vendor" error={errors.vendor_c}>
            <LookupPicker table="vendors_c" searchField="Name" value={form.vendor_c} onChange={set('vendor_c')} placeholder="Choose a checked vendor" aria-label="Vendor" clearable />
          </Field>
        )}
      </Section>

      <Section step={1} cur={step} title="Photos and video" description="The first photo is the cover. Add up to 8 that show the work: the crew, the equipment, before and after. A short caption under each explains it.">
        <PhotoManager value={form.gallery_c} onChange={(v) => setForm((f) => ({ ...f, gallery_c: v }))} dealName={form.Name} />
        <Field label="Video (optional)" htmlFor="df-video" error={errors.video_c} hint="A YouTube or Vimeo link. It shows right after the cover photo. Leave empty if the deal doesn't need one.">
          <div className="flex items-center gap-3">
            <Input id="df-video" type="url" inputMode="url" value={form.video_c} onChange={set('video_c')} placeholder="https://youtu.be/…" className="flex-1" />
            {parseVideo(form.video_c)?.poster && <img src={parseVideo(form.video_c).poster} alt="Video preview" className="h-10 w-16 flex-none rounded-md object-cover" />}
          </div>
        </Field>
      </Section>

      <Section step={3} cur={step} title="Who can book" description="Choose how far this deal reaches.">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Who can book">
          {[
            ['community', 'One community', 'A single apartment complex or gated community.'],
            ['locality', 'A locality', 'Individual houses and communities in one area, like Kovaipudur.'],
            ['city', 'A whole city', 'Anyone in the city, like a wet grinder deal across Coimbatore.'],
          ].map(([v, title, hint]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={form.reach === v}
              onClick={() => setForm((f) => ({ ...f, reach: v }))}
              className={cn('rounded-xl border p-3.5 text-left transition-colors', form.reach === v ? 'border-primary bg-primary/[0.06] ring-1 ring-primary' : 'border-border hover:border-foreground/30')}
            >
              <span className="block text-sm font-medium text-foreground">{title}</span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {form.reach === 'city' ? (
            <Field label="City" error={errors.city_c}>
              <LookupPicker table="cities_c" searchField="Name" value={form.city_c} onChange={set('city_c')} placeholder="Choose a city" aria-label="City" clearable />
            </Field>
          ) : (
            <Field label="Locality" error={errors.locality_c}>
              <LookupPicker
                table="localities_c"
                searchField="Name"
                value={form.locality_c}
                onChange={(v) => setForm((f) => ({ ...f, locality_c: v, community_c: null }))}
                placeholder="Choose a locality"
                aria-label="Locality"
                clearable
              />
            </Field>
          )}
          {form.reach === 'community' && (
            <Field label="Community" error={errors.community_c}>
              <LookupPicker
                key={form.locality_c ?? 'none'}
                table="communities_c"
                searchField="Name"
                fetchParams={form.locality_c ? { filter: eq('locality_c', form.locality_c) } : undefined}
                value={form.community_c}
                onChange={set('community_c')}
                placeholder="Choose a community"
                aria-label="Community"
                disabled={!form.locality_c}
                clearable
              />
            </Field>
          )}
        </div>
      </Section>

      <Section step={1} cur={step} title="What's included" description="One line per item. Short and specific.">
        <Field label="What's included" htmlFor="df-desc">
          <Textarea id="df-desc" rows={4} value={form.description_c} onChange={set('description_c')} placeholder={'Full home deep clean by a 3-person crew\nKitchen degreasing and bathroom descaling'} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Priced per" htmlFor="df-unit">
            <Input id="df-unit" value={form.unit_c} onChange={set('unit_c')} placeholder="per home" />
          </Field>
          <Field label="Regular price (₹)" htmlFor="df-regular" hint="What a neighbour pays booking alone.">
            <Input id="df-regular" type="number" min={0} value={form.regularPrice_c} onChange={set('regularPrice_c')} placeholder="4000" />
          </Field>
        </div>
      </Section>

      <Section step={2} cur={step} title="Price tiers" description="Agreed with the vendor in writing. Each tier must be cheaper than the last.">
        <div className="grid gap-3">
          <div className="grid grid-cols-[4rem_1fr_1fr] gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Tier</span>
            <span>Up to (bookings)</span>
            <span>Price (₹)</span>
          </div>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="grid grid-cols-[4rem_1fr_1fr] items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">{n}</span>
              <Input type="number" min={1} value={form[`tier${n}Max_c`]} onChange={set(`tier${n}Max_c`)} placeholder={n === 1 ? '10' : 'optional'} aria-label={`Tier ${n} up to`} />
              <Input type="number" min={0} value={form[`tier${n}Price_c`]} onChange={set(`tier${n}Price_c`)} placeholder={n === 1 ? '3499' : 'optional'} aria-label={`Tier ${n} price`} />
            </div>
          ))}
          {errors.tiers && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <ApperIcon name="AlertCircle" size={14} />
              {errors.tiers}
            </p>
          )}
        </div>
      </Section>

      <Section step={2} cur={step} title="Rules" description="The minimum unlocks the deal. The cap protects the vendor's capacity.">
        <Field label="Repeat bookings" hint="Quantity on one booking always covers several homes, people or units.">
          <Select value={form.allowRepeat_c} onValueChange={(v) => { setRepeatTouched(true); set('allowRepeat_c')(v); }}>
            <SelectTrigger aria-label="Repeat bookings"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">One booking per home</SelectItem>
              <SelectItem value="1">Allow more than one booking</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Minimum to unlock" htmlFor="df-min" error={errors.minHomes_c}>
            <Input id="df-min" type="number" min={1} value={form.minHomes_c} onChange={set('minHomes_c')} placeholder="10" />
          </Field>
          <Field label="Capacity cap" htmlFor="df-cap" error={errors.capacity_c}>
            <Input id="df-cap" type="number" min={1} value={form.capacity_c} onChange={set('capacity_c')} placeholder="40" />
          </Field>
          {vendorMode ? (
            <p className="text-[13px] leading-5 text-muted-foreground sm:col-span-2">Lotmates commission: {form.commission_c || 15}%, paid by the vendor. The team confirms it when they review the deal.</p>
          ) : (
            <>
              <Field label="Commission %" htmlFor="df-comm">
                <Input id="df-comm" type="number" min={0} step="0.5" value={form.commission_c} onChange={set('commission_c')} placeholder="15" />
              </Field>
              <Field label="Round" htmlFor="df-round">
                <Input id="df-round" type="number" min={1} value={form.round_c} onChange={set('round_c')} placeholder="1" />
              </Field>
            </>
          )}
        </div>
      </Section>

      <Section step={4} cur={step} title="Dates and scheduling" description="When bookings close, when the work happens, and what neighbours choose at checkout.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Bookings close" htmlFor="df-deadline" error={errors.deadline_c}>
            <Input id="df-deadline" type="datetime-local" value={form.deadline_c} onChange={set('deadline_c')} />
          </Field>
          <Field label={delivery ? 'Deliveries from' : 'Service from'} htmlFor="df-start">
            <Input id="df-start" type="date" value={form.serviceStart_c} onChange={set('serviceStart_c')} />
          </Field>
          <Field label={delivery ? 'Deliveries until' : 'Service until'} htmlFor="df-end" error={errors.serviceEnd_c}>
            <Input id="df-end" type="date" value={form.serviceEnd_c} onChange={set('serviceEnd_c')} />
          </Field>
        </div>

        <Field label="What neighbours get">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="What neighbours get">
            {[
              ['service', 'A service at home', 'Done at the neighbour\'s home, like cleaning or a checkup.'],
              ['delivery', 'A product delivered', 'Brought to the door, like a grinder or solar kit.'],
              ['pickup', 'Pickup only', 'Buyers collect it from the vendor.'],
              ['both', 'Delivery or pickup', 'The buyer chooses at checkout.'],
            ].map(([v, title, hint]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={form.fulfilment_c === v}
                onClick={() => pick('fulfilment_c')(v)}
                className={cn('rounded-xl border p-3.5 text-left transition-colors', form.fulfilment_c === v ? 'border-primary bg-primary/[0.06] ring-1 ring-primary' : 'border-border hover:border-foreground/30')}
              >
                <span className="block text-sm font-medium text-foreground">{title}</span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
        </Field>

        {['pickup', 'both'].includes(form.fulfilment_c) && (
          <Field label="Pickup address" htmlFor="df-pickup" error={errors.pickupAddress_c} hint="Where buyers collect it. Shown to them on the deal and in their booking.">
            <Input id="df-pickup" value={form.pickupAddress_c} onChange={set('pickupAddress_c')} placeholder="e.g. Sri Murugan Appliances, 14 Avinashi Road, Coimbatore" />
          </Field>
        )}

        <Field label="At checkout, neighbours choose">
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="At checkout, neighbours choose">
            {[
              ['none', 'Nothing', delivery ? 'The vendor calls before delivering.' : 'The vendor calls to fix a time.'],
              ['date', 'A day', delivery ? 'They pick a delivery day.' : 'They pick a preferred day.'],
              ['datetime', 'A day and time', 'They pick a day and a time slot.'],
            ].map(([v, title, hint]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={form.schedule_c === v}
                onClick={() => pick('schedule_c')(v)}
                className={cn('rounded-xl border p-3.5 text-left transition-colors', form.schedule_c === v ? 'border-primary bg-primary/[0.06] ring-1 ring-primary' : 'border-border hover:border-foreground/30')}
              >
                <span className="block text-sm font-medium text-foreground">{title}</span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
        </Field>

        {form.schedule_c === 'datetime' && (
          <Field label="Time slots" htmlFor="df-slots" error={errors.timeSlots_c} hint="One per line, in the order they happen in the day.">
            <Textarea id="df-slots" rows={4} value={form.timeSlots_c} onChange={set('timeSlots_c')} placeholder={DEFAULT_SLOTS} />
          </Field>
        )}

        {form.schedule_c !== 'none' && (
          <Field
            label={form.schedule_c === 'datetime' ? 'Most the vendor can take in each time slot' : `Most the vendor can ${delivery ? 'deliver' : 'take'} in a day`}
            htmlFor="df-cap-slot"
            error={errors.slotCapacity_c}
            hint={`Counted in ${form.unit_c?.replace(/^per\s+/, '') || 'home'}s. Full ${form.schedule_c === 'datetime' ? 'slots' : 'days'} can't be picked, and neighbours must choose one. Leave empty for no limit.`}
          >
            <Input id="df-cap-slot" type="number" min={1} value={form.slotCapacity_c} onChange={set('slotCapacity_c')} placeholder="No limit" className="sm:max-w-[10rem]" />
          </Field>
        )}
      </Section>

      {step === 4 && !editing && (
        <section className="rounded-[22px] bg-primary/[0.05] p-5">
          <h2 className="font-heading text-base font-bold text-foreground">Check before you send</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ['Deal', form.Name || '—'],
              ['Category', categoryLabel(form.category_c)],
              ['Prices', [1, 2, 3, 4].filter((n) => form[`tier${n}Price_c`] !== '' && form[`tier${n}Price_c`] != null).map((n) => `₹${Number(form[`tier${n}Price_c`]).toLocaleString('en-IN')}`).join(' → ') || '—'],
              ['Goes ahead at', form.minHomes_c ? `${form.minHomes_c} bookings` : '—'],
              ['Open to', form.reach === 'city' ? 'A whole city' : form.reach === 'community' ? 'One community' : 'A locality'],
              ['Bookings close', form.deadline_c ? new Date(form.deadline_c).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Not set yet'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-border/60 py-1.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="sticky bottom-0 z-(--z-base) -mx-4 flex flex-wrap justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-(--radius) md:border">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving} className="mr-auto">Cancel</Button>
        {step > 1 && <Button type="button" variant="outline" onClick={() => toStep(step - 1)} disabled={saving}>Back</Button>}
        {step < 4 && <Button type="button" variant={editing ? 'outline' : 'default'} onClick={next} disabled={saving}>Next: {STEPS[step]}</Button>}
        {(step === 4 || editing) && (actions ?? [{ intent: 'save', label: submitLabel, variant: 'default' }]).map((a) => (
          <Button key={a.intent} type="button" variant={a.variant ?? 'default'} disabled={saving} onClick={() => go(a.intent)}>
            {saving ? (
              <>
                <ApperIcon name="LoaderCircle" size={16} className="animate-spin" />
                Saving…
              </>
            ) : a.label}
          </Button>
        ))}
      </div>
    </form>
  );
}
