import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { HomeHeader, NeedsYou, StatRow } from '@/components/RoleHome';
import { unwrapList, userIdOf } from '@/services/records';
import { DEAL_FIELDS, inr } from '@/services/dealRules';

export const route = { path: '/vendor', layout: 'owner', access: "profile === 'Vendor_c'" };
export const nav = { icon: 'House', label: 'Home', order: 1, profiles: ['Vendor_c'] };

const { eq, isIn } = window.ApperSDK.CoreSDK;

const count = (res, id) => {
  const x = res?.aggregators?.find((a) => a.id === id);
  return Number(x?.data?.count ?? x?.count ?? x?.value ?? 0);
};

export default function VendorHome() {
  const user = useSelector((s) => s.user.user);
  const uid = userIdOf(user);

  const { data, loading } = useFetch(async () => {
    if (!uid) return null;
    const v = await sdk.table('vendors_c').select(['Name']).where(eq('user_c', uid)).limit(1).fetch();
    const vendor = unwrapList(v)[0] ?? null;
    const [deals, jobs, money, complaints] = await Promise.all([
      vendor ? sdk.table('deals_c').select(DEAL_FIELDS).where(eq('vendor_c', vendor.Id)).orderByDesc('CreatedOn').page(1, 100).fetch() : { data: [] },
      sdk.table('bookings_c').select(['Name', 'deal_c', 'status_c', 'preferredDate_c']).where(isIn('status_c', ['Confirmed'])).orderBy('preferredDate_c').page(1, 200).fetch(),
      sdk
        .table('payouts_c')
        .select([{ field: 'Id' }])
        .aggregate([
          { id: 'paid', fields: [{ field: 'net_c', fn: 'Sum', alias: 'count' }], where: eq('status_c', 'Paid') },
          { id: 'pending', fields: [{ field: 'net_c', fn: 'Sum', alias: 'count' }], where: eq('status_c', 'Pending') },
        ])
        .limit(1)
        .fetch(),
      sdk.table('complaints_c').select(['Name', 'status_c', 'response_c']).where(isIn('status_c', ['Open', 'In review'])).page(1, 50).fetch(),
    ]);
    return {
      vendor,
      deals: unwrapList(deals),
      jobs: unwrapList(jobs),
      paid: count(money, 'paid'),
      pending: count(money, 'pending'),
      complaints: unwrapList(complaints).filter((c) => !String(c.response_c ?? '').trim()),
    };
  }, [uid]);

  const tasks = [];
  if (data) {
    data.deals.filter((d) => d.status_c === 'Awaiting vendor').forEach((d) =>
      tasks.push({ key: `confirm-${d.Id}`, to: `/vendor/deals/${d.Id}`, lead: 'New', tone: 'urgent', title: d.Name, note: 'The team sent this deal for you to confirm', cta: 'Review' }));
    data.deals.filter((d) => d.status_c === 'Changes requested').forEach((d) =>
      tasks.push({ key: `changes-${d.Id}`, to: `/vendor/deals/${d.Id}`, lead: 'Fix', tone: 'money', title: d.Name, note: 'The team asked for changes before it can go live', cta: 'Open' }));
    data.deals.filter((d) => d.status_c === 'Draft').forEach((d) =>
      tasks.push({ key: `draft-${d.Id}`, to: `/vendor/deals/${d.Id}/edit`, lead: 'Draft', tone: 'calm', title: d.Name, note: 'Not sent yet. Finish it and send it to the team', cta: 'Finish' }));
    const today = new Date(new Date().toDateString());
    const week = data.jobs.filter((j) => {
      if (!j.preferredDate_c) return false;
      const days = Math.round((new Date(`${String(j.preferredDate_c).slice(0, 10)}T00:00:00`) - today) / 864e5);
      return days <= 7;
    });
    if (week.length) tasks.push({ key: 'jobs', to: '/vendor/jobs', lead: String(week.length), tone: 'calm', title: week.length === 1 ? 'Job in the next 7 days' : 'Jobs in the next 7 days', note: 'See the addresses and times', cta: 'View' });
    const unscheduled = data.jobs.length - data.jobs.filter((j) => j.preferredDate_c).length;
    if (unscheduled) tasks.push({ key: 'call', to: '/vendor/jobs', lead: String(unscheduled), tone: 'money', title: unscheduled === 1 ? 'Customer to call' : 'Customers to call', note: 'No day picked yet. Call to fix a time', cta: 'View' });
    if (data.complaints.length) tasks.push({ key: 'complaints', to: '/complaints', lead: String(data.complaints.length), tone: 'urgent', title: data.complaints.length === 1 ? 'Complaint to reply to' : 'Complaints to reply to', note: 'Reply so the team can close it', cta: 'Reply' });
  }

  const live = (data?.deals ?? []).filter((d) => d.status_c === 'Live').length;
  const stats = [
    { label: 'Jobs to do', value: data?.jobs.length ?? 0, sub: 'Confirmed bookings', to: '/vendor/jobs' },
    { label: 'Deals live', value: live, sub: `${data?.deals.length ?? 0} in all`, to: '/vendor/deals' },
    { label: 'Paid to you', value: inr(data?.paid ?? 0), sub: 'After commission', to: '/payouts' },
    { label: 'On its way', value: inr(data?.pending ?? 0), sub: 'Paid once jobs are done', to: '/payouts' },
  ];

  const fresh = data && data.deals.length === 0;

  return (
    <div className="space-y-10">
      <HomeHeader firstName={user?.firstName} action={{ to: '/vendor/deals/new', label: 'New deal' }} />
      {fresh ? (
        <section className="rounded-[22px] bg-card p-6 shadow-sm sm:p-8">
          <h2 className="font-heading text-xl font-bold text-foreground">Start with your first deal</h2>
          <p className="mt-2 max-w-prose text-muted-foreground">Set a price that drops as more neighbours join, pick where it's open and when it closes. The Lotmates team checks it, then neighbours can book.</p>
          <Link to="/vendor/deals/new" className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">Create a deal</Link>
        </section>
      ) : (
        <NeedsYou tasks={tasks} loading={loading && !data} empty="Nothing is waiting on you. New bookings and messages will show up here." />
      )}
      <StatRow stats={stats} loading={loading && !data} />
    </div>
  );
}
