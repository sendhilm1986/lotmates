import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { DEAL_FIELDS, dealState, inr, timeLeft } from '@/services/dealRules';
import { JOB_FIELDS, userIdOf, sameId, unwrapList } from '@/services/records';

export const route = { path: '/ambassador', layout: 'owner', access: "profile === 'Ambassador_c'" };
export const nav = { icon: 'Home', label: 'Communities', order: 5, profiles: ['Ambassador_c'] };

const { eq, isIn, and } = window.ApperSDK.CoreSDK;

export default function AmbassadorOverview() {
  const user = useSelector((s) => s.user.user);
  const uid = userIdOf(user);

  const { data, loading, error, run } = useFetch(async () => {
    if (!uid) return { communities: [], deals: [], bookings: [] };
    const c = await sdk
      .table('communities_c')
      .select(['Name', 'locality_c', 'type_c', 'homes_c', 'status_c'])
      .where(eq('ambassadorUser_c', uid))
      .orderBy('Name')
      .fetch();
    const communities = unwrapList(c);
    if (!communities.length) return { communities, deals: [], bookings: [] };
    const localityIds = [...new Set(communities.map((x) => x.locality_c?.Id).filter(Boolean))];
    const d = await sdk
      .table('deals_c')
      .select(DEAL_FIELDS)
      .where(and(eq('status_c', 'Live'), isIn('locality_c', localityIds)))
      .orderBy('deadline_c')
      .page(1, 30)
      .fetch();
    const b = await sdk.table('bookings_c').select(JOB_FIELDS).page(1, 200).fetch();
    const mine = communities.map((x) => String(x.Id));
    const deals = unwrapList(d).filter((deal) => !deal.community_c?.Id || mine.includes(String(deal.community_c.Id)));
    return { communities, deals, bookings: unwrapList(b) };
  }, [uid]);

  const communities = data?.communities ?? [];
  const deals = data?.deals ?? [];
  const bookings = data?.bookings ?? [];
  const firstName = user?.firstName ?? '';

  function share(deal) {
    const st = dealState(deal);
    const url = `${window.location.origin}/deals/${deal.Id}`;
    const text = `${deal.Name}: ${st.booked} neighbours in, price now ${inr(st.current?.price)}. Book before it closes: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  async function copy(deal) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/deals/${deal.Id}`);
      toast.success('Link copied. Paste it in the residents group.');
    } catch {
      toast.error('Could not copy. Open the deal and copy the address.');
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={firstName ? `Hi ${firstName}` : 'Your communities'}
        description="Share live deals in your groups, and tell the team what neighbours want next."
        actions={
          <Button variant="outline" asChild>
            <Link to="/proposals">
              <ApperIcon name="Lightbulb" size={16} />
              Propose a deal
            </Link>
          </Button>
        }
      />

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load your communities: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && data === undefined ? (
        <ListSkeleton rows={4} />
      ) : communities.length === 0 ? (
        <p className="rounded-[22px] bg-card shadow-sm p-8 text-center text-sm text-muted-foreground">
          You aren't linked to a community yet. The Lotmates team links ambassadors from the community record.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-bold text-foreground">Your communities</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm">
              {communities.map((c) => {
                const mineBookings = bookings.filter((b) => sameId(b.community_c?.Id, c.Id));
                const active = mineBookings.filter((b) => ['Booked', 'Confirmed'].includes(b.status_c)).length;
                const done = mineBookings.filter((b) => b.status_c === 'Done').length;
                return (
                  <li key={c.Id} className="flex flex-wrap items-center gap-3 px-4 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{c.Name}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.type_c}, {c.homes_c ?? '?'} homes,{' '}
                        {c.locality_c?.Id ? (
                          <Link to={`/areas/${c.locality_c.Id}`} className="text-primary hover:underline">{c.locality_c.Name}</Link>
                        ) : (
                          'no locality'
                        )}
                      </p>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <p className="font-heading text-xl font-bold tabular-nums text-foreground">{active}</p>
                        <p className="text-xs text-muted-foreground">{active === 1 ? 'active booking' : 'active bookings'}</p>
                      </div>
                      <div>
                        <p className="font-heading text-xl font-bold tabular-nums text-foreground">{done}</p>
                        <p className="text-xs text-muted-foreground">{done === 1 ? 'job done' : 'jobs done'}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-heading text-lg font-bold text-foreground">Open to your neighbours now</h2>
              <Link to="/ambassador/earnings" className="text-sm font-medium text-primary hover:underline">Your earnings</Link>
            </div>
            {deals.length === 0 ? (
              <p className="rounded-[22px] bg-card shadow-sm p-6 text-center text-sm text-muted-foreground">
                No live deals for your communities right now.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm">
                {deals.map((d) => {
                  const st = dealState(d);
                  return (
                    <li key={d.Id} className="space-y-3 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link to={`/deals/${d.Id}`} className="font-medium text-foreground hover:text-primary">{d.Name}</Link>
                          <p className="text-sm text-muted-foreground">
                            {st.booked} booked, {st.unlocked ? (st.next ? `${st.toNext} more for ${inr(st.next.price)}` : 'best price reached') : `${st.toMin} more to unlock`}
                          </p>
                        </div>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">{timeLeft(d.deadline_c)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => share(d)}>
                          <ApperIcon name="MessageCircle" size={16} />
                          Share on WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => copy(d)} aria-label={`Copy link to ${d.Name}`}>
                          <ApperIcon name="Link" size={16} />
                          Copy link
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
