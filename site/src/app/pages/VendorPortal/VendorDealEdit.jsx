import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import DealForm, { dealToForm } from '@/pages/AdminDeals/DealForm';
import { DEAL_FIELDS } from '@/services/dealRules';

export const route = { path: '/vendor/deals/:id/edit', layout: 'owner', access: "profile === 'Vendor_c'" };

export default function VendorDealEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const { data: deal, loading, error, run } = useFetch(() => sdk.table('deals_c').select(DEAL_FIELDS).get(id).then((r) => r.data), [id]);

  async function save(payload, intent) {
    setSaving(true);
    try {
      const r = await sdk.dealFlow.save({ ...payload, id });
      if (!r.ok) return toast.error(r.error.message);
      if (intent === 'submit') {
        const s = await sdk.dealFlow.act(id, 'submit');
        if (!s.ok) {
          toast.error(s.error.message, { description: 'Your changes are saved.' });
          return navigate(`/vendor/deals/${id}`);
        }
        toast.success('Sent to the team for review.');
      } else {
        toast.success('Saved');
      }
      navigate(`/vendor/deals/${id}`);
    } finally {
      setSaving(false);
    }
  }

  const editable = deal && deal.origin_c === 'vendor' && ['Draft', 'Changes requested'].includes(deal.status_c);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to={`/vendor/deals/${id}`}>
          <ApperIcon name="ArrowLeft" size={16} />
          Back to the deal
        </Link>
      </Button>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">Edit deal</h1>
      {loading && deal === undefined ? (
        <DetailSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card p-10 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Couldn't load this deal: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : !deal ? (
        <div className="rounded-[22px] bg-card p-10 text-center text-muted-foreground shadow-sm">Deal not found.</div>
      ) : !editable ? (
        <div className="rounded-[22px] bg-card p-10 text-center text-muted-foreground shadow-sm">
          This deal can't be edited now. If it is with the team, withdraw it first. If the team wrote it, ask for changes instead.
        </div>
      ) : (
        <DealForm
          key={deal.Id}
          mode="vendor"
          initial={dealToForm(deal)}
          saving={saving}
          actions={[
            { intent: 'save', label: 'Save', variant: 'outline' },
            { intent: 'submit', label: 'Save and send to the team' },
          ]}
          onSubmit={save}
          onCancel={() => navigate(`/vendor/deals/${id}`)}
        />
      )}
    </div>
  );
}
