import { Link, useParams } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatRelativeTime } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import DealCard from '@/components/DealCard';
import RatingStars from '@/components/RatingStars';
import VendorReviews from '@/components/VendorReviews';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { DEAL_FIELDS, categoryLabel, categoryIcon } from '@/services/dealRules';
import { REVIEW_FIELDS, VENDOR_PUBLIC_FIELDS, toArray, unwrapList } from '@/services/records';

export const route = { path: '/partners/:id', layout: 'public', access: 'public' };

const { eq, and, isIn } = window.ApperSDK.CoreSDK;

const ALL_CHECKS = ['ID proof', 'Licence', 'Test job', 'References'];

export default function VendorProfile() {
  const { id } = useParams();

  const { data: vendor, loading, error, run } = useFetch(() => {
    return sdk.table('vendors_c').select(VENDOR_PUBLIC_FIELDS).get(id).then((r) => r.data);
  }, [id]);

  const { data: deals } = useFetch(() => {
    return sdk
      .table('deals_c')
      .select(DEAL_FIELDS)
      .where(and(eq('vendor_c', id), isIn('status_c', ['Live', 'Closed'])))
      .orderByDesc('CreatedOn')
      .page(1, 6)
      .fetch()
      .then(unwrapList);
  }, [id]);

  const { data: reviews } = useFetch(() => {
    return sdk.table('reviews_c').select(REVIEW_FIELDS).where(eq('vendor_c', id)).orderByDesc('CreatedOn').page(1, 20).fetch().then(unwrapList);
  }, [id]);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
      <Link to="/deals">
        <ApperIcon name="ArrowLeft" size={16} />
        Back to Deals
      </Link>
    </Button>
  );

  if (loading && vendor === undefined) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        {back}
        <DetailSkeleton />
      </div>
    );
  }
  if (error || !vendor) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
        {back}
        <div className="flex flex-col items-center gap-3 rounded-(--radius) border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{error ? `Couldn't load this vendor: ${error.message}` : 'This vendor isn’t listed.'}</p>
          {error && <Button variant="outline" onClick={run}>Try again</Button>}
        </div>
      </div>
    );
  }

  const checks = toArray(vendor.checks_c);
  const list = reviews ?? [];
  const avg = list.length ? list.reduce((s, r) => s + Number(r.rating_c || 0), 0) / list.length : Number(vendor.rating_c || 0);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 md:px-8">
      <div>
        {back}
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ApperIcon name={categoryIcon(vendor.category_c)} size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-foreground">{vendor.Name}</h1>
            <p className="mt-1 text-muted-foreground">
              {categoryLabel(vendor.category_c)}
              {vendor.locality_c?.Id && (
                <>
                  {' in '}
                  <Link to={`/areas/${vendor.locality_c.Id}`} className="text-primary hover:underline">{vendor.locality_c.Name}</Link>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <RatingStars value={avg} />
            <span className="tabular-nums text-foreground">{avg ? avg.toFixed(1) : 'New'}</span>
          </span>
          <span className="text-muted-foreground">{vendor.jobsDone_c ?? 0} jobs done</span>
          {vendor.status_c === 'Probation' && <span className="text-muted-foreground">New vendor, first deals capped</span>}
        </div>
      </div>

      <section className="rounded-(--radius) border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-bold text-foreground">What we checked</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ALL_CHECKS.map((c) => {
            const ok = checks.includes(c);
            return (
              <li key={c} className="flex items-center gap-2 text-sm">
                <ApperIcon name={ok ? 'CircleCheck' : 'Circle'} size={18} className={ok ? 'text-success' : 'text-muted-foreground'} />
                <span className={ok ? 'text-foreground' : 'text-muted-foreground'}>{c}{ok ? '' : ' (pending)'}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {(deals ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-foreground">Deals with {vendor.Name}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {deals.map((d) => (
              <DealCard key={d.Id} record={d} />
            ))}
          </div>
        </section>
      )}

      <VendorReviews vendorId={id} />
    </div>
  );
}
