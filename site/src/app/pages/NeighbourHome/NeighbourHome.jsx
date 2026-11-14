import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import DealCard from '@/components/DealCard';
import { HomeHeader, NeedsYou, StatRow } from '@/components/RoleHome';
import { ListSkeleton } from '@/components/PageSkeleton';
import { BOOKING_FIELDS, DEAL_FIELDS, dealState, inr, isOpen } from '@/services/dealRules';

export const route = { path: '/home', layout: 'owner', access: "profile === 'Customer_c'" };
export const nav = { icon: 'House', label: 'Home', order: 1, profiles: ['Customer_c'] };

const { eq, isIn, and } = window.ApperSDK.CoreSDK;

const dayLabel = (iso) => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  const days = Math.round((d - new Date(new Date().toDateString())) / 864e5);
  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function NeighbourHome() {
  const user = useSelector((s) => s.user.user);
  const uid = user?.userId;

  const { data, loading } = useFetch(async () => {
    if (!uid) return null;
    const [bk, agg, rv, me] = await Promise.all([
      sdk.table('bookings_c').select(BOOKING_FIELDS).where(and(eq('Owner', uid), isIn('status_c', ['Booked', 'Confirmed', 'Done']))).orderByDesc('CreatedOn').page(1, 100).fetch(),
      sdk
        .table('bookings_c')
        .select([{ field: 'Id' }])
        .aggregate([
          { id: 'paid', fields: [{ field: 'amountPaid_c', fn: 'Sum', alias: 'count' }], where: and(eq('Owner', uid), isIn('paymentStatus_c', ['Paid', 'Refunded'])) },
          { id: 'back', fields: [{ field: 'refundDue_c', fn: 'Sum', alias: 'count' }], where: and(eq('Owner', uid), eq('refundStatus_c', 'Paid')) },
          { id: 'due', fields: [{ field: 'refundDue_c', fn: 'Sum', alias: 'count' }], where: and(eq('Owner', uid), eq('refundStatus_c', 'Due')) },
          { id: 'active', fields: [{ field: 'Id', fn: 'Count', alias: 'count' }], where: and(eq('Owner', uid), isIn('status_c', ['Booked', 'Confirmed'])) },
        ])
        .limit(1)
        .fetch(),
      sdk.table('reviews_c').select(['booking_c']).where(eq('Owner', uid)).page(1, 200).fetch(),
      sdk.account.get(),
    ]);
    const bookings = bk.success ? bk.data : [];
    const ids = [...new Set(bookings.map((b) => b.deal_c?.Id).filter(Boolean))];
    const dl = ids.length ? await sdk.table('deals_c').select(DEAL_FIELDS).where(isIn('Id', ids)).fetch() : { data: [] };
    const deals = {};
    (dl.data ?? []).forEach((d) => { deals[String(d.Id)] = d; });
    const pick = (id) => {
      const x = agg.aggregators?.find((a) => a.id === id);
      return Number(x?.data?.count ?? x?.count ?? x?.value ?? 0);
    };
    const profile = me.ok ? me.value?.user ?? me.value : null;
    return {
      bookings,
      deals,
      reviewed: new Set((rv.data ?? []).map((r) => String(r.booking_c?.Id ?? r.booking_c))),
      spent: Math.max(0, pick('paid') - pick('back')),
      back: pick('back'),
      due: pick('due'),
      active: pick('active'),
      localityId: profile?.locality?.Id ?? profile?.localityId ?? null,
    };
  }, [uid]);

  const { data: open, loading: openLoading } = useFetch(() =>
    sdk.table('deals_c').select(DEAL_FIELDS).where(eq('status_c', 'Live')).orderBy('deadline_c').page(1, 30).fetch().then((r) => (r.success ? r.data.filter(isOpen) : [])), []);

  const tasks = [];
  if (data) {
    if (data.due > 0) tasks.push({ key: 'due', to: '/bookings?refund=Due', lead: inr(data.due), tone: 'money', title: 'Money is on its way back to you', note: 'Refunds reach your account in 5 to 7 working days' });
    for (const b of data.bookings) {
      const d = data.deals[String(b.deal_c?.Id)];
      const name = d?.Name ?? b.deal_c?.Name ?? 'your booking';
      if (b.status_c === 'Confirmed' && b.preferredDate_c) {
        const days = Math.round((new Date(`${String(b.preferredDate_c).slice(0, 10)}T00:00:00`) - new Date(new Date().toDateString())) / 864e5);
        if (days >= 0 && days <= 3) tasks.push({ key: `soon-${b.Id}`, to: `/bookings/${b.Id}`, lead: dayLabel(b.preferredDate_c), tone: 'calm', title: name, note: 'Coming up. Check the time and address', cta: 'View' });
      }
      if (b.status_c === 'Done' && !data.reviewed.has(String(b.Id))) {
        tasks.push({ key: `rate-${b.Id}`, to: `/bookings/${b.Id}`, lead: '★', tone: 'money', title: `How was ${name}?`, note: 'A quick rating helps your neighbours choose', cta: 'Rate' });
      }
      if (b.status_c === 'Booked' && d && isOpen(d)) {
        const st = dealState(d);
        const hours = Math.round((new Date(d.deadline_c).getTime() - Date.now()) / 36e5);
        if (!st.unlocked && hours <= 72) tasks.push({ key: `share-${b.Id}`, to: `/deals/${d.Id}`, lead: hours < 24 ? `${Math.max(1, hours)}h` : `${Math.round(hours / 24)}d`, tone: 'urgent', title: name, note: `Needs ${st.toMin} more to go ahead. Tell a neighbour`, cta: 'Share' });
      }
    }
  }

  const stats = [
    { label: 'Active bookings', value: data?.active ?? 0, sub: 'Booked or confirmed', to: '/bookings' },
    { label: 'You have spent', value: inr(data?.spent ?? 0), sub: 'After refunds', to: '/bookings?show=all' },
    { label: 'Refunds received', value: inr(data?.back ?? 0), sub: 'Price drops and cancelled deals', to: '/bookings?refund=Paid' },
  ];

  const mine = new Set((data?.bookings ?? []).filter((b) => b.status_c !== 'Done').map((b) => String(b.deal_c?.Id)));
  const all = open ?? [];
  const near = data?.localityId ? all.filter((d) => String(d.locality_c?.Id) === String(data.localityId) || d.city_c?.Id) : all;
  const show = (near.length ? near : all).filter((d) => !mine.has(String(d.Id))).slice(0, 3);

  return (
    <div className="space-y-10">
      <HomeHeader firstName={user?.firstName} action={{ to: '/deals', label: 'Book a deal' }} />
      <NeedsYou tasks={tasks} loading={loading && !data} empty="Nothing needs you right now. Your bookings are on track." />
      <StatRow stats={stats} loading={loading && !data} />
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-xl font-bold text-foreground">Open near you</h2>
          <Link to="/deals" className="flex-none text-sm font-medium text-primary hover:underline">All deals</Link>
        </div>
        {openLoading && !open ? (
          <div className="mt-3"><ListSkeleton rows={2} /></div>
        ) : show.length === 0 ? (
          <p className="mt-3 text-muted-foreground">No new deals in your area right now. We'll email you when one opens.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {show.map((d) => <DealCard key={d.Id} record={d} />)}
          </div>
        )}
      </section>
    </div>
  );
}
