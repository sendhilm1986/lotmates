import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import RatingStars from '@/components/RatingStars';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { DEAL_FIELDS, DEAL_STYLES, dealState, inr, timeLeft } from '@/services/dealRules';
import { VENDOR_PUBLIC_FIELDS, userIdOf, unwrapList } from '@/services/records';

export const route = { path: '/vendor/deals', layout: 'owner', access: "profile === 'Vendor_c'" };
export const nav = { icon: 'Tag', label: 'My deals', order: 6, profiles: ['Vendor_c'] };

const { eq } = window.ApperSDK.CoreSDK;

export default function VendorDeals() {
  const navigate = useNavigate();
  const user = useSelector((s) => s.user.user);
  const uid = userIdOf(user);

  const { data, loading, error, run } = useFetch(async () => {
    if (!uid) return { vendor: null, deals: [] };
    const v = await sdk.table('vendors_c').select(VENDOR_PUBLIC_FIELDS).where(eq('user_c', uid)).limit(1).fetch();
    const vendor = unwrapList(v)[0] ?? null;
    if (!vendor) return { vendor: null, deals: [] };
    const d = await sdk
      .table('deals_c')
      .select(DEAL_FIELDS)
      .where(eq('vendor_c', vendor.Id))
      .orderByDesc('CreatedOn')
      .page(1, 50)
      .fetch();
    return { vendor, deals: unwrapList(d) };
  }, [uid]);

  const vendor = data?.vendor;
  const deals = data?.deals ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="My deals"
        description={vendor ? vendor.Name : 'Deals you deliver through Lotmates.'}
        actions={
          vendor ? (
            <Button variant="outline" asChild>
              <Link to={`/partners/${vendor.Id}`}>
                <ApperIcon name="Store" size={16} />
                Public profile
              </Link>
            </Button>
          ) : null
        }
      >
        {vendor && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <RatingStars value={vendor.rating_c} />
            <span>{vendor.rating_c ?? '—'} rating</span>
            <span>{vendor.jobsDone_c ?? 0} jobs done</span>
          </div>
        )}
      </PageHeader>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load your deals: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && data === undefined ? (
        <ListSkeleton rows={4} />
      ) : !vendor ? (
        <p className="rounded-[22px] bg-card shadow-sm p-8 text-center text-sm text-muted-foreground">
          Your login isn't linked to a vendor yet. Ask the Lotmates team to link it from the vendor record.
        </p>
      ) : deals.length === 0 ? (
        <p className="rounded-[22px] bg-card shadow-sm p-8 text-center text-sm text-muted-foreground">
          No deals yet. The team will share a draft with you before anything goes live.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm">
          {deals.map((d) => {
            const st = dealState(d);
            return (
              <li key={d.Id}>
                <div
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/deals/${d.Id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/deals/${d.Id}`);
                  }}
                  className="flex cursor-pointer flex-col gap-2 px-5 py-5 transition-colors md:px-6 duration-(--transition-fast) hover:bg-accent sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{d.Name}</p>
                    <p className="text-sm text-muted-foreground">
                      {d.community_c?.Name ?? `All of ${d.locality_c?.Name ?? 'the locality'}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="tabular-nums text-foreground">
                      {st.booked}/{st.cap || st.scaleMax} booked
                    </span>
                    <span className="tabular-nums font-semibold text-foreground">{inr(st.current?.price)}</span>
                    {d.status_c === 'Live' ? (
                      <span className="text-xs text-muted-foreground">{timeLeft(d.deadline_c)}</span>
                    ) : (
                      <StatusBadge value={d.status_c} styles={DEAL_STYLES} />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
