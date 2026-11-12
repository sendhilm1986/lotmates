import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CATEGORY_VALUES, categoryLabel, inr } from '@/services/dealRules';
import { unwrapList } from '@/services/records';

export const route = { path: '/vendors', layout: 'public', access: 'public' };

const WHO = [
  { icon: 'Sparkles', title: 'Home services', body: 'Deep cleaning, pest control, AC care, plumbing and other jobs done at people\'s homes.' },
  { icon: 'HeartPulse', title: 'Health at home', body: 'Diagnostic labs and clinics that offer home sample collection and checkups.' },
  { icon: 'Sun', title: 'Installers', body: 'Rooftop solar, water purifiers and other work that suits a whole building at once.' },
  { icon: 'Package', title: 'Local makers', body: 'Products made or sold locally that neighbours can buy together and get delivered.' },
];

const BENEFITS = [
  { icon: 'MapPin', title: 'Jobs close together', body: 'A deal runs in one community or locality, so your crew travels less between jobs.' },
  { icon: 'CalendarCheck', title: 'A full calendar before you start', body: 'You know how many homes booked, and when, before the service window opens. You set the capacity.' },
  { icon: 'BadgeIndianRupee', title: 'Paid upfront by neighbours', body: 'Neighbours pay Lotmates when they book, so there\'s no chasing payments at the door.' },
  { icon: 'Megaphone', title: 'No ads to buy', body: 'Lotmates and community ambassadors bring the neighbours. You pay commission only on completed jobs.' },
];

const DEAL_STEPS = [
  { title: 'Agree the deal', body: 'With our team, set the price tiers, the minimum homes, your capacity, the service window and what\'s included.' },
  { title: 'Neighbours book and pay', body: 'The price drops as more homes join. Everyone pays the first price, and gets the difference back at close.' },
  { title: 'The deal closes', body: 'If enough homes booked, it goes ahead at the final price. If not, every neighbour is refunded and there\'s no job.' },
  { title: 'You do the jobs', body: 'Serve every booking at the final price, within the window. Mark each job done with photos.' },
  { title: 'You get paid weekly', body: 'After a 7-day complaint window, each job goes into the next weekly payout to your verified bank account.' },
];

const CHECKS = [
  { icon: 'IdCard', title: 'ID proof', body: 'For the owner of the business.' },
  { icon: 'FileBadge', title: 'Licences', body: 'Whatever your trade needs by law.' },
  { icon: 'MessagesSquare', title: 'References', body: 'From customers you\'ve served before.' },
  { icon: 'ClipboardCheck', title: 'A test job', body: 'Done and checked before any deal goes live.' },
  { icon: 'Landmark', title: 'Bank account', body: 'Verified, for your weekly payouts.' },
];

const STANDARDS = [
  'Bring ID and send verified crew to every home.',
  'Use safe materials and follow the law for your trade.',
  'Give each customer a proper invoice, with GST if you\'re registered.',
  'Use customer details only to do the job. Don\'t market to them or move bookings off Lotmates.',
];

const FAQ = [
  ['Do I set my own prices?', 'Yes. You agree the price tiers with our team before a deal goes live, including the lowest price you\'re willing to reach for a full deal.'],
  ['What does it cost?', 'Lotmates charges a commission on the final price of each completed job, agreed before the deal goes live and shown in your portal. GST applies to the commission. Neighbours never pay Lotmates a fee.'],
  ['When do I get paid?', 'When you mark a job done with photos, a 7-day complaint window starts. After it, the job goes into the next weekly payout, minus commission and any refunds from upheld complaints.'],
  ['What if not enough homes book?', 'The deal doesn\'t go ahead. Every neighbour gets a full refund, and you don\'t do any jobs or pay anything.'],
  ['What is probation?', 'Every new vendor starts on probation, with smaller first deals. Once your jobs and ratings show the standard, you move to active.'],
  ['Do I need to be GST-registered to apply?', 'No. If you are registered, add your GSTIN, and include GST on the invoices you give customers.'],
  ['Can I leave?', 'Yes, with 30 days\' notice. Jobs already booked must still be completed or refunded.'],
];

