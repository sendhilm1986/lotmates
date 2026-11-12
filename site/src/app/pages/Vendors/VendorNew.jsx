import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import VendorForm, { vendorToForm } from './VendorForm';

export const route = { path: '/admin/vendors/new', layout: 'owner', access: "profile === 'Admin_c'" };

export default function VendorNew() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  async function create(payload) {
    setSaving(true);
    try {
      const res = await sdk.table('vendors_c').create(payload);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) return;
      toast.success('Vendor added');
      navigate(`/admin/vendors/${res.data[0].Id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/admin/vendors">
          <ApperIcon name="ArrowLeft" size={16} />
          Back to Vendors
        </Link>
      </Button>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">Add vendor</h1>
      <VendorForm initial={vendorToForm(null)} saving={saving} submitLabel="Add vendor" onSubmit={create} onCancel={() => navigate('/admin/vendors')} />
    </div>
  );
}
