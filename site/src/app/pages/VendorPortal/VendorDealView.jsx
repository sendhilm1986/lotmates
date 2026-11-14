import { Link, useParams } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import DealReviewPanel, { DealTerms } from '@/components/DealReviewPanel';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { DEAL_FIELDS, categoryLabel } from '@/services/dealRules';

export const route = { path: '/vendor/deals/:id', layout: 'owner', access: "profile === 'Vendor_c'" };

export default function VendorDealView() {
  const { id } = useParams();
  const { data: deal, loading, error, run } = useFetch(() => sdk.table('deals_c').select(DEAL_FIELDS).get(id).then((r) => r.data), [id]);
  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link to="/vendor/deals">
        <ApperIcon name="ArrowLeft" size={16} />
        Back to Deals
      </Link>
    </Button>
  );
  if (loading && deal === undefined) return <DetailSkeleton />;
  if (error || !deal) {
    return (
      <div className="space-y-4">
        {back}
        <div className="rounded-[22px] bg-card p-10 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{error ? `Couldn't load this deal: ${error.message}` : 'Deal not found.'}</p>
          {error && <Button variant="outline" className="mt-3" onClick={run}>Try again</Button>}
        </div>
      </div>
    );
  }
  const live = ['Live', 'Closed', 'Failed'].includes(deal.status_c);
  return (
    <div className="space-y-6">
      {back}
      <div>
        <p className="text-sm text-muted-foreground">{categoryLabel(deal.category_c)}</p>
        <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-foreground">{deal.Name}</h1>
        {live && (
          <Link to={`/deals/${deal.Id}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            See the public page
            <ApperIcon name="ExternalLink" size={14} />
          </Link>
        )}
      </div>
      <DealReviewPanel deal={deal} role="vendor" onChanged={run} editTo={`/vendor/deals/${deal.Id}/edit`} />
      {!(deal.status_c === 'Awaiting vendor') && (
        <section className="rounded-[22px] bg-card p-5 shadow-sm md:p-6">
          <h2 className="font-heading text-lg font-bold text-foreground">Terms</h2>
          <div className="mt-2"><DealTerms deal={deal} /></div>
        </section>
      )}
    </div>
  );
}