function SectionTitle({ children, sub, className }) {
  return (
    <div className={cn('max-w-2xl', className)}>
      <h2 className="font-heading text-[2rem] font-bold leading-[1.05] tracking-tight text-foreground md:text-5xl">{children}</h2>
      {sub && <p className="mt-4 text-base text-muted-foreground md:text-lg">{sub}</p>}
    </div>
  );
}

export default function BecomeVendor() {
  const user = useSelector((s) => s.user.user);
  const isVendor = user?.profile === 'Vendor_c';

  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="px-5 pt-10 md:px-8 md:pt-16">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <ApperIcon name="Store" size={15} />
              For local businesses
            </p>
            <h1 className="mt-5 font-heading text-[2.6rem] font-bold leading-[0.98] tracking-tight text-primary md:text-[4.25rem]">
              Fill your calendar, one community at a time.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground md:text-xl">
              Neighbours book your service together, the price drops for everyone, and you get a batch of paid jobs in one area.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {isVendor ? (
                <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                  <Link to="/vendor">Go to your portal</Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                  <a href="#apply">Apply to run deals</a>
                </Button>
              )}
              <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-6 text-base">
                <Link to="/legal/vendors">Read the vendor terms</Link>
              </Button>
            </div>
          </div>
          <ExampleCard />
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto max-w-6xl">
          <SectionTitle sub="Established local businesses that can serve many homes in one area, to a standard neighbours will vouch for.">Who it&apos;s for</SectionTitle>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHO.map((w) => (
              <li key={w.title} className="rounded-[22px] bg-card p-6 shadow-sm">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ApperIcon name={w.icon} size={20} />
                </span>
                <h3 className="mt-4 font-heading text-lg font-bold leading-snug text-foreground">{w.title}</h3>
                <p className="mt-1.5 text-[15px] leading-6 text-muted-foreground">{w.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Benefits */}
      <section className="mt-24 bg-primary px-5 py-20 text-primary-foreground md:mt-32 md:px-8 md:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl font-heading text-[2rem] font-bold leading-[1.05] tracking-tight md:text-5xl">Why vendors run deals here</h2>
          <ul className="mt-12 grid gap-8 md:grid-cols-2 md:gap-x-14 md:gap-y-12">
            {BENEFITS.map((b) => (
              <li key={b.title} className="border-t-2 border-primary-foreground/25 pt-6">
                <ApperIcon name={b.icon} size={26} className="text-highlight" />
                <h3 className="mt-4 font-heading text-xl font-bold leading-tight md:text-2xl">{b.title}</h3>
                <p className="mt-2 text-base text-primary-foreground/80">{b.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How a deal works */}
      <section className="px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <SectionTitle sub="Every deal follows the same steps, so you always know what's booked and when you're paid.">How a deal works</SectionTitle>
          <Steps items={DEAL_STEPS} />
        </div>
      </section>

      {/* Commission and payments */}
      <section className="px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto max-w-6xl">
          <SectionTitle sub="Simple, and agreed with you before any deal goes live.">Commission and payments</SectionTitle>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { icon: 'Percent', title: 'Commission on completed jobs', body: 'A rate agreed per deal, on the final price of each completed job, shown in your portal. GST applies to the commission. Nothing to pay if a deal doesn\'t go ahead.' },
              { icon: 'ShieldCheck', title: 'Neighbours pay us upfront', body: 'Every booking is paid through Razorpay when it\'s made. You never collect cash, and refunds to neighbours are handled by Lotmates.' },
              { icon: 'CalendarClock', title: 'Weekly payouts', body: 'Mark a job done with photos. After a 7-day complaint window, it\'s paid in the next weekly payout, minus commission and any upheld complaints.' },
            ].map((c) => (
              <div key={c.title} className="rounded-[22px] bg-card p-6 shadow-sm">
                <ApperIcon name={c.icon} size={24} className="text-primary" />
                <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{c.title}</h3>
                <p className="mt-1.5 text-[15px] leading-6 text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Checks */}
      <section className="px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <SectionTitle sub="Neighbours let you into their homes because Lotmates checked you first. Every vendor goes through the same checks, and is reviewed by a person.">How we check every vendor</SectionTitle>
              <div className="mt-8 rounded-[22px] border border-highlight/60 bg-highlight/15 p-5">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <ApperIcon name="Hourglass" size={18} />
                  You start on probation
                </p>
                <p className="mt-2 text-[15px] leading-6 text-foreground">New vendors run smaller first deals. Once your jobs and ratings show the standard, you move to active.</p>
              </div>
            </div>
            <div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {CHECKS.map((c) => (
                  <li key={c.title} className="flex gap-3 rounded-2xl bg-card p-4 shadow-sm">
                    <span className="flex size-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ApperIcon name={c.icon} size={18} />
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{c.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <h3 className="mt-8 font-heading text-lg font-bold text-foreground">The standard on every job</h3>
              <ul className="mt-3 space-y-2.5">
                {STANDARDS.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[15px] text-foreground">
                    <ApperIcon name="Check" size={18} className="mt-0.5 flex-none text-primary" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Joining */}
      <section className="px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <SectionTitle sub="Your vendor account is set up only after the checks are done and we've approved you.">How joining works</SectionTitle>
          <Steps
            items={[
              { title: 'Apply', body: 'Tell us about your business in the form below. It takes about ten minutes.' },
              { title: 'We get in touch', body: 'Someone from the team calls or emails you to understand your work, prices and capacity.' },
              { title: 'Checks', body: 'Share your ID, licences, references and bank details, and do a test job that we check.' },
              { title: 'Approval', body: 'Once every check passes, we approve you and email a link to set up your vendor account.' },
              { title: 'Your first deal', body: 'Plan your first, smaller deal with our team, on probation.' },
            ]}
          />
        </div>
      </section>

      {/* Form */}
      <section id="apply" className="scroll-mt-20 px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto max-w-6xl rounded-[28px] bg-card p-6 shadow-sm md:p-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div>
              <h2 className="font-heading text-[2rem] font-bold leading-[1.05] tracking-tight text-foreground md:text-[2.75rem]">Apply to run deals</h2>
              <p className="mt-4 text-base text-muted-foreground md:text-lg">Tell us about your business. We&apos;ll get in touch before anything is set up.</p>
              <ul className="mt-8 space-y-3 text-[15px] text-foreground">
                {['Read by a person on the Lotmates team', 'No account is created until you pass the checks', 'You share documents during the checks, not in this form'].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <ApperIcon name="Check" size={18} className="mt-0.5 flex-none text-primary" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            {isVendor ? (
              <div className="rounded-[22px] bg-primary/[0.07] p-6">
                <p className="font-heading text-xl font-bold text-foreground">You&apos;re already a Lotmates vendor</p>
                <p className="mt-2 text-muted-foreground">Your jobs, deals and payouts are in your portal.</p>
                <Button asChild className="mt-5">
                  <Link to="/vendor">Go to your portal</Link>
                </Button>
              </div>
            ) : (
              <ApplyForm />
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto max-w-3xl">
          <SectionTitle>Questions</SectionTitle>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  {q}
                  <ApperIcon name="Plus" size={20} className="flex-none text-muted-foreground transition-transform duration-200 group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-[15px] text-muted-foreground">
            The full rules are in the <Link to="/legal/vendors" className="font-medium text-primary underline-offset-2 hover:underline">vendor terms</Link>, along with our <Link to="/legal/terms" className="font-medium text-primary underline-offset-2 hover:underline">terms of use</Link> and <Link to="/legal/privacy" className="font-medium text-primary underline-offset-2 hover:underline">privacy policy</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}

function Steps({ items }) {
  return (
    <ol>
      {items.map((s, i) => (
        <li key={s.title} className="relative flex gap-4 pb-8 last:pb-0">
          {i < items.length - 1 && <span aria-hidden className="absolute left-[19px] top-11 h-[calc(100%-2.75rem)] w-0.5 rounded-full bg-border" />}
          <span className="flex size-10 flex-none items-center justify-center rounded-full bg-primary font-heading text-base font-bold text-primary-foreground">{i + 1}</span>
          <div className="pt-1.5">
            <h3 className="font-heading text-lg font-bold text-foreground">{s.title}</h3>
            <p className="mt-1 text-[15px] leading-6 text-muted-foreground">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** One deal, made concrete. */
function ExampleCard() {
  const homes = 40;
  const price = 2899;
  return (
    <div className="rounded-[28px] bg-card p-6 shadow-[0_24px_60px_-24px_rgb(15_42_32/0.35)] md:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Example: one deal, one community</p>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Illustrative</span>
      </div>
      <p className="mt-3 font-heading text-xl font-bold text-foreground">Deep cleaning, 2BHK</p>
      <dl className="mt-5 space-y-3 text-[15px]">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Homes booked, paid upfront</dt>
          <dd className="tabular-nums text-foreground">{homes} homes</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Final price the deal reached</dt>
          <dd className="tabular-nums text-foreground">{inr(price)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Where</dt>
          <dd className="text-right text-foreground">One apartment complex</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <dt className="font-medium text-foreground">Jobs booked</dt>
          <dd className="rounded-lg bg-highlight px-2.5 py-1 font-heading text-2xl font-bold tabular-nums text-highlight-foreground">{inr(homes * price)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">Paid out weekly as jobs are done, minus the commission agreed for the deal.</p>
    </div>
  );
}

const BLANK = {
  business: '', name: '', email: '', phone: '', category: '', newCategory: '', localityIds: [], areasOther: '',
  years: '', teamSize: '', capacity: '', gstin: '', website: '', services: '', licences: '', contactPref: 'Phone', agreed: false, website_hp: '',
};

function ApplyForm() {
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  const user = useSelector((s) => s.user.user);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  const { data: localities } = useFetch(() => sdk.table('localities_c').select(['Name', 'status_c', 'city_c']).orderBy('Name').page(1, 200).fetch().then(unwrapList), []);

  useEffect(() => {
    if (!user) return;
    sdk.account.get().then((r) => {
      const me = r.ok ? r.value : null;
      if (!me) return;
      setForm((f) => ({
        ...f,
        name: f.name || [me.firstName, me.lastName].filter(Boolean).join(' '),
        email: f.email || me.email || '',
        phone: f.phone || me.phone || '',
      }));
    });
  }, [user]);

  const toggleArea = (id) =>
    setForm((f) => ({ ...f, localityIds: f.localityIds.includes(id) ? f.localityIds.filter((x) => x !== id) : [...f.localityIds, id] }));

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.business.trim()) errs.business = 'Add your business name';
    if (!form.name.trim()) errs.name = 'Add your name';
    if (!/^\+?[\d\s-]{10,16}$/.test(form.phone.trim())) errs.phone = 'Enter a 10-digit phone number, e.g. 98765 43210';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = 'Enter a valid email address';
    if (!form.category) errs.category = 'Pick what you offer';
    if (form.category === 'Other' && !form.newCategory.trim()) errs.newCategory = 'Name the service or product';
    if (!form.localityIds.length && !form.areasOther.trim()) errs.areas = 'Pick the areas you serve, or add them below';
    if (form.services.trim().length < 20) errs.services = 'Tell us a little more, in a sentence or two';
    if (form.gstin.trim() && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(form.gstin.replace(/\s+/g, ''))) errs.gstin = 'A GSTIN has 15 characters, like 33ABCDE1234F1Z5';
    if (!form.agreed) errs.agreed = "Please confirm you've read the vendor terms";
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector(`[data-field="${Object.keys(errs)[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSending(true);
    try {
      const num = (v) => (v === '' ? null : Number(v));
      const r = await sdk.vendorApps.apply({ ...form, years: num(form.years), teamSize: num(form.teamSize), capacity: num(form.capacity) });
      if (!r.ok) {
        setErrors({ form: r.error.message });
        return;
      }
      setDone({ updated: Boolean(r.value?.data?.updated), email: form.email.trim(), contact: form.contactPref });
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-[22px] bg-primary/[0.07] p-6 md:p-8" role="status">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ApperIcon name="Check" size={24} />
        </span>
        <p className="mt-5 font-heading text-2xl font-bold text-foreground">{done.updated ? 'Application updated' : 'Application sent'}</p>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">
          {done.updated ? 'We already had an application from this email, so we updated it with these details.' : `Thanks. We've emailed a copy to ${done.email}.`}{' '}
          Someone from the team will get in touch {done.contact === 'Email' ? 'by email' : 'by phone'} about your business and the checks.
        </p>
      </div>
    );
  }

  const field = 'h-12 rounded-xl bg-background text-base';
  const err = (k) => errors[k] && <p className="mt-1.5 text-sm text-destructive">{errors[k]}</p>;
  const label = 'mb-2 block text-[15px] font-medium text-foreground';
  const optional = <span className="font-normal text-muted-foreground">(optional)</span>;
  const group = 'grid gap-6 border-t border-border pt-6';

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="ven-hp">Website</label>
        <input id="ven-hp" tabIndex={-1} autoComplete="off" value={form.website_hp} onChange={set('website_hp')} />
      </div>

      <p className="font-heading text-lg font-bold text-foreground">Your business</p>
      <div data-field="business">
        <label htmlFor="ven-business" className={label}>Business name</label>
        <Input id="ven-business" className={field} value={form.business} onChange={set('business')} autoComplete="organization" />
        {err('business')}
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div data-field="category">
          <label htmlFor="ven-category" className={label}>What you offer</label>
          <Select value={form.category} onValueChange={set('category')}>
            <SelectTrigger id="ven-category" className="!h-12 w-full rounded-xl bg-background text-base"><SelectValue placeholder="Choose one" /></SelectTrigger>
            <SelectContent>
              {CATEGORY_VALUES.map((c) => (
                <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
              ))}
              <SelectItem value="Other">Something else</SelectItem>
            </SelectContent>
          </Select>
          {err('category')}
        </div>
        {form.category === 'Other' ? (
          <div data-field="newCategory">
            <label htmlFor="ven-newcat" className={label}>Which service or product?</label>
            <Input id="ven-newcat" className={field} value={form.newCategory} onChange={set('newCategory')} placeholder="e.g. Water tank cleaning" maxLength={80} />
            {err('newCategory')}
          </div>
        ) : (
          <div>
            <label htmlFor="ven-years" className={label}>Years in business {optional}</label>
            <Input id="ven-years" type="number" min={0} inputMode="numeric" className={field} value={form.years} onChange={set('years')} placeholder="e.g. 6" />
          </div>
        )}
      </div>
      <div data-field="services">
        <label htmlFor="ven-services" className={label}>What you do, and for whom</label>
        <Textarea id="ven-services" rows={4} className="rounded-xl bg-background text-base" value={form.services} onChange={set('services')} maxLength={2000} placeholder="e.g. Deep cleaning for apartments and villas, with our own equipment. Usual price for a 2BHK is ₹3,500." />
        {err('services')}
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {form.category === 'Other' && (
          <div>
            <label htmlFor="ven-years2" className={label}>Years in business {optional}</label>
            <Input id="ven-years2" type="number" min={0} inputMode="numeric" className={field} value={form.years} onChange={set('years')} placeholder="e.g. 6" />
          </div>
        )}
        <div>
          <label htmlFor="ven-team" className={label}>People on your team {optional}</label>
          <Input id="ven-team" type="number" min={1} inputMode="numeric" className={field} value={form.teamSize} onChange={set('teamSize')} placeholder="e.g. 8" />
        </div>
        <div>
          <label htmlFor="ven-capacity" className={label}>Homes you can serve a week {optional}</label>
          <Input id="ven-capacity" type="number" min={1} inputMode="numeric" className={field} value={form.capacity} onChange={set('capacity')} placeholder="e.g. 30" />
        </div>
      </div>

      <div className={group} data-field="areas">
        <div>
          <p className={label}>Areas you serve</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Areas you serve">
            {(localities ?? []).map((l) => {
              const on = form.localityIds.includes(String(l.Id));
              return (
                <button
                  key={l.Id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleArea(String(l.Id))}
                  className={cn(
                    'inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:border-foreground/30',
                  )}
                >
                  {on && <ApperIcon name="Check" size={14} />}
                  {l.Name}
                </button>
              );
            })}
          </div>
          <Input className={cn(field, 'mt-3')} value={form.areasOther} onChange={set('areasOther')} placeholder="Other areas, e.g. Kovaipudur, Saravanampatti" maxLength={200} aria-label="Other areas" />
          {err('areas')}
        </div>
      </div>

      <div className={group}>
        <div className="grid gap-6 sm:grid-cols-2">
          <div data-field="gstin">
            <label htmlFor="ven-gstin" className={label}>GSTIN {optional}</label>
            <Input id="ven-gstin" className={cn(field, 'uppercase')} value={form.gstin} onChange={set('gstin')} placeholder="33ABCDE1234F1Z5" maxLength={20} />
            {err('gstin')}
          </div>
          <div>
            <label htmlFor="ven-site" className={label}>Website or social page {optional}</label>
            <Input id="ven-site" type="url" className={field} value={form.website} onChange={set('website')} placeholder="https://" />
          </div>
        </div>
        <div>
          <label htmlFor="ven-licences" className={label}>Licences and registrations {optional}</label>
          <Textarea id="ven-licences" rows={3} className="rounded-xl bg-background text-base" value={form.licences} onChange={set('licences')} maxLength={1000} placeholder="e.g. Pest control licence from the state agriculture department" />
          <p className="mt-1.5 text-sm text-muted-foreground">Just list them. You&apos;ll share the documents during the checks, not here.</p>
        </div>
      </div>

      <div className={group}>
        <p className="font-heading text-lg font-bold text-foreground">You</p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div data-field="name">
            <label htmlFor="ven-name" className={label}>Your name</label>
            <Input id="ven-name" className={field} value={form.name} onChange={set('name')} autoComplete="name" />
            {err('name')}
          </div>
          <div data-field="phone">
            <label htmlFor="ven-phone" className={label}>Phone</label>
            <Input id="ven-phone" type="tel" inputMode="tel" className={field} value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="98765 43210" />
            {err('phone')}
          </div>
        </div>
        <div data-field="email">
          <label htmlFor="ven-email" className={label}>Email</label>
          <Input id="ven-email" type="email" className={field} value={form.email} onChange={set('email')} autoComplete="email" />
          {err('email')}
        </div>
        <fieldset>
          <legend className={label}>How should we reach you?</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-3">
            {[
              { v: 'Phone', icon: 'Phone', label: 'Phone call' },
              { v: 'Email', icon: 'Mail', label: 'Email' },
            ].map((o) => {
              const on = form.contactPref === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setForm((f) => ({ ...f, contactPref: o.v }))}
                  className={cn(
                    'flex h-12 items-center justify-center gap-2 rounded-xl border text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    on ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-background text-foreground hover:border-foreground/30',
                  )}
                >
                  <ApperIcon name={o.icon} size={17} />
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div data-field="agreed">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4">
          <input type="checkbox" checked={form.agreed} onChange={set('agreed')} className="mt-1 size-4 flex-none accent-primary" />
          <span className="text-[15px] leading-6 text-foreground">
            I&apos;ve read the <Link to="/legal/vendors" target="_blank" className="font-medium text-primary underline underline-offset-2">vendor terms</Link>, including the checks, commission and payouts, and the <Link to="/legal/privacy" target="_blank" className="font-medium text-primary underline underline-offset-2">privacy policy</Link>.
          </span>
        </label>
        {err('agreed')}
      </div>

      {errors.form && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">{errors.form}</p>}

      <button
        type="submit"
        disabled={sending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-80"
      >
        {sending ? <ApperIcon name="LoaderCircle" size={18} className="animate-spin" /> : <ApperIcon name="Send" size={18} />}
        {sending ? 'Sending…' : 'Send application'}
      </button>
    </form>
  );
}
