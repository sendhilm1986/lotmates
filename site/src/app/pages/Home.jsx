import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import ApperIcon from '@/components/ApperIcon';
import DotMeter, { meterLabels } from '@/components/DotMeter';
import DealCard from '@/components/DealCard';
import LocalityMenu from '@/components/LocalityMenu';
import { TourLauncher } from '@/components/GuidedTour';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import {
  DEAL_FIELDS,
  CATEGORY_VALUES,
  CATEGORY_META,
  dealState,
  getTiers,
  tierForCount,
  inr,
} from '@/services/dealRules';
import { dealPhoto } from '@/services/dealMedia';

export const route = { path: '/', layout: 'public', access: 'public' };

const { eq } = window.ApperSDK.CoreSDK;

const DEMO_DEAL = {
  Id: 'demo',
  Name: 'Deep cleaning, 2BHK',
  category_c: 'Cleaning',
  unit_c: 'per home',
  regularPrice_c: 4000,
  tier1Max_c: 10,
  tier1Price_c: 3499,
  tier2Max_c: 20,
  tier2Price_c: 3199,
  tier3Max_c: 30,
  tier3Price_c: 2899,
  tier4Max_c: 40,
  tier4Price_c: 2699,
  minHomes_c: 10,
  capacity_c: 40,
  bookedHomes_c: 27,
  unlockedTier_c: 1,
  community_c: { Name: 'Green Meadows' },
};

const BLURB = {
  Health: 'Full body checkups with sample collection at home.',
  Cleaning: 'Deep cleans by checked, police-verified crews.',
  Solar: 'Rooftop systems with the subsidy paperwork done for you.',
  Products: 'Factory-direct appliances like wet grinders.',
  Pest: 'Termite and pest treatment with a year of cover.',
  AC: 'Servicing for every AC in the building, before summer.',
};

const TRUST = [
  { icon: 'ShieldCheck', title: 'Paid safely through Razorpay.', body: 'Your card and UPI details never reach us. Every refund goes back the way you paid.' },
  { icon: 'RotateCcw', title: 'No unlock, no charge.', body: 'If too few homes book by the deadline, everyone gets all of it back.' },
  { icon: 'BadgeCheck', title: 'Every vendor is checked.', body: 'ID, licences, references and a test job before their first deal goes live.' },
];

const HOME = { Admin_c: '/admin', Vendor_c: '/vendor', Ambassador_c: '/ambassador' };

function priceAt(tiers, n) {
  if (!tiers.length) return 0;
  return tiers[Math.max(0, tierForCount(tiers, n) - 1)]?.price ?? tiers[0].price;
}

