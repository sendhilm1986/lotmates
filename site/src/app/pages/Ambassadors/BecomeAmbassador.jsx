import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { inr } from '@/services/dealRules';
import { AMBASSADOR_SHARE, APP_RELATIONS } from '@/services/records';

export const route = { path: '/ambassadors', layout: 'public', access: 'public' };

const SHARE_PCT = Math.round(AMBASSADOR_SHARE * 100);

const WHO = [
  { icon: 'MessageCircle', title: 'You run the group chat', body: 'The building or street WhatsApp group, or the notice board everyone reads.' },
  { icon: 'Users', title: 'You sit on the association', body: 'Committee members of a residents\' or owners\' association.' },
  { icon: 'Building2', title: 'You manage the estate', body: 'Building, estate or facility managers who look after many homes.' },
  { icon: 'Lightbulb', title: 'Neighbours ask you first', body: 'The person people turn to for a good plumber, a clinic or a fair price.' },
];

const BENEFITS = [
  { icon: 'Wallet', title: `${SHARE_PCT}% of our commission`, body: 'On every completed job in the communities you run, paid monthly.' },
  { icon: 'TrendingDown', title: 'Lower prices at home', body: 'The more neighbours book together, the less each home pays.' },
  { icon: 'Lightbulb', title: 'A say in what comes next', body: 'Propose the services your community keeps asking for, and follow each one on a timeline.' },
  { icon: 'LayoutDashboard', title: 'Your own dashboard', body: 'Live deals for your communities, bookings, proposals and earnings in one place.' },
];

const PAYMENT_STEPS = [
  { icon: 'CreditCard', title: 'Neighbours pay Lotmates', body: 'Every booking is paid through Razorpay. You never handle anyone\'s money.' },
  { icon: 'CircleCheck', title: 'The job gets done', body: 'Your share shows as "coming" while jobs are booked, and "earned" once they\'re done.' },
  { icon: 'Landmark', title: 'Paid monthly to your bank', body: 'Earnings go to your verified bank account each month. TDS is deducted where the law requires.' },
];

const ONBOARDING = [
  { title: 'Apply', body: 'Fill in the form below. It takes about five minutes.' },
  { title: 'We get in touch', body: 'Someone from the team calls or emails you to learn about your community and answer questions.' },
  { title: 'Approval and account', body: 'Once we\'ve spoken and approved you, we email you a link to set up your ambassador account. If you already book as a neighbour, your account is upgraded.' },
  { title: 'Verify for payouts', body: 'Add your ID and bank details so we can pay your earnings.' },
  { title: 'Share your first deal', body: 'Post a live deal in your community group, or propose the one your neighbours want.' },
];

const FAQ = [
  ['Can I still book deals for my own home?', 'Yes. Book any deal like any neighbour. You just don\'t earn commission on your own bookings.'],
  ['Do I have to live in the community?', 'Not always. Building and estate managers can apply too. Tell us how you\'re connected in the form.'],
  ['Can I run more than one community?', 'Yes. Apply for one to start, and tell the team about the others when they get in touch.'],
  ['Do I have to sell?', 'No. Share real deal details, answer questions, and let neighbours decide. Don\'t pressure anyone to book.'],
  ['What if I want to stop?', 'You can stop at any time. Earnings on jobs already completed are still paid.'],
  ['What if I work with a vendor?', 'Tell us. If you\'re related to, work for or are paid by a vendor, we need to know before you propose their deals.'],
];

function SectionTitle({ children, sub, align = 'left', className }) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      <h2 className="font-heading text-[2rem] font-bold leading-[1.05] tracking-tight text-foreground md:text-5xl">{children}</h2>
      {sub && <p className="mt-4 text-base text-muted-foreground md:text-lg">{sub}</p>}
    </div>
  );
}

