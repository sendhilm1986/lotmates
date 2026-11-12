import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import DealForm, { dealToForm } from './DealForm';
import { DEAL_FIELDS } from '@/services/dealRules';

export const route = { path: '/admin/deals/:id/edit', layout: 'owner', access: "profile === 'Admin_c'" };

export default function DealEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const { data: deal, loading, error, run } = useFetch(() => {
    return sdk
      .table('deals_c')
      .select(DEAL_FIELDS)
      .get(id)
      .then((r) => r.data);
  }, [id]);

  async function save(payload) {
    setSaving(true);
    try {
      const res = await sdk.table('deals_c').update({ Id: id, ...payload });
      if (res.messages?.length) toast.error(res.messages[0], { description: res.messages.slice(1).join('\n') || undefined });
      if (!res.data?.length) return;
      toast.success('Deal saved');
      navigate(`/admin/deals/${id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to={`/admin/deals/${id}`}>
          <ApperIcon name="ArrowLeft" size={16} />
          Back to Deal
        </Link>
      </Button>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">Edit deal</h1>
      {loading && deal === undefined ? (
        <DetailSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load this deal: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : !deal ? (
        <div className="rounded-[22px] bg-card shadow-sm p-10 text-center text-muted-foreground">Deal not found.</div>
      ) : (
        <DealForm
          key={deal.Id}
          initial={dealToForm(deal)}
          saving={saving}
          submitLabel="Save deal"
          onSubmit={save}
          onCancel={() => navigate(`/admin/deals/${id}`)}
        />
      )}
    </div>
  );
}
