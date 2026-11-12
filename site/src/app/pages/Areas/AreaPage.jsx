import { Link, useParams } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import DealCard from '@/components/DealCard';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { DEAL_FIELDS } from '@/services/dealRules';
import { unwrapList } from '@/services/records';

export const route = { path: '/areas/:id', layout: 'public', access: 'public' };

const { eq, and } = window.ApperSDK.CoreSDK;

export default function AreaPage() {
  const { id } = useParams();

  const { data: area, loading, error, run } = useFetch(() => {
    return sdk.table('localities_c').select(['Name', 'city_c', 'pincode_c', 'status_c']).get(id).then((r) => r.data);
  }, [id]);

  const { data: communities } = useFetch(() => {
    return sdk
      .table('communities_c')
      .select(['Name', 'type_c', 'homes_c', 'status_c', 'ambassadorName_c'])
      .where(eq('locality_c', id))
      .orderBy('Name')
      .fetch()
      .then(unwrapList);
  }, [id]);

  const { data: deals } = useFetch(() => {
    return sdk
      .table('deals_c')
      .select(DEAL_FIELDS)
      .where(and(eq('locality_c', id), eq('status_c', 'Live')))
      .orderBy('deadline_c')
      .page(1, 12)
      .fetch()
      .then(unwrapList);
  }, [id]);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
      <Link to="/deals">
        <ApperIcon name="ArrowLeft" size={16} />
        Back to Deals
      </Link>
    </Button>
  );

  if (loading && area === undefined) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        {back}
        <DetailSkeleton />
      </div>
    );
  }
  if (error || !area) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
        {back}
        <div className="flex flex-col items-center gap-3 rounded-(--radius) border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">{error ? `Couldn't load this area: ${error.message}` : 'This area isn’t listed.'}</p>
          {error && <Button variant="outline" onClick={run}>Try again</Button>}
        </div>
      </div>
    );
  }

  const coms = communities ?? [];
  const homes = coms.reduce((s, c) => s + Number(c.homes_c || 0), 0);
  const live = deals ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 md:px-8">
      <div>
        {back}
        <p className="text-sm text-muted-foreground">{area.city_c?.Name}{area.pincode_c ? `, ${area.pincode_c}` : ''}</p>
        <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight text-foreground">{area.Name}</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          {area.status_c === 'Live'
            ? `${coms.length} communities and about ${homes} homes buying together here.`
            : 'Coming soon. Ask your residents association to get in touch.'}
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-foreground">Live deals in {area.Name}</h2>
          <Link to={`/deals?locality=${area.Id}`} className="text-sm font-medium text-primary hover:underline">Filter all deals</Link>
        </div>
        {live.length === 0 ? (
          <p className="rounded-(--radius) border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No live deals here right now. New rounds open most weeks.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
            {live.map((d) => (
              <DealCard key={d.Id} record={d} />
            ))}
          </div>
        )}
      </section>

      {coms.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-foreground">Communities</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-(--radius) border border-border bg-card">
            {coms.map((c) => (
              <li key={c.Id} className="flex items-center gap-3 px-4 py-3">
                <ApperIcon name={c.type_c === 'Street' ? 'Signpost' : c.type_c === 'Gated' ? 'Fence' : 'Building'} size={18} className="text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{c.Name}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.homes_c ?? '?'} homes{c.ambassadorName_c ? `, ambassador ${c.ambassadorName_c}` : ''}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{c.status_c === 'Active' ? 'On Lotmates' : 'Joining'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
