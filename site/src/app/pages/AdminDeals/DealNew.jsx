import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import DealForm, { dealToForm } from './DealForm';

export const route = { path: '/admin/deals/new', layout: 'owner', access: "profile === 'Admin_c'" };

export default function DealNew() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  async function create(payload) {
    setSaving(true);
    try {
      const res = await sdk.table('deals_c').create({ ...payload, bookedHomes_c: 0, unlockedTier_c: 1 });
      if (res.messages?.length) toast.error(res.messages[0], { description: res.messages.slice(1).join('\n') || undefined });
      if (!res.data?.length) return;
      toast.success(payload.status_c === 'Live' ? 'Deal published' : 'Draft saved');
      navigate(`/admin/deals/${res.data[0].Id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/admin/deals">
          <ApperIcon name="ArrowLeft" size={16} />
          Back to Deals
        </Link>
      </Button>
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">New deal</h1>
        <p className="mt-1 text-muted-foreground">Set the vendor's tiers, the minimum and the deadline. Save as draft until the vendor signs.</p>
      </div>
      <DealForm
        initial={dealToForm(null)}
        saving={saving}
        submitLabel="Create deal"
        onSubmit={create}
        onCancel={() => navigate('/admin/deals')}
      />
    </div>
  );
}