function useCountUp(target, duration = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return undefined;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setValue(target);
      return undefined;
    }
    let raf;
    let start = null;
    const delay = setTimeout(() => {
      const tick = (t) => {
        if (start === null) start = t;
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const from = Math.round(target * 0.55);
        setValue(Math.round(from + eased * (target - from)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, 150);
    return () => {
      clearTimeout(delay);
      cancelAnimationFrame(raf);
    };
  }, [target, duration]);
  return value;
}

function SectionTitle({ children, sub, align = 'center' }) {
  return (
    <div className={cn('max-w-2xl', align === 'center' ? 'mx-auto text-center' : '')}>
      <h2 className="font-heading text-[2rem] font-bold leading-[1.05] tracking-tight text-foreground md:text-5xl">{children}</h2>
      {sub && <p className="mt-4 text-base text-muted-foreground md:text-lg">{sub}</p>}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate font-heading text-lg font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, profile } = useProfile();
  const { hash } = useLocation();
  // "How it works" in the menu links here; scroll once the section exists.
  useEffect(() => {
    if (!hash) return undefined;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 120);
    return () => clearTimeout(t);
  }, [hash]);

  const { data: live, loading } = useFetch(() => {
    return sdk
      .table('deals_c')
      .select(DEAL_FIELDS)
      .where(eq('status_c', 'Live'))
      .orderByDesc('bookedHomes_c')
      .page(1, 100)
      .fetch()
      .then((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      });
  }, []);

  const deals = live ?? [];
  const ready = live !== undefined || !loading;
  const featured = deals.find((d) => getTiers(d).length >= 3) ?? deals[0] ?? (ready ? DEMO_DEAL : null);
  const tiers = featured ? getTiers(featured) : [];
  const cap = featured ? Number(featured.capacity_c || tiers.at(-1)?.to || 40) : 40;
  const booked = featured ? Number(featured.bookedHomes_c || 0) : 0;
  const where = featured?.community_c?.Name ?? featured?.locality_c?.Name ?? '';

  const shown = useCountUp(booked);
  const [homes, setHomes] = useState(null);
  const n = homes ?? shown;
  const price = priceAt(tiers, Math.max(1, n));
  const meterDeal = featured ? { ...featured, bookedHomes_c: n, unlockedTier_c: 1 } : null;
  const regular = Number(featured?.regularPrice_c || tiers[0]?.price || 0);
  const saving = Math.max(0, regular - price);
  const tier1Price = tiers[0]?.price ?? 0;
  const backNow = Math.max(0, tier1Price - price);

  const filling = deals.slice(0, 3);

  const categoryStats = CATEGORY_VALUES.map((c) => {
    const list = deals.filter((d) => d.category_c === c).map((d) => ({ d, st: dealState(d) }));
    const prices = list.map(({ st }) => st.current?.price).filter((p) => p != null);
    return {
      key: c,
      count: list.length,
      from: prices.length ? Math.min(...prices) : null,
      saving: list.length ? Math.max(...list.map(({ st }) => st.savingPct || 0)) : 0,
      booked: list.reduce((s, { st }) => s + st.booked, 0),
    };
  });

  return (
    <div className="overflow-x-clip">
      <TourLauncher id="home" />
      {/* One centred axis: headline, picker, live deal, then the street standing on the green ground. */}
      <section className="pt-10 md:pt-16">
        <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
          <h1 className="font-heading text-[2.75rem] font-bold leading-[0.98] tracking-tight text-primary md:text-[4.5rem]">
            <span className="block">Buy together.</span>
            <span className="block">Pay less.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground md:text-xl">
            Your locality books together. Every neighbour who joins brings the price down for everyone.
          </p>
          {/* Quiet on purpose: the headline and the street lead. The header carries the locality on desktop. */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <LocalityMenu className="h-11 bg-card md:hidden" data-tour="locality" />
            <Link to="/deals" className="inline-flex h-11 items-center gap-1.5 text-base font-semibold text-primary underline-offset-4 hover:underline">
              See all deals
              <ApperIcon name="ArrowRight" size={18} />
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-3xl px-5 md:mt-12 md:px-8">
          {meterDeal ? (
            <>
              <div className="flex flex-col items-center gap-1 text-center">
                {featured && featured.Id !== 'demo' ? (
                  <Link
                    to={`/deals/${featured.Id}`}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground hover:border-primary/40"
                  >
                    <span className="size-2 flex-none animate-pulse rounded-full bg-success" aria-hidden="true" />
                    <span className="truncate">
                      <span className="font-semibold text-foreground">Live: {featured.Name}</span>
                      {where ? `, ${where}` : ''}
                    </span>
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">Demo running in Chennai</p>
                )}
                <p aria-live="polite" className="mt-2 font-heading text-4xl font-bold tabular-nums tracking-tight text-foreground md:text-5xl">
                  {inr(price)}{' '}
                  <span className="block text-base font-semibold text-muted-foreground sm:inline md:text-xl">each, with {n} {n === 1 ? 'home' : 'homes'} booked</span>
                </p>
              </div>
              <div data-tour="hero-deal" className="mt-4">
                <DotMeter deal={meterDeal} size="xl" labels={false} className="text-left" />
              </div>
            </>
          ) : (
            <div className="space-y-5 pb-10">
              <Skeleton className="mx-auto h-10 w-56" />
              <Skeleton className="h-48 w-full" />
            </div>
          )}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-16 bg-primary pb-20 text-primary-foreground md:pb-28">
        {meterDeal && (() => {
          const L = meterLabels(meterDeal, 'xl');
          return (
            <div data-tour="how-it-works" className="mx-auto max-w-3xl px-5 pt-4 md:px-8">
              <div className="grid" style={L.style} aria-hidden="true">
                {L.steps.map((t, i) => (
                  <div key={t.n} className={cn('min-w-0 text-center tabular-nums', i === L.current ? 'text-primary-foreground' : 'text-primary-foreground/70')}>
                    <p className={cn('whitespace-nowrap text-sm md:text-lg', i === L.current ? 'font-bold' : 'font-medium')}>{inr(t.price)}</p>
                    <p className="whitespace-nowrap text-xs md:text-sm">{t.from === t.to ? `${t.from} home` : `${t.from}–${t.to} homes`}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <label htmlFor="homes-slider" className="sr-only">Homes booked</label>
                <Slider
                  id="homes-slider"
                  value={[Math.max(1, n)]}
                  min={1}
                  max={cap}
                  step={1}
                  onValueChange={(v) => setHomes(v[0])}
                  aria-label="Homes booked"
                  className="[&_[data-slot=slider-range]]:bg-highlight [&_[data-slot=slider-thumb]]:size-7 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-highlight [&_[data-slot=slider-thumb]]:bg-card [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-primary-foreground/20"
                />
                <p className="mt-5 text-center text-sm text-primary-foreground/75">Each house is a price. Drag to add homes and watch the next one fill.</p>
              </div>
            </div>
          );
        })()}

        <div className="mx-auto max-w-5xl px-5 pt-16 md:px-8 md:pt-24">
          <h2 className="font-heading text-[2rem] font-bold leading-[1.05] tracking-tight md:text-center md:text-5xl">How it works</h2>
          <ol className="relative mt-10 grid gap-8 md:mt-14 md:grid-cols-3 md:gap-10">
            <span aria-hidden="true" className="absolute left-[16.66%] right-[16.66%] top-5 hidden h-px bg-primary-foreground/30 md:block" />
            {[
              ['Pick a deal in your locality', 'Deep cleaning, health checkups, AC care, pest control, rooftop solar and local products, from checked local vendors.'],
              ['Pay the first price', 'Book through Razorpay with card or UPI. Booking early never costs more than booking late.'],
              ['Get the difference back', 'Every neighbour who joins lowers the price. When the deal closes, the difference goes back the way you paid.'],
            ].map(([title, body], i) => (
              <li key={title} className="relative flex gap-4 md:flex-col md:items-center md:text-center">
                <span className="relative flex size-10 flex-none items-center justify-center rounded-full bg-highlight font-heading text-lg font-bold text-highlight-foreground ring-8 ring-primary">{i + 1}</span>
                <div className="md:mt-5 md:max-w-xs">
                  <h3 className="font-heading text-xl font-bold leading-tight md:text-2xl">{title}</h3>
                  <p className="mt-2 text-base text-primary-foreground/80">{body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-16 border-t border-primary-foreground/20 pt-10 md:mt-20 md:pt-12 md:text-center">
            <p className="text-base text-primary-foreground/80">At {n} homes on {featured?.Name ?? 'this deal'}</p>
            <div className="mt-5 grid gap-6 tabular-nums md:flex md:items-start md:justify-center md:gap-6">
              <div>
                <p className="inline-block px-3 py-1 font-heading text-4xl font-bold tracking-tight md:text-6xl">{inr(tier1Price)}</p>
                <p className="mt-2.5 text-sm text-primary-foreground/75">You pay today</p>
              </div>
              <span className="hidden pt-1 font-heading text-5xl font-bold text-primary-foreground/60 md:block md:text-6xl" aria-hidden="true">−</span>
              <div>
                <p className="flex items-center gap-2 md:block">
                  <span className="font-heading text-4xl font-bold text-primary-foreground/60 md:hidden" aria-hidden="true">−</span>
                  <span className="inline-block rounded-2xl bg-highlight px-3 py-1 font-heading text-4xl font-bold tracking-tight text-highlight-foreground md:text-6xl">{inr(backNow)}</span>
                </p>
                <p className="mt-2.5 text-sm text-primary-foreground/75">Back to you at close</p>
              </div>
              <span className="hidden pt-1 font-heading text-5xl font-bold text-primary-foreground/60 md:block md:text-6xl" aria-hidden="true">=</span>
              <div>
                <p className="flex items-center gap-2 md:block">
                  <span className="font-heading text-4xl font-bold text-primary-foreground/60 md:hidden" aria-hidden="true">=</span>
                  <span className="inline-block px-3 py-1 font-heading text-4xl font-bold tracking-tight md:text-6xl">{inr(price)}</span>
                </p>
                <p className="mt-2.5 text-sm text-primary-foreground/75">You end up paying</p>
              </div>
            </div>
            <p className="sr-only">{`You pay ${inr(tier1Price)} today, get ${inr(backNow)} back at close, and end up paying ${inr(price)}.`}</p>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-32">
        <div className="px-5 md:px-8">
          <SectionTitle sub="Services and products neighbours book again and again. Prices below are live.">
            What neighbours buy together.
          </SectionTitle>
        </div>
        <div className="mx-auto mt-12 max-w-6xl md:mt-16 md:px-8">
          <div className="flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-6 pt-1 [scrollbar-width:none] md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
            {categoryStats.map((s) => (
              <Link
                key={s.key}
                to={`/deals?category=${s.key}`}
                className="group flex w-[80%] flex-none snap-start flex-col rounded-[24px] bg-card p-3 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[46%] md:w-auto"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-muted">
                  <img
                    src={dealPhoto(s.key, 640)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-(--transition-slow) group-hover:scale-[1.03]"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-card/95 px-3 py-1 text-xs font-medium text-foreground">
                    {s.count ? `${s.count} live ${s.count === 1 ? 'deal' : 'deals'}` : 'Next round soon'}
                  </span>
                </div>
                <div className="flex flex-1 flex-col px-2 pb-2 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold leading-snug text-foreground">{CATEGORY_META[s.key].label}</h3>
                    <ApperIcon name="ArrowUpRight" size={18} className="mt-1 flex-none text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{BLURB[s.key]}</p>
                  <div className="mt-auto pt-5">
                    {s.count ? (
                      <dl className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 border-t border-border pt-4">
                        <Stat label="From" value={inr(s.from)} />
                        <Stat label="Saves up to" value={`${s.saving}%`} />
                        <Stat label="Booked" value={s.booked} />
                      </dl>
                    ) : (
                      <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                        No live round right now. Ambassadors can propose one for their community.
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {filling.length > 0 && (
        <section className="py-20 md:py-32">
          <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-5 md:px-8">
            <SectionTitle align="left" sub="The busiest rounds right now. Each house is a bigger saving, and it fills as neighbours book.">Filling up now.</SectionTitle>
            <Link to="/deals" className="hidden flex-none text-base font-medium text-primary hover:underline sm:block">All deals</Link>
          </div>
          <div className="mx-auto mt-12 max-w-6xl md:px-8">
            <div className="flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 pb-6 pt-1 [scrollbar-width:none] md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
              {filling.map((d) => (
                <DealCard key={d.Id} record={d} className="w-[85%] flex-none snap-start md:w-auto" />
              ))}
            </div>
            <div className="mt-6 px-5 sm:hidden">
              <Link to="/deals" className="text-base font-medium text-primary hover:underline">All deals</Link>
            </div>
          </div>
        </section>
      )}

      <section className="px-5 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-6xl">
          <SectionTitle align="left" sub="The rules that protect every neighbour, on every deal.">Safe by design.</SectionTitle>
          <ul className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
            {TRUST.map((t) => (
              <li key={t.title} className="border-t-2 border-primary pt-6">
                <ApperIcon name={t.icon} size={26} className="text-primary" />
                <h3 className="mt-4 font-heading text-xl font-bold leading-tight text-foreground md:text-2xl">{t.title}</h3>
                <p className="mt-2 text-base text-muted-foreground">{t.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-5 pb-24 pt-4 md:px-8 md:pb-32">
        <div className="mx-auto max-w-6xl rounded-[28px] bg-primary px-6 py-14 text-primary-foreground md:px-14 md:py-20">
          <h2 className="max-w-2xl font-heading text-[2rem] font-bold leading-[1.05] tracking-tight md:text-5xl">Start with your locality.</h2>
          <p className="mt-4 max-w-xl text-base text-primary-foreground/80 md:text-lg">
            Neighbours book deals. Local vendors fill their calendars. Ambassadors bring their street or building along.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            {isAuthenticated ? (
              <Button asChild size="lg" className="h-12 rounded-full bg-primary-foreground px-7 text-base text-primary hover:bg-primary-foreground/90">
                <Link to={HOME[profile] ?? '/bookings'}>Go to my account</Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="h-12 rounded-full bg-primary-foreground px-7 text-base text-primary hover:bg-primary-foreground/90">
                <Link to="/customer/signup">Join as a neighbour</Link>
              </Button>
            )}
            <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/vendors">Run a deal as a vendor</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-12 rounded-full px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/ambassadors">Become an ambassador</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
