import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { seedDemo, DEMO_TOTAL } from '@/services/demoSeed';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import { ListSkeleton } from '@/components/PageSkeleton';
import { NeedsYou, StatRow } from '@/components/RoleHome';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DEAL_FIELDS, dealState, dealWhere, inr, timeLeft } from '@/services/dealRules';

export const route = { path: '/admin', layout: 'owner', access: "profile === 'Admin_c'" };
export const nav = { icon: 'LayoutDashboard', label: 'Today', order: 10, profiles: ['Admin_c'] };

const { eq, isIn, relativeMatch } = window.ApperSDK.CoreSDK;

const pick = (res, key) => {
  const x = res?.aggregators?.find((a) => a.id === key);
  return x?.data?.count ?? x?.count ?? x?.value ?? 0;
};

function DemoSeedCard() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);

  async function run() {
    setRunning(true);
    setProgress({ done: 0, total: DEMO_TOTAL, label: '' });
    try {
      const stats = await seedDemo(setProgress);
      toast.success(`Added ${stats.added} demo records${stats.skipped ? `, ${stats.skipped} were already there` : ''}.`);
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      toast.error(`Stopped while adding demo content: ${err?.message ?? 'unknown error'}. Run it again to finish.`);
      setRunning(false);
    }
  }

  return (
    <section className="rounded-[24px] bg-card p-5 shadow-md md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="font-heading text-lg font-bold text-foreground">Fill Lotmates with demo content</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Adds Chennai with 3 localities, 4 communities, 6 vendors and 10 deals across every category, so the homepage and deals pages look lived in. Every name is marked (demo).
          </p>
        </div>
        <Button onClick={run} disabled={running}>
          {running ? <ApperIcon name="LoaderCircle" size={16} className="animate-spin" /> : <ApperIcon name="Sparkles" size={16} />}
          {running ? `Adding ${progress?.done ?? 0} of ${progress?.total ?? DEMO_TOTAL}…` : 'Add demo content'}
        </Button>
      </div>
      {running && progress?.label && <p className="mt-3 truncate text-xs text-muted-foreground">Added {progress.label}</p>}
    </section>
  );
}