export default function BecomeAmbassador() {
  const user = useSelector((s) => s.user.user);
  const isAmbassador = user?.profile === 'Ambassador_c';

  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="px-5 pt-10 md:px-8 md:pt-16">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <ApperIcon name="Megaphone" size={15} />
              Lotmates ambassadors
            </p>
            <h1 className="mt-5 font-heading text-[2.6rem] font-bold leading-[0.98] tracking-tight text-primary md:text-[4.25rem]">
              Bring your community&apos;s buying power together.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground md:text-xl">
              Share the deals your neighbours want, propose new ones, and earn {SHARE_PCT}% of Lotmates&apos; commission on every completed job in your community.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {isAmbassador ? (
                <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                  <Link to="/ambassador">Go to your dashboard</Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
                  <a href="#apply">Apply to be an ambassador</a>
                </Button>
              )}
              <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-6 text-base">
                <Link to="/legal/ambassadors">Read the ambassador terms</Link>
              </Button>
            </div>
          </div>
          <ExampleCard />
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto max-w-6xl">
          <SectionTitle sub="Ambassadors are neighbours, not salespeople. If people in your building or street already listen to you, this is for you.">Who it&apos;s for</SectionTitle>
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
          <p className="mt-6 flex items-start gap-2.5 text-sm text-muted-foreground">
            <ApperIcon name="Info" size={16} className="mt-0.5 flex-none text-primary" />
            If you work for, or are paid by, a vendor, tell us in the form. It doesn&apos;t rule you out, but we need to know.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="mt-24 bg-primary px-5 py-20 text-primary-foreground md:mt-32 md:px-8 md:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-2xl font-heading text-[2rem] font-bold leading-[1.05] tracking-tight md:text-5xl">What you get</h2>
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

      {/* Commissions */}
      <section id="earnings" className="px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionTitle sub={`Lotmates charges vendors a commission on each job. You get ${SHARE_PCT}% of it for every completed job in the communities you run. The rate is set for each deal.`}>
              How much you can earn
            </SectionTitle>
            <div className="mt-8 rounded-[22px] border border-highlight/60 bg-highlight/15 p-5">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <ApperIcon name="House" size={18} className="text-foreground" />
                Your own bookings don&apos;t count
              </p>
              <p className="mt-2 text-[15px] leading-6 text-foreground">
                You can book any deal for your own home, like any neighbour. You don&apos;t earn commission on your own bookings, only on your neighbours&apos;.
              </p>
              <Link to="/legal/ambassadors" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline">
                See the ambassador terms
                <ApperIcon name="ArrowUpRight" size={14} />
              </Link>
            </div>
          </div>
          <Estimator />
        </div>
      </section>

      {/* Payments */}
      <section className="px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto max-w-6xl">
          <SectionTitle sub="Neighbours pay Lotmates, vendors are paid by Lotmates, and your share comes from our commission. It never comes out of a neighbour's price.">How payments work</SectionTitle>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {PAYMENT_STEPS.map((p) => (
              <li key={p.title} className="rounded-[22px] bg-card p-6 shadow-sm">
                <ApperIcon name={p.icon} size={24} className="text-primary" />
                <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{p.title}</h3>
                <p className="mt-1.5 text-[15px] leading-6 text-muted-foreground">{p.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Onboarding */}
      <section className="px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <SectionTitle sub="Every application is read by a person. Your ambassador account is set up only after we've spoken with you.">How joining works</SectionTitle>
          <ol>
            {ONBOARDING.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 pb-8 last:pb-0">
                {i < ONBOARDING.length - 1 && <span aria-hidden className="absolute left-[19px] top-11 h-[calc(100%-2.75rem)] w-0.5 rounded-full bg-border" />}
                <span className="flex size-10 flex-none items-center justify-center rounded-full bg-primary font-heading text-base font-bold text-primary-foreground">{i + 1}</span>
                <div className="pt-1.5">
                  <h3 className="font-heading text-lg font-bold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-[15px] leading-6 text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Form */}
      <section id="apply" className="scroll-mt-20 px-5 pt-24 md:px-8 md:pt-32">
        <div className="mx-auto max-w-6xl rounded-[28px] bg-card p-6 shadow-sm md:p-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div>
              <h2 className="font-heading text-[2rem] font-bold leading-[1.05] tracking-tight text-foreground md:text-[2.75rem]">Apply to be an ambassador</h2>
              <p className="mt-4 text-base text-muted-foreground md:text-lg">Tell us about you and your community. We&apos;ll get in touch before anything is set up.</p>
              <ul className="mt-8 space-y-3 text-[15px] text-foreground">
                {['Read by a person on the Lotmates team', 'No account is created until you\'re approved', 'You can keep booking as a neighbour meanwhile'].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <ApperIcon name="Check" size={18} className="mt-0.5 flex-none text-primary" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            {isAmbassador ? (
              <div className="rounded-[22px] bg-primary/[0.07] p-6">
                <p className="font-heading text-xl font-bold text-foreground">You&apos;re already an ambassador</p>
                <p className="mt-2 text-muted-foreground">Your communities, proposals and earnings are in your dashboard.</p>
                <Button asChild className="mt-5">
                  <Link to="/ambassador">Go to your dashboard</Link>
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
            The full rules are in the <Link to="/legal/ambassadors" className="font-medium text-primary underline-offset-2 hover:underline">ambassador terms</Link>, along with our <Link to="/legal/terms" className="font-medium text-primary underline-offset-2 hover:underline">terms of use</Link> and <Link to="/legal/privacy" className="font-medium text-primary underline-offset-2 hover:underline">privacy policy</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}

/** A worked example, so the numbers are concrete before anyone reads the form. */
function ExampleCard() {
  const homes = 40;
  const price = 3000;
  const rate = 0.12;
  const commission = homes * price * rate;
  const share = commission * AMBASSADOR_SHARE;
  return (
    <div className="rounded-[28px] bg-card p-6 shadow-[0_24px_60px_-24px_rgb(15_42_32/0.35)] md:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Example: one deal in your community</p>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Illustrative</span>
      </div>
      <p className="mt-3 font-heading text-xl font-bold text-foreground">Deep cleaning, 2BHK</p>
      <dl className="mt-5 space-y-3 text-[15px]">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Neighbours who booked</dt>
          <dd className="tabular-nums text-foreground">{homes} homes</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Final price per home</dt>
          <dd className="tabular-nums text-foreground">{inr(price)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Lotmates&apos; commission, 12%</dt>
          <dd className="tabular-nums text-foreground">{inr(commission)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <dt className="font-medium text-foreground">Your {SHARE_PCT}% share</dt>
          <dd className="rounded-lg bg-highlight px-2.5 py-1 font-heading text-2xl font-bold tabular-nums text-highlight-foreground">{inr(share)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">Paid once the jobs are done. Your own booking wouldn&apos;t count towards it.</p>
    </div>
  );
}

function Range({ id, label, value, min, max, step, onChange, display }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[15px] font-medium text-foreground">{label}</label>
        <output htmlFor={id} className="font-heading text-lg font-bold tabular-nums text-foreground">{display}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
    </div>
  );
}

function Estimator() {
  const [homes, setHomes] = useState(40);
  const [price, setPrice] = useState(3000);
  const [rate, setRate] = useState(12);
  const commission = homes * price * (rate / 100);
  const share = commission * AMBASSADOR_SHARE;
  return (
    <div className="rounded-[28px] bg-card p-6 shadow-sm md:p-8">
      <h3 className="font-heading text-xl font-bold text-foreground">Estimate one deal</h3>
      <div className="mt-6 space-y-7">
        <Range id="est-homes" label="Neighbours who book" value={homes} min={5} max={200} step={5} onChange={setHomes} display={`${homes} homes`} />
        <Range id="est-price" label="Final price per home" value={price} min={500} max={20000} step={100} onChange={setPrice} display={inr(price)} />
        <Range id="est-rate" label="Lotmates' commission on the deal" value={rate} min={5} max={20} step={1} onChange={setRate} display={`${rate}%`} />
      </div>
      <div className="mt-8 rounded-2xl bg-primary px-5 py-4 text-primary-foreground">
        <p className="text-sm text-primary-foreground/80">Your {SHARE_PCT}% share of {inr(commission)} commission</p>
        <p className="mt-1 font-heading text-[2.25rem] font-bold leading-none tabular-nums" aria-live="polite">{inr(Math.round(share))}</p>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">An estimate, not a promise. What you earn depends on each deal&apos;s rate and on jobs being completed.</p>
    </div>
  );
}

const BLANK = { name: '', email: '', phone: '', community: '', locality: '', homes: '', relation: '', about: '', contactPref: 'Phone', agreed: false, website: '' };

function ApplyForm() {
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  const user = useSelector((s) => s.user.user);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));

  // Signed-in neighbours don't need to type their details again.
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
        community: f.community || me.community?.Name || '',
      }));
    });
  }, [user]);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Add your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = 'Enter a valid email address';
    if (!/^\+?[\d\s-]{10,16}$/.test(form.phone.trim())) errs.phone = 'Enter a 10-digit phone number, e.g. 98765 43210';
    if (!form.community.trim()) errs.community = "Tell us which community you'd represent";
    if (!form.locality.trim()) errs.locality = 'Add the area or locality';
    if (form.homes !== '' && Number(form.homes) < 1) errs.homes = 'At least 1 home';
    if (!form.relation) errs.relation = "Tell us how you're connected";
    if (!form.agreed) errs.agreed = "Please confirm you've read the ambassador terms";
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector(`[data-field="${Object.keys(errs)[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSending(true);
    try {
      const r = await sdk.ambassadors.apply({ ...form, homes: form.homes === '' ? null : Number(form.homes) });
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
          {done.updated
            ? 'We already had an application from this email, so we updated it with these details.'
            : `Thanks. We've emailed a copy to ${done.email}.`}{' '}
          Someone from the team will get in touch {done.contact === 'Email' ? 'by email' : 'by phone'} to talk about your community. Your ambassador account is set up after that.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/deals">See live deals</Link>
        </Button>
      </div>
    );
  }

  const field = 'h-12 rounded-xl bg-background text-base';
  const err = (k) => errors[k] && <p className="mt-1.5 text-sm text-destructive">{errors[k]}</p>;
  const label = 'mb-2 block text-[15px] font-medium text-foreground';

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="amb-website">Website</label>
        <input id="amb-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div data-field="name">
          <label htmlFor="amb-name" className={label}>Your name</label>
          <Input id="amb-name" className={field} value={form.name} onChange={set('name')} autoComplete="name" />
          {err('name')}
        </div>
        <div data-field="phone">
          <label htmlFor="amb-phone" className={label}>Phone</label>
          <Input id="amb-phone" type="tel" inputMode="tel" className={field} value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="98765 43210" />
          {err('phone')}
        </div>
      </div>
      <div data-field="email">
        <label htmlFor="amb-email" className={label}>Email</label>
        <Input id="amb-email" type="email" className={field} value={form.email} onChange={set('email')} autoComplete="email" />
        {err('email')}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div data-field="community">
          <label htmlFor="amb-community" className={label}>Community</label>
          <Input id="amb-community" className={field} value={form.community} onChange={set('community')} placeholder="Building, estate or street" />
          {err('community')}
        </div>
        <div data-field="locality">
          <label htmlFor="amb-locality" className={label}>Area or locality</label>
          <Input id="amb-locality" className={field} value={form.locality} onChange={set('locality')} placeholder="e.g. Kovaipudur, Coimbatore" />
          {err('locality')}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div data-field="homes">
          <label htmlFor="amb-homes" className={label}>Homes in the community <span className="font-normal text-muted-foreground">(roughly)</span></label>
          <Input id="amb-homes" type="number" min={1} inputMode="numeric" className={field} value={form.homes} onChange={set('homes')} placeholder="e.g. 180" />
          {err('homes')}
        </div>
        <div data-field="relation">
          <label htmlFor="amb-relation" className={label}>How you&apos;re connected</label>
          <Select value={form.relation} onValueChange={set('relation')}>
            <SelectTrigger id="amb-relation" className="!h-12 w-full rounded-xl bg-background text-base"><SelectValue placeholder="Choose one" /></SelectTrigger>
            <SelectContent>
              {APP_RELATIONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {err('relation')}
        </div>
      </div>

      <div>
        <label htmlFor="amb-about" className={label}>How would you share deals? <span className="font-normal text-muted-foreground">(optional)</span></label>
        <Textarea id="amb-about" rows={4} className="rounded-xl bg-background text-base" value={form.about} onChange={set('about')} maxLength={1500} placeholder="e.g. I run the residents' WhatsApp group for 180 homes. Neighbours often ask me for cleaning and pest control." />
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

      <div data-field="agreed">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4">
          <input type="checkbox" checked={form.agreed} onChange={set('agreed')} className="mt-1 size-4 flex-none accent-primary" />
          <span className="text-[15px] leading-6 text-foreground">
            I&apos;ve read the <Link to="/legal/ambassadors" target="_blank" className="font-medium text-primary underline underline-offset-2">ambassador terms</Link>, including that I don&apos;t earn commission on my own bookings, and the <Link to="/legal/privacy" target="_blank" className="font-medium text-primary underline underline-offset-2">privacy policy</Link>.
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
