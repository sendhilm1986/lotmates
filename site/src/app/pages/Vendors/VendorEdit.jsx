import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import VendorForm, { vendorToForm } from './VendorForm';
import { VENDOR_FIELDS } from './VendorsList';

export const route = { path: '/admin/vendors/:id/edit', layout: 'owner', access: "profile === 'Admin_c'" };

export default function VendorEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const { data: vendor, loading, error, run } = useFetch(() => {
    return sdk.table('vendors_c').select(VENDOR_FIELDS).get(id).then((r) => r.data);
  }, [id]);

  async function save(payload) {
    setSaving(true);
    try {
      const res = await sdk.table('vendors_c').update({ Id: id, ...payload });
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) return;
      toast.success('Vendor saved');
      navigate(`/admin/vendors/${id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to={`/admin/vendors/${id}`}>
          <ApperIcon name="ArrowLeft" size={16} />
          Back to Vendor
        </Link>
      </Button>
      <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">Edit vendor</h1>
      {loading && vendor === undefined ? (
        <DetailSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load vendor: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : !vendor ? (
        <div className="rounded-[22px] bg-card shadow-sm p-10 text-center text-muted-foreground">Vendor not found.</div>
      ) : (
        <VendorForm key={vendor.Id} initial={vendorToForm(vendor)} saving={saving} submitLabel="Save vendor" onSubmit={save} onCancel={() => navigate(`/admin/vendors/${id}`)} />
      )}
    </div>
  );
}