export default function Dashboard() {
  // Every number on this page comes from the server, worked out from the bookings themselves.
  const { data: kpi, error: kpiError, run: refetchKpi } = useFetch(async () => {
    const r = await sdk.adminStats();
    if (!r.ok) throw new Error(r.error.message);
    const v = r.value?.data ?? r.value;
    return {
      ...v,
      due: v.refundsDue,
      dueCount: v.refundsDueCount,
    };
  }, []);

  const { data: attention } = useFetch(async () => {
    const c = await sdk
      .table('complaints_c')
      .select([{ field: 'Id' }])
      .aggregate([{ id: 'open', fields: [{ field: 'Id', fn: 'Count', alias: 'count' }], where: isIn('status_c', ['Open', 'In review']) }])
      .limit(1)
      .fetch();
    const p = await sdk
      .table('proposals_c')
      .select([{ field: 'Id' }])
      .aggregate([{ id: 'new', fields: [{ field: 'Id', fn: 'Count', alias: 'count' }], where: eq('status_c', 'New') }])
      .limit(1)
      .fetch();
    const po = await sdk
      .table('payouts_c')
      .select([{ field: 'Id' }])
      .aggregate([{ id: 'pending', fields: [{ field: 'net_c', fn: 'Sum', alias: 'count' }], where: eq('status_c', 'Pending') }])
      .limit(1)
      .fetch();
    const one = (table, where) => sdk.table(table).select([{ field: 'Id' }]).aggregate([{ id: 'n', fields: [{ field: 'Id', fn: 'Count', alias: 'count' }], where }]).limit(1).fetch();
    const [va, aa, rv] = await Promise.all([
      one('vendorApps_c', eq('status_c', 'New')),
      one('ambassadorApps_c', eq('status_c', 'New')),
      sdk.table('deals_c').select(['Name', 'status_c']).where(eq('status_c', 'Awaiting team')).page(1, 10).fetch(),
    ]);
    return { complaints: pick(c, 'open'), proposals: pick(p, 'new'), payouts: pick(po, 'pending'), vendorApps: pick(va, 'n'), ambassadorApps: pick(aa, 'n'), toReview: rv.success ? rv.data : [] };
  }, []);

  const { data: liveDeals, loading: liveLoading } = useFetch(() => {
    return sdk
      .table('deals_c')
      .select(DEAL_FIELDS)
      .where(eq('status_c', 'Live'))
      .orderBy('deadline_c')
      .page(1, 20)
      .fetch()
      .then((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      });
  }, []);

  const deals = liveDeals ?? [];
  const now = Date.now();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = sdk.session.user()?.firstName;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  // Each item leads with the thing you'd scan for: an amount, a count or the time left.
  const tasks = [];
  const dueHours = (iso) => Math.max(0, Math.round((new Date(iso).getTime() - now) / 36e5));
  if (kpi?.dueCount) {
    tasks.push({ key: 'refunds', to: '/bookings', lead: inr(kpi.due), tone: 'money', title: 'Refunds to send', note: `${kpi.dueCount} ${kpi.dueCount === 1 ? 'booking' : 'bookings'} waiting`, cta: 'Send' });
  }
  (attention?.toReview ?? []).forEach((d) => {
    tasks.push({ key: `review-${d.Id}`, to: `/admin/deals/${d.Id}`, lead: 'New', tone: 'urgent', title: d.Name, note: 'A vendor sent this deal for your approval', cta: 'Review' });
  });
  if (attention?.vendorApps) {
    tasks.push({ key: 'vapps', to: '/admin/vendor-applications', lead: String(attention.vendorApps), tone: 'calm', title: attention.vendorApps === 1 ? 'New vendor application' : 'New vendor applications', note: 'A business wants to sell on Lotmates', cta: 'Review' });
  }
  if (attention?.ambassadorApps) {
    tasks.push({ key: 'aapps', to: '/admin/ambassador-applications', lead: String(attention.ambassadorApps), tone: 'calm', title: attention.ambassadorApps === 1 ? 'New ambassador application' : 'New ambassador applications', note: 'Someone wants to represent their community', cta: 'Review' });
  }
  deals.forEach((d) => {
    const st = dealState(d);
    const t = new Date(d.deadline_c).getTime();
    if (t <= now) {
      tasks.push({
        key: `close-${d.Id}`,
        to: `/admin/deals/${d.Id}`,
        lead: 'Ended',
        tone: 'urgent',
        cta: 'Close',
        title: `Close ${d.Name}`,
        note: st.unlocked ? `Reached ${inr(st.current?.price)}, refunds go out when you close` : `${st.toMin} short of the minimum, everyone gets a full refund`,
      });
    } else if (t - now <= 2 * 864e5) {
      const h = dueHours(d.deadline_c);
      tasks.push({
        key: `soon-${d.Id}`,
        to: `/admin/deals/${d.Id}`,
        lead: h < 24 ? `${h}h` : `${Math.round(h / 24)}d`,
        tone: st.unlocked ? 'calm' : 'urgent',
        title: d.Name,
        note: st.unlocked ? `On, ${st.next ? `${st.toNext} more for ${inr(st.next.price)}` : 'at its best price'}` : `Closes soon, ${st.toMin} short of the minimum`,
      });
    }
  });
  if (attention?.complaints) {
    tasks.push({ key: 'complaints', to: '/complaints', lead: String(attention.complaints), tone: 'urgent', title: attention.complaints === 1 ? 'Complaint to handle' : 'Complaints to handle', note: 'Open or waiting on a reply', cta: 'Reply' });
  }
  if (attention?.proposals) {
    tasks.push({ key: 'proposals', to: '/proposals', lead: String(attention.proposals), tone: 'calm', title: attention.proposals === 1 ? 'New deal suggestion' : 'New deal suggestions', note: 'Deals ambassadors are asking for', cta: 'Read' });
  }
  (kpi?.payoutsToSetUp ?? []).forEach((p) => {
    tasks.push({ key: `setup-${p.dealId}`, to: `/admin/deals/${p.dealId}`, lead: inr(p.amount), tone: 'money', title: `Set up the vendor payout: ${p.deal}`, note: 'The deal went ahead. Record what the vendor is owed', cta: 'Set up' });
  });
  if (kpi?.payoutsPending) {
    tasks.push({ key: 'payouts', to: '/payouts', lead: inr(kpi.payoutsPending), tone: 'money', title: 'Vendor payouts pending', note: 'Pay once the jobs are done', cta: 'Pay' });
  }

  const summary = [
    { label: 'Live deals', value: kpi?.live ?? 0, sub: kpi?.preparing ? `${kpi.preparing} being prepared` : 'None being prepared', to: '/admin/deals?status=Live' },
    { label: 'Bookings this week', value: kpi?.week ?? 0, sub: 'Paid, since Monday', to: '/bookings' },
    {
      label: 'Collected',
      value: inr(kpi?.kept ?? 0),
      sub: kpi?.onOpenDeals ? `${inr(kpi.onOpenDeals)} on deals still open` : `After ${inr(kpi?.refunded ?? 0)} refunded`,
      to: '/bookings',
      title: `${inr(kpi?.paidIn ?? 0)} paid in, ${inr(kpi?.refunded ?? 0)} refunded. Money on open deals can still go back if a deal fails or its price drops.`,
    },
    { label: 'Commission earned', value: inr(kpi?.commissionEarned ?? 0), sub: 'From deals that went ahead', to: '/admin/deals?status=Closed', title: 'Each confirmed booking at its final price, at its deal\'s commission rate.' },
  ];

  const leadTone = {
    money: 'text-[oklch(0.5_0.13_70)]',
    urgent: 'text-destructive',
    calm: 'text-primary',
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{today}</p>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </h1>
        </div>
        <Button asChild className="h-11 rounded-full px-5">
          <Link to="/admin/deals/new">
            <ApperIcon name="Plus" size={16} />
            New deal
          </Link>
        </Button>
      </header>

      {kpi && Number(kpi.live) + Number(kpi.draft) === 0 && <DemoSeedCard />}

      <NeedsYou tasks={tasks} loading={liveLoading && liveDeals === undefined} empty="Nothing is waiting on you. A good moment to plan the next round." />

      {kpiError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-destructive/5 px-5 py-4">
          <p className="text-sm text-foreground">The numbers didn't load. {String(kpiError)}</p>
          <Button variant="outline" size="sm" onClick={refetchKpi}>Try again</Button>
        </div>
      ) : (
        <StatRow stats={summary} loading={!kpi} />
      )}


      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-xl font-bold text-foreground">Live deals</h2>
          <Link to="/admin/deals" className="flex-none text-sm font-medium text-primary hover:underline">All deals</Link>
        </div>
        {liveLoading && liveDeals === undefined ? (
          <div className="mt-3"><ListSkeleton rows={4} /></div>
        ) : deals.length === 0 ? (
          <p className="mt-3 text-muted-foreground">No live deals. Publish a draft to start a round.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-[22px] bg-card shadow-sm">
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-6 border-b border-border px-5 py-3 text-[13px] text-muted-foreground md:grid">
              <span>Deal</span>
              <span>Booked</span>
              <span>Price now</span>
              <span className="text-right">Closes</span>
            </div>
            <ul className="divide-y divide-border">
              {deals.map((d) => {
                const st = dealState(d);
                const scale = st.cap || st.scaleMax || 1;
                const pct = Math.min(100, (st.booked / scale) * 100);
                const minPct = st.min ? Math.min(100, (st.min / scale) * 100) : 0;
                return (
                  <li key={d.Id}>
                    <Link
                      to={`/admin/deals/${d.Id}`}
                      className="grid grid-cols-2 gap-x-6 gap-y-2 px-5 py-4 transition-colors duration-(--transition-fast) hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)] md:items-center"
                    >
                      <div className="col-span-2 min-w-0 md:col-span-1">
                        <p className="truncate font-medium text-foreground">{d.Name}</p>
                        <p className="truncate text-sm text-muted-foreground">{dealWhere(d) || 'Whole locality'}</p>
                      </div>
                      <div className="col-span-2 min-w-0 md:col-span-1">
                        <div className="relative h-2 rounded-full bg-muted">
                          <div className={cn('absolute inset-y-0 left-0 rounded-full', st.unlocked ? 'bg-primary' : 'bg-primary/45')} style={{ width: `${pct}%` }} />
                          {minPct > 0 && minPct < 100 && <span title={`Minimum ${st.min}`} className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground/40" style={{ left: `${minPct}%` }} />}
                        </div>
                        <p className="mt-1.5 text-[13px] tabular-nums text-muted-foreground">
                          {st.booked} of {scale}
                          {st.unlocked ? (st.next ? `, ${st.toNext} to ${inr(st.next.price)}` : ', best price') : `, ${st.toMin} to go live`}
                        </p>
                      </div>
                      <p className="font-heading font-bold tabular-nums text-foreground">
                        {inr(st.current?.price)}
                        {st.refundPerUnit > 0 && <span className="block font-sans text-[13px] font-normal text-muted-foreground">down from {inr(st.tier1?.price)}</span>}
                      </p>
                      <p className={cn('self-start text-right text-sm tabular-nums md:self-auto', new Date(d.deadline_c).getTime() - now < 864e5 ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                        {timeLeft(d.deadline_c)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
