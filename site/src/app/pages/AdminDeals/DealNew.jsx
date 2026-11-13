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

  // intent: 'save' (draft), 'send' (to the vendor to confirm) or 'publish' (without vendor review).
  async function create(payload, intent) {
    setSaving(true);
    try {
      const flow = intent !== 'save';
      const res = await sdk.table('deals_c').create({ ...payload, ...(flow ? { status_c: 'Draft' } : {}), origin_c: 'admin', bookedHomes_c: 0, unlockedTier_c: 1 });
      if (res.messages?.length) toast.error(res.messages[0], { description: res.messages.slice(1).join('\n') || undefined });
      if (!res.data?.length) return;
      const id = res.data[0].Id;
      if (flow) {
        const r = await sdk.dealFlow.act(id, intent === 'send' ? 'send_to_vendor' : 'publish_direct');
        if (!r.ok) {
          toast.error(r.error.message, { description: 'The deal is saved as a draft.' });
          return navigate(`/admin/deals/${id}`);
        }
        toast.success(intent === 'send' ? 'Sent to the vendor to confirm' : 'Published without vendor review');
      } else {
        toast.success(payload.status_c === 'Live' ? 'Deal published' : 'Draft saved');
      }
      navigate(`/admin/deals/${id}`);
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
        <p className="mt-1 text-muted-foreground">Set the vendor's tiers, the minimum and the deadline. Send it to the vendor to confirm, or publish it yourself when no review is needed.</p>
      </div>
      <DealForm
        initial={dealToForm(null)}
        saving={saving}
        actions={[
          { intent: 'save', label: 'Save draft', variant: 'ghost' },
          { intent: 'publish', label: 'Publish without vendor review', variant: 'outline' },
          { intent: 'send', label: 'Send to vendor for review' },
        ]}
        onSubmit={create}
        onCancel={() => navigate('/admin/deals')}
      />
    </div>
  );
}
