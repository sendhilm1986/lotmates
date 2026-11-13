import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import DealForm, { dealToForm } from '@/pages/AdminDeals/DealForm';

export const route = { path: '/vendor/deals/new', layout: 'owner', access: "profile === 'Vendor_c'" };

export default function VendorDealNew() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  async function create(payload, intent) {
    setSaving(true);
    try {
      const r = await sdk.dealFlow.save(payload);
      if (!r.ok) return toast.error(r.error.message);
      const id = r.value?.data?.Id ?? r.value?.Id;
      if (intent === 'submit') {
        const s = await sdk.dealFlow.act(id, 'submit');
        if (!s.ok) {
          toast.error(s.error.message, { description: 'Your draft is saved.' });
          return navigate(`/vendor/deals/${id}`);
        }
        toast.success('Sent to the team for review. You will get an email when they decide.');
      } else {
        toast.success('Draft saved. Only you can see it.');
      }
      navigate(`/vendor/deals/${id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/vendor/deals">
          <ApperIcon name="ArrowLeft" size={16} />
          Back to My deals
        </Link>
      </Button>
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">New deal</h1>
        <p className="mt-1 text-muted-foreground">Set the tiers, the minimum and the dates. The Lotmates team reviews it before neighbours can see it.</p>
      </div>
      <DealForm
        mode="vendor"
        initial={dealToForm(null)}
        saving={saving}
        actions={[
          { intent: 'save', label: 'Save draft', variant: 'outline' },
          { intent: 'submit', label: 'Send to the team for review' },
        ]}
        onSubmit={create}
        onCancel={() => navigate('/vendor/deals')}
      />
    </div>
  );
}
